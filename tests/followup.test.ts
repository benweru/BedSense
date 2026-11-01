import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyConceptCounts } from "@/lib/concepts";
import { emptyFarmerContext } from "@/lib/context";
import { copy } from "@/lib/copy";
import { inferIssue, inferIssues } from "@/lib/issues";
import { matchResearch, researchFor } from "@/lib/research";
import { adviseBed, localFallback } from "@/lib/server/muse";
import { buildMockResult } from "@/lib/server/mock";
import { containsDosage } from "@/lib/triage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function bedOptions() {
  return {
    imageUrl: "data:image/jpeg;base64,aaaa",
    apiKey: "k".repeat(40),
    locale: "en" as const,
    counts: emptyConceptCounts(),
    context: emptyFarmerContext(),
    primaryCrop: null,
    farmerPlant: "tomato",
    deadline: Date.now() + 60_000,
  };
}

function stubModels(reading: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reading) } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

const blisterReading = {
  detectedPlant: "tomato",
  symptom: "spots",
  observations: ["Raised blisters cover the underside of several tomato leaves."],
  likelyCauses: ["Sap-sucking pest damage looks likely on these leaves."],
  mitigations: [],
  actions: ["Look at the leaves again.", "Compare two leaves.", "Photograph again in two days."],
  confidence: "low",
  confidenceScore: 0.35,
  contextAsk: "",
  sprayIndicated: false,
  diseaseIndicated: false,
  suspect: "sap-sucking pest",
  chemicals: [],
};

describe("symptom vocabulary beyond the original six", () => {
  it("recognises blisters, chewing, webbing, sooty coating, and mosaic as symptoms", () => {
    expect(inferIssue("raised blisters on the underside of the leaf")).not.toBeNull();
    expect(inferIssue("leaves are blistered and bumpy")).not.toBeNull();
    expect(inferIssues("holes chewed in the leaves with webbing underneath").length).toBeGreaterThan(0);
    expect(inferIssue("black sooty mould over a sticky coating")).not.toBeNull();
    expect(inferIssue("yellow mosaic mottling across new growth")).not.toBeNull();
    expect(inferIssue("no blisters or spots in this frame")).toBeNull();
  });

  it("researches blister suspects instead of falling back to sucking pests", () => {
    expect(matchResearch("blister mite")?.id).toBe("blister-mite");
    expect(matchResearch("eriophyid mites on the leaves")?.id).toBe("blister-mite");
    expect(matchResearch("oedema from uneven watering")?.id).toBe("oedema");
    expect(matchResearch("bacterial spot")?.id).toBe("bacterial-spot");
    expect(researchFor("blister mite", "spots")?.id).toBe("blister-mite");
  });
});

describe("every symptomatic reading ends in mitigation, chemicals, or an explicit ask", () => {
  it("turns an unsure blister reading into an insufficient-evidence outcome, not a silent dead end", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubModels(blisterReading);
    const result = await adviseBed(bedOptions());
    expect(result.triageSource).toBe("muse");
    // No blind spray for an unconfirmed suspect.
    expect(result.chemicals).toBeNull();
    // But the farmer is told plainly what is still needed, and gets safe steps meanwhile.
    expect(result.needsInfo).toBe(true);
    expect(result.contextAsk).toBeTruthy();
    expect(result.contextAsk?.toLowerCase()).toMatch(/underside|another angle|close/);
    expect(result.mitigations.length).toBeGreaterThan(0);
    expect(result.likelyCauses.join(" ").toLowerCase()).not.toMatch(/^sap-sucking pest\.?$/);
    expect(containsDosage(result.contextAsk ?? "")).toBe(false);
  });

  it("still gives researched mitigation when Muse names a known suspect but no spray", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubModels({
      ...blisterReading,
      symptom: "insects",
      likelyCauses: ["Blister mites are raising blisters under the leaves."],
      suspect: "blister mite",
      confidence: "medium",
      confidenceScore: 0.6,
    });
    const result = await adviseBed(bedOptions());
    expect(result.mitigations.join(" ").toLowerCase()).toMatch(/blister|underside|lens/);
    expect(result.contextAsk).toBeTruthy();
  });

  it("guarantees a follow-up even when Muse answers confidently with a spray", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubModels({
      detectedPlant: "kale",
      symptom: "insects",
      observations: ["Tiny pale insects crowd the underside of the young leaves."],
      likelyCauses: ["Whitefly feeding on young kale."],
      mitigations: [],
      actions: ["Shake the plant and watch for a white cloud.", "Check under young leaves.", "Take a close photo to an agrovet."],
      confidence: "high",
      confidenceScore: 0.85,
      contextAsk: "",
      diseaseIndicated: true,
      sprayIndicated: true,
      suspect: "whitefly",
      chemicals: [],
    });
    const result = await adviseBed({ ...bedOptions(), farmerPlant: "kale" });
    expect(result.chemicals?.products.length).toBeGreaterThan(0);
    expect(result.needsInfo).toBe(false);
    expect(result.contextAsk).toBeTruthy();
    expect(result.contextAsk?.toLowerCase()).toMatch(/spray|sprayer|already/);
  });

  it("keeps a model-supplied follow-up instead of overwriting it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubModels({ ...blisterReading, contextAsk: "Can you photograph the underside of one blistered leaf?" });
    const result = await adviseBed(bedOptions());
    expect(result.contextAsk).toBe("Can you photograph the underside of one blistered leaf?");
  });

  it("guarantees a follow-up in the local fallback and the demo", () => {
    const fallback = localFallback(
      "en",
      emptyConceptCounts(),
      { ...emptyFarmerContext(), notes: "leaves have raised blisters" },
      null,
      "tomato",
    );
    expect(fallback.contextAsk).toBeTruthy();
    expect(fallback.mitigations.length).toBeGreaterThan(0);

    const healthy = localFallback("en", emptyConceptCounts(), emptyFarmerContext(), null, "tomato");
    expect(healthy.contextAsk).toBe(copy.en.contextAskDefault);
    expect(healthy.needsInfo).toBe(false);

    const mock = buildMockResult({
      scenario: 1,
      locale: "en",
      width: 900,
      height: 1200,
      mime: "image/jpeg",
      id: "followup-mock",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "tomato",
      context: { ...emptyFarmerContext(), notes: "leaves are curling", stage: "three weeks" },
    });
    expect(mock.contextAsk).toBeTruthy();
    expect(mock.needsInfo).toBe(false);
  });

  it("gives the same guarantee in Swahili", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubModels(blisterReading);
    const result = await adviseBed({ ...bedOptions(), locale: "sw" });
    expect(result.needsInfo).toBe(true);
    expect(result.contextAsk).toBeTruthy();
    expect(result.contextAsk).not.toMatch(/\bthe\b|\band\b|\bwith\b/i);
  });
});
