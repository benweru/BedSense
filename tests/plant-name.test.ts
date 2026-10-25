import { describe, expect, it } from "vitest";
import { parseFarmerPlant } from "@/lib/plant-name";
import { demoScenario, scenarioForPlant } from "@/lib/server/mock";
import { promptsForBed } from "@/lib/server/sam";

describe("farmer plant name", () => {
  it("keeps a free-text name and drops a dose", () => {
    expect(parseFarmerPlant("  sukuma wiki ")).toBe("sukuma wiki");
    expect(parseFarmerPlant("ng'ombe")).toBe("ng'ombe");
    expect(parseFarmerPlant("a")).toBeNull();
    expect(parseFarmerPlant("spray 20 ml")).toBeNull();
    expect(parseFarmerPlant(12)).toBeNull();
  });

  it("asks SAM only for the named plant and symptom marks", () => {
    expect(promptsForBed("tomato").map((prompt) => prompt.phrase)).toEqual(["tomato plant", "yellow leaf", "weed"]);
    expect(promptsForBed("onion").map((prompt) => prompt.phrase)).toEqual(["onion plant", "yellow leaf", "weed"]);
    expect(promptsForBed("chilly").map((prompt) => prompt.phrase)).toEqual(["chili pepper plant", "yellow leaf", "weed"]);
    expect(promptsForBed("chili").some((prompt) => prompt.phrase === "chili plant")).toBe(false);
    expect(promptsForBed("onion").some((prompt) => prompt.phrase === "beetroot plant")).toBe(false);
  });

  it("points the demo at the named crop", () => {
    const bytes = new Uint8Array([4, 5, 6]);
    expect(scenarioForPlant("onion", bytes)).toBe(0);
    expect(scenarioForPlant("beetroot", bytes)).toBe(1);
    expect(scenarioForPlant("pilipili hoho", bytes)).toBe(2);
    expect(scenarioForPlant("tomato", bytes)).toBe(demoScenario(bytes));
  });
});
