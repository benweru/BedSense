import { describe, expect, it } from "vitest";
import { adviseChemicals } from "@/lib/agrovet";
import { copy } from "@/lib/copy";
import { emptyFarmerContext } from "@/lib/context";
import { emptyConceptCounts } from "@/lib/concepts";
import { inferIssue, issueActives, type IssueId } from "@/lib/issues";
import { buildMockResult } from "@/lib/server/mock";
import { containsDosage, finalizeTriage } from "@/lib/triage";
import type { AnalyzeResult } from "@/lib/types";

function visibleText(result: Pick<AnalyzeResult, "observations" | "actions" | "chemicals">): string {
  const chemicals = result.chemicals;
  return [
    ...result.observations,
    ...result.actions,
    chemicals?.suspect ?? "",
    ...(chemicals?.products ?? []).flatMap((product) => [
      product.activeIngredient,
      product.useNote,
      ...product.offers.map((offer) => `${offer.shopName} ${offer.place} KES ${offer.priceMinKes}`),
    ]),
  ].join(" ");
}

function productNames(issue: IssueId): string[] {
  const advice = adviseChemicals({
    locale: "en",
    diseaseIndicated: true,
    suspect: "symptom",
    chemicals: issueActives(issue),
  });
  return advice?.products.map((product) => product.activeIngredient) ?? [];
}

const emptyCounts = emptyConceptCounts();

describe("sparse marks and a reported issue", () => {
  it("drops other-crop failure notes and still returns causes and checks", () => {
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
      counts: emptyCounts,
      confidence: "low",
      confidenceScore: 0.3,
      context,
    });
    const visible = result.observations.join("\n");
    expect(visible).not.toMatch(/beetroot|onion|chili|pilipili|segmentation did not return|notes you added|no plants were marked/i);
    expect(visible.toLowerCase()).toContain("twisted");
    expect(visible.toLowerCase()).toContain("tomato");
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(JSON.stringify(result)).not.toMatch(/\b\d+\s*ml\b/i);
  });

  it("uses the symptom, not the plant, to choose shop products", () => {
    const curl = productNames("curl");
    const spots = productNames("spots");
    expect(curl.length).toBeGreaterThan(0);
    expect(spots.length).toBeGreaterThan(0);
    expect(curl).not.toEqual(spots);
    expect(issueActives("yellowing")).toEqual([]);
    expect(issueActives("wilt")).toEqual([]);
    const sw = adviseChemicals({
      locale: "sw",
      diseaseIndicated: true,
      suspect: "madoa",
      chemicals: issueActives("spots"),
    });
    const en = adviseChemicals({
      locale: "en",
      diseaseIndicated: true,
      suspect: "spots",
      chemicals: issueActives("spots"),
    });
    expect(sw?.products[0]?.offers[0]?.shopKind).not.toBe(en?.products[0]?.offers[0]?.shopKind);
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
    expect(curl.counts.beetroot).toBe(0);
    expect(curl.observations.join(" ").toLowerCase()).toContain("chili");
    expect(curl.chemicals?.products.length).toBeGreaterThan(0);
    expect(curl.chemicals?.lookup).toBe("catalog");
    expect(visibleText(curl).toLowerCase()).not.toContain("beetroot");
    expect(visibleText(curl)).toMatch(/Kenya|KES/i);
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
    expect(spots.observations.join(" ")).toContain("Nyanya");
    expect(spots.chemicals?.products.some((product) => product.activeIngredient === "Mancozeb")).toBe(true);
    expect(visibleText(spots)).not.toMatch(/beetroot|pilipili|kitunguu|chili/i);
    expect(spots.chemicals?.priceNote).toContain("KES");

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
    expect(wilt.observations.length).toBeGreaterThan(0);
    expect(wilt.chemicals).toBeNull();
    expect(visibleText(wilt)).not.toMatch(/chili|beetroot|onion/i);
  });

  it("keeps catalog advice free of spray rates", () => {
    for (const locale of ["en", "sw"] as const) {
      for (const issue of ["curl", "deformity", "spots", "insects"] as const) {
        const advice = adviseChemicals({
          locale,
          diseaseIndicated: true,
          suspect: "symptom",
          chemicals: issueActives(issue),
        });
        expect(advice?.products.length).toBeGreaterThan(0);
        for (const product of advice?.products ?? []) {
          expect(containsDosage(`${product.activeIngredient} ${product.productClass} ${product.useNote}`)).toBe(false);
        }
      }
      expect(containsDosage(copy[locale].verifyNote)).toBe(false);
      expect(containsDosage(copy[locale].priceNote)).toBe(false);
    }
  });
});
