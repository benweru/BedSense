import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { qualityMessageFor } from "@/lib/quality-copy";
import { relocalizeResult, relocalizeText } from "@/lib/relocalize";
import { buildMockResult } from "@/lib/server/mock";
import type { AnalyzeResult } from "@/lib/types";

function mock(locale: "en" | "sw"): AnalyzeResult {
  return buildMockResult({ scenario: 2, locale, width: 900, height: 1200, mime: "image/jpeg", id: "m", createdAt: "2026-10-31T10:00:00.000Z" });
}

function held(locale: "en" | "sw", hold: AnalyzeResult["qualityHold"], verdicts: NonNullable<AnalyzeResult["qualityVerdicts"]>): AnalyzeResult {
  return {
    ...mock(locale),
    models: { sam: "sam-3.1", muse: null, triageSource: "withheld" },
    chemicals: null,
    disclaimer: copy[locale].disclaimer,
    agronomistCallout: copy[locale].agronomistCallout,
    qualityHold: hold,
    qualityMessage: qualityMessageFor(locale, hold!, verdicts),
    qualityVerdicts: verdicts,
  };
}

describe("language toggle on a shown result", () => {
  it("switches the hold message and Before you act back to English", () => {
    const sw = held("sw", "unclear", ["unclear"]);
    expect(sw.qualityMessage).toBe(copy.sw.qualityUnclear);
    const en = relocalizeResult(sw, "en");
    expect(en.qualityMessage).toBe(copy.en.qualityUnclear);
    expect(en.disclaimer).toBe(copy.en.disclaimer);
    expect(en.agronomistCallout).toBe(copy.en.agronomistCallout);
    expect(relocalizeResult(en, "sw").qualityMessage).toBe(copy.sw.qualityUnclear);
  });

  it("rebuilds the harsh light and mixed messages from frame codes", () => {
    const sw = held("sw", "mixed", ["too_far", "harsh_light"]);
    expect(relocalizeResult(sw, "en").qualityMessage).toBe(qualityMessageFor("en", "mixed", ["too_far", "harsh_light"]));
    const notPlant = held("en", "not_plant", ["unclear"]);
    expect(relocalizeResult(notPlant, "sw").qualityMessage).toBe(copy.sw.qualityNotPlant);
  });

  it("rebuilds the kept-and-skipped frames note", () => {
    const batch = { kept: [1], skipped: [{ frame: 2, lighting: true }] };
    const sw = { ...mock("sw"), qualityBatch: batch, qualityNote: copy.sw.qualityBatch(batch.kept, batch.skipped) };
    expect(relocalizeResult(sw, "en").qualityNote).toBe(copy.en.qualityBatch(batch.kept, batch.skipped));
  });

  it("switches local triage lines, agrovet notes and products both ways", () => {
    const sw = mock("sw");
    const en = mock("en");
    const swapped = relocalizeResult(sw, "en");
    expect(swapped.observations).toEqual(en.observations);
    expect(swapped.likelyCauses).toEqual(en.likelyCauses);
    expect(swapped.mitigations).toEqual(en.mitigations);
    expect(swapped.actions).toEqual(en.actions);
    expect(swapped.chemicals?.verifyNote).toBe(en.chemicals?.verifyNote);
    expect(swapped.chemicals?.priceNote).toBe(en.chemicals?.priceNote);
    expect(swapped.chemicals?.products.map((product) => product.useNote)).toEqual(en.chemicals?.products.map((product) => product.useNote));
    expect(swapped.chemicals?.products[0]?.offers.map((offer) => offer.shopKind)).toEqual(en.chemicals?.products[0]?.offers.map((offer) => offer.shopKind));
    expect(relocalizeResult(en, "sw").actions).toEqual(sw.actions);
  });

  it("leaves free-form Muse prose as written", () => {
    const prose = { ...mock("sw"), observations: ["Majani mawili yamejikunja karibu na shina."] };
    expect(relocalizeResult(prose, "en").observations).toEqual(prose.observations);
    expect(relocalizeText("Something Muse wrote.", "sw")).toBe("Something Muse wrote.");
  });

  it("returns the same object when the language already matches", () => {
    const en = mock("en");
    expect(relocalizeResult(en, "en")).toBe(en);
  });
});
