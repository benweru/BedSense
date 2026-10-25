import { describe, expect, it } from "vitest";
import { chemicalOffers } from "@/lib/agrovet";
import { copy } from "@/lib/copy";
import { emptyFarmerContext } from "@/lib/context";
import { emptyConceptCounts } from "@/lib/concepts";
import { inferIssue } from "@/lib/issues";
import { buildMockResult } from "@/lib/server/mock";
import { containsDosage, finalizeTriage } from "@/lib/triage";
import type { AnalyzeResult } from "@/lib/types";

function visibleText(result: Pick<AnalyzeResult, "observations" | "hypotheses" | "actions" | "chemicals">): string {
  return [
    ...result.observations,
    ...result.hypotheses,
    ...result.actions,
    ...result.chemicals.map((offer) => `${offer.name} ${offer.why} ${offer.shops}`),
  ].join(" ");
}

const emptyCounts = emptyConceptCounts();

describe("sparse marks and a reported issue", () => {
  it("drops other-crop failure notes and still returns causes, checks, and shops", () => {
    const context = { ...emptyFarmerContext(), notes: "What could be the cause of the curling?" };
    const result = finalizeTriage({
      locale: "en",
      plantName: "tomato",
      observations: [
        "No plants were marked in this frame.",
        "The notes you added are part of this check.",
        "Beetroot segmentation did not return, so those marks may be missing.",
        "Other plant segmentation did not return, so those marks may be missing.",
        "The fruit in the hand is twisted along the stem.",
      ],
      actions: copy.en.fallbackActions,
      hypotheses: [],
      chemicalsHelp: true,
      counts: emptyCounts,
      confidence: "low",
      confidenceScore: 0.3,
      context,
    });
    const visible = result.observations.join("\n");
    expect(visible).not.toMatch(/beetroot|onion|chili|pilipili|segmentation did not return|notes you added|no plants were marked/i);
    expect(visible.toLowerCase()).toContain("twisted");
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.hypotheses.join(" ").toLowerCase()).toContain("tomato");
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.chemicals.length).toBeGreaterThan(0);
    expect(result.chemicals.every((offer) => /KES \d+–\d+/.test(offer.kesBand))).toBe(true);
    expect(result.chemicals.some((offer) => /kenya/i.test(offer.shops))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/\b\d+\s*ml\b/i);
  });

  it("uses the symptom, not the plant, to choose shop products", () => {
    const curl = chemicalOffers("en", "curl").map((offer) => offer.name);
    const spots = chemicalOffers("en", "spots").map((offer) => offer.name);
    expect(curl).not.toEqual(spots);
    expect(chemicalOffers("en", "yellowing")).toEqual([]);
    expect(chemicalOffers("en", "wilt")).toEqual([]);
    expect(chemicalOffers("sw", "spots")[0]?.shops).not.toBe(chemicalOffers("en", "spots")[0]?.shops);
    expect(inferIssue("dark spots on the lower leaves")).toBe("spots");
    expect(inferIssue("the leaves are wilting")).toBe("wilt");
    expect(inferIssue("leaves look tired")).toBeNull();
  });

  it("shows a diagnosis path in the demo when context reports an issue and marks would have been another crop", () => {
    const curl = buildMockResult({
      scenario: 1,
      locale: "en",
      width: 900,
      height: 1200,
      mime: "image/jpeg",
      id: "curl",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "chilly",
      context: { ...emptyFarmerContext(), notes: "Yes other chillies are like this. What could be the cause of the curling?" },
    });
    expect(curl.detectedPlant).toBe("Chili");
    expect(curl.masks).toEqual([]);
    expect(curl.hypotheses.length).toBeGreaterThan(0);
    expect(curl.chemicals.length).toBeGreaterThan(0);
    expect(visibleText(curl).toLowerCase()).not.toContain("beetroot");
    expect(curl.actions).not.toEqual([...copy.en.fallbackActions]);

    const spots = buildMockResult({
      scenario: 2,
      locale: "sw",
      width: 900,
      height: 1200,
      mime: "image/jpeg",
      id: "spots",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "tomatoes",
      context: { ...emptyFarmerContext(), issues: "madoa meusi kwenye majani" },
    });
    expect(spots.detectedPlant).toBe("Nyanya");
    expect(spots.masks).toEqual([]);
    expect(spots.hypotheses.join(" ")).toContain("Nyanya");
    expect(spots.chemicals.length).toBeGreaterThan(0);
    expect(visibleText(spots)).not.toMatch(/beetroot|pilipili|kitunguu|chili/i);
    expect(spots.chemicals.some((offer) => /KES/.test(offer.kesBand))).toBe(true);

    const wilt = buildMockResult({
      scenario: 0,
      locale: "en",
      width: 640,
      height: 480,
      mime: "image/jpeg",
      id: "wilt",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "sukuma wiki",
      context: { ...emptyFarmerContext(), issues: "the plants are wilting" },
    });
    expect(wilt.detectedPlant).toBe("Kale");
    expect(wilt.hypotheses.length).toBeGreaterThan(0);
    expect(wilt.chemicals).toEqual([]);
    expect(visibleText(wilt)).not.toMatch(/chili|beetroot|onion/i);
  });

  it("keeps catalog copy free of spray rates", () => {
    for (const locale of ["en", "sw"] as const) {
      for (const issue of ["curl", "deformity", "spots", "insects"] as const) {
        for (const offer of chemicalOffers(locale, issue)) {
          expect(containsDosage(`${offer.name} ${offer.why} ${offer.shops} ${offer.kesBand}`)).toBe(false);
        }
      }
      expect(containsDosage(copy[locale].chemicalsHint)).toBe(false);
      expect(containsDosage(copy[locale].hypothesesHint)).toBe(false);
    }
  });
});
