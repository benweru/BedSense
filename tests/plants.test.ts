import { describe, expect, it } from "vitest";
import { conceptById } from "@/lib/concepts";
import { displayPlantName, matchPlant, probesForPlant, variantKey } from "@/lib/plants";

describe("plant name folding", () => {
  it("folds y/i and repeated letters onto one canonical name", () => {
    expect(variantKey("chilly")).toBe(variantKey("chili"));
    expect(variantKey("chilli")).toBe(variantKey("chili"));
    expect(variantKey("chillies")).toBe("chilies");
    for (const spelling of ["chili", "chilli", "chilly", "CHILLIES", "chilis"]) {
      expect(displayPlantName("en", spelling)).toBe("Chili");
      expect(displayPlantName("sw", spelling)).toBe("Pilipili");
    }
    expect(displayPlantName("en", "pilipili")).toBe("Chili");
    expect(displayPlantName("en", "onions")).toBe("Onion");
    expect(displayPlantName("en", "tomatoes")).toBe("Tomato");
    expect(displayPlantName("sw", "nyanya")).toBe("Nyanya");
    expect(displayPlantName("en", "beet root")).toBe("Beetroot");
    expect(displayPlantName("en", "sukuma wiki")).toBe("Kale");
    expect(displayPlantName("en", "amaranth")).toBe("Amaranth");
  });

  it("asks SAM for the named plant and symptoms only", () => {
    expect(probesForPlant("chilly").map((probe) => probe.phrase)).toEqual([
      "chili pepper plant",
      "yellow leaf",
      "weed",
    ]);
    expect(probesForPlant("tomatoes").map((probe) => probe.phrase)).toEqual(["tomato plant", "yellow leaf", "weed"]);
    expect(probesForPlant("beetroot").map((probe) => probe.id)).not.toContain("chili");
    expect(probesForPlant("").map((probe) => probe.phrase)).not.toContain("beetroot plant");
    expect(matchPlant("chili")?.samPhrase).toBe(conceptById("chili").phrase);
    expect(matchPlant("onion")?.samPhrase).toBe(conceptById("onion").phrase);
    expect(matchPlant("beetroot")?.samPhrase).toBe(conceptById("beetroot").phrase);
  });
});
