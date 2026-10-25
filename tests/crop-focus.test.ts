import { describe, expect, it } from "vitest";
import { chooseCropFocus } from "@/lib/crop-focus";

describe("onion-first crop focus", () => {
  it("follows onion when it is the only crop", () => {
    expect(chooseCropFocus({ onion: 4, beetroot: 0, chili: 0 })).toEqual({
      cropFocus: "onion",
      primaryCrop: "onion",
    });
  });

  it("follows beetroot when that frame is only beetroot", () => {
    expect(chooseCropFocus({ onion: 0, beetroot: 10, chili: 0 })).toEqual({
      cropFocus: "beetroot",
      primaryCrop: "beetroot",
    });
  });

  it("follows chili when that frame is only chili", () => {
    expect(chooseCropFocus({ onion: 0, beetroot: 0, chili: 6 })).toEqual({
      cropFocus: "chili",
      primaryCrop: "chili",
    });
  });

  it("treats onion and beetroot in one frame as unusual multi-crop, with onion leading a near-tie", () => {
    expect(chooseCropFocus({ onion: 10, beetroot: 10, chili: 0 })).toEqual({
      cropFocus: "mixed",
      primaryCrop: "onion",
    });
  });

  it("treats a beetroot-heavy frame that also contains onion as multi-crop, not one planting", () => {
    expect(chooseCropFocus({ onion: 2, beetroot: 10, chili: 0 })).toEqual({
      cropFocus: "mixed",
      primaryCrop: "beetroot",
    });
  });

  it("treats beetroot and chili in one frame as multi-crop", () => {
    expect(chooseCropFocus({ onion: 0, beetroot: 4, chili: 9 })).toEqual({
      cropFocus: "mixed",
      primaryCrop: "chili",
    });
  });

  it("returns unknown when no crop was marked", () => {
    expect(chooseCropFocus({ onion: 0, beetroot: 0, chili: 0 })).toEqual({
      cropFocus: "unknown",
      primaryCrop: null,
    });
  });
});
