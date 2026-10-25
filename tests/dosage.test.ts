import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { containsDosage, finalizeTriage } from "@/lib/triage";
import type { ConceptCounts } from "@/lib/types";

const counts: ConceptCounts = { onion: 2, beetroot: 0, chili: 0, plant: 0, "yellow-leaf": 1, weed: 0 };

describe("dosage guard", () => {
  it("flags spray rates and leaves field notes alone", () => {
    expect(containsDosage("Spray 20 ml per 20 L of water tonight.")).toBe(true);
    expect(containsDosage("Mix 5 grams into the tank.")).toBe(true);
    expect(containsDosage("Use 2 kg/ha on the bed.")).toBe(true);
    expect(containsDosage("Tumia 15 mililita za dawa.")).toBe(true);
    expect(containsDosage("Feel the soil a few centimetres down before you water.")).toBe(false);
    expect(containsDosage("Ask an agronomist before any spray.")).toBe(false);
  });

  it("keeps the shipped safety copy free of doses", () => {
    for (const locale of ["en", "sw"] as const) {
      const text = copy[locale];
      expect(containsDosage(text.disclaimer)).toBe(false);
      expect(containsDosage(text.agronomistCallout)).toBe(false);
      for (const action of text.fallbackActions) expect(containsDosage(action)).toBe(false);
    }
  });

  it("replaces a dose with three safe actions and lowers confidence", () => {
    const result = finalizeTriage({
      locale: "en",
      observations: ["Outer leaves look tired.", "Apply 10 ml per litre tonight."],
      actions: ["Feel the soil before watering.", "Spray 20 ml per 20 L of water.", "Show the photo to an agronomist."],
      confidence: "high",
      confidenceScore: 0.93,
      counts,
      failedConcepts: [],
    });
    expect(result.actions).toHaveLength(3);
    expect(result.actions.join(" ")).not.toMatch(/\d+\s*ml/i);
    expect(result.observations.join(" ")).not.toMatch(/\d+\s*ml/i);
    expect(result.confidence).toBe("low");
    expect(result.confidenceScore).toBeLessThanOrEqual(0.4);
    expect(result.disclaimer.toLowerCase()).toContain("not a diagnosis");
    expect(result.agronomistCallout.toLowerCase()).toContain("agronomist");
    expect(result.observations[0]).toContain("onion 2");
  });
});
