import { describe, expect, it } from "vitest";
import { preferSpecificCrops } from "@/lib/plant-marks";
import type { ConceptId, CropId, MaskMark } from "@/lib/types";

function mark(conceptId: ConceptId, crop: CropId | null, x: number): MaskMark {
  return {
    id: `${conceptId}-${x}`,
    conceptId,
    phrase: conceptId,
    kind: crop ? "crop" : "other",
    crop,
    objectId: String(x),
    confidence: 0.8,
    box: { x, y: 0, width: 10, height: 10 },
    grid: { width: 1, height: 1, rows: ["1"] },
    areaFraction: 0.1,
  };
}

describe("open plant marks", () => {
  it("keeps a vegetable outline when no familiar crop was marked", () => {
    const masks = [mark("plant", null, 0), mark("weed", null, 30)];
    expect(preferSpecificCrops(masks).map((item) => item.conceptId)).toEqual(["plant", "weed"]);
  });

  it("drops a generic plant outline that covers onion, beetroot, or chili", () => {
    const masks = [mark("onion", "onion", 0), mark("plant", null, 2), mark("plant", null, 40)];
    expect(preferSpecificCrops(masks).map((item) => item.id)).toEqual(["onion-0", "plant-40"]);
  });
});
