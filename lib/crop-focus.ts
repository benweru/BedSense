import type { CropFocus, CropId } from "@/lib/types";

const WEIGHT: Record<CropId, number> = {
  onion: 1.25,
  beetroot: 1,
  chili: 1,
};

export function chooseCropFocus(areaByCrop: Record<CropId, number>): {
  cropFocus: CropFocus;
  primaryCrop: CropId | null;
} {
  const ranked = (Object.keys(WEIGHT) as CropId[])
    .map((crop) => ({
      crop,
      area: Math.max(0, areaByCrop[crop] || 0),
      score: Math.max(0, areaByCrop[crop] || 0) * WEIGHT[crop],
    }))
    .sort((a, b) => b.score - a.score || b.area - a.area);

  const best = ranked[0];
  if (!best || best.area <= 0) {
    return { cropFocus: "unknown", primaryCrop: null };
  }

  const second = ranked[1];
  const mixed = Boolean(second && second.area > 0 && second.score >= best.score * 0.72);
  return {
    cropFocus: mixed ? "mixed" : best.crop,
    primaryCrop: best.crop,
  };
}
