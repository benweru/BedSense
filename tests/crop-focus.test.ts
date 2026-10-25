import { describe, expect, it } from "vitest";
import { chooseCropFocus } from "@/lib/crop-focus";

describe("onion-first crop focus", () => {
  it("follows onion when it is the only crop", () => {
    expect(chooseCropFocus({ onion: 4, beetroot: 0, chili: 0 })).toEqual({
      cropFocus: "onion",
      primaryCrop: "onion",
    });
  });

  it("gives onion a weight so a near-tie stays mixed with onion leading", () => {
    expect(chooseCropFocus({ onion: 10, beetroot: 10, chili: 0 })).toEqual({
      cropFocus: "mixed",
      primaryCrop: "onion",
    });
  });

  it("names beetroot when it clearly covers more of the bed", () => {
    expect(chooseCropFocus({ onion: 2, beetroot: 10, chili: 1 })).toEqual({
      cropFocus: "beetroot",
      primaryCrop: "beetroot",
    });
  });

  it("returns unknown when no crop was marked", () => {
    expect(chooseCropFocus({ onion: 0, beetroot: 0, chili: 0 })).toEqual({
      cropFocus: "unknown",
      primaryCrop: null,
    });
  });
});
