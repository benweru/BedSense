import type { CropFocus, CropId } from "@/lib/types";

/**
 * One photo is one bed. Onion, beetroot, and chili are familiar crops SAM
 * can mark. Onion is weighted first. Beetroot and chili are common secondary
 * crops, each grown on its own bed. Onion and beetroot are never on the same
 * bed, and chili is a separate bed as well. This file does not describe where
 * the beds are, and it does not decide every plant: Muse names whatever is
 * in the photo, including plants other than these three.
 *
 * Any second familiar crop in the frame is `mixed`: unusual multi-crop on
 * one photo, not the planting pattern. A frame that shows one of these crops
 * and not the others is labeled that crop.
 */
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

  const multiCropFrame = ranked.some((entry) => entry.crop !== best.crop && entry.area > 0);
  return {
    cropFocus: multiCropFrame ? "mixed" : best.crop,
    primaryCrop: best.crop,
  };
}
