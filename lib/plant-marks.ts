import type { MaskBox, MaskMark } from "@/lib/types";

/**
 * SAM's open "vegetable plant" prompt also fires on onion, beetroot, and chili.
 * When a familiar crop mask covers the same region, keep that crop and drop the
 * generic outline. A frame with no familiar crop keeps the plant masks.
 */
export function preferSpecificCrops(masks: readonly MaskMark[]): MaskMark[] {
  const specific = masks.filter((mask) => mask.crop);
  if (specific.length === 0) return [...masks];
  return masks.filter((mask) => {
    if (mask.conceptId !== "plant") return true;
    return !specific.some((crop) => overlapFraction(mask.box, crop.box) >= 0.45);
  });
}

function overlapFraction(plant: MaskBox, crop: MaskBox): number {
  const left = Math.max(plant.x, crop.x);
  const top = Math.max(plant.y, crop.y);
  const right = Math.min(plant.x + plant.width, crop.x + crop.width);
  const bottom = Math.min(plant.y + plant.height, crop.y + crop.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  const area = plant.width * plant.height;
  if (area <= 0) return 0;
  return (width * height) / area;
}
