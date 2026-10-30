import { afterEach, describe, expect, it, vi } from "vitest";
import { AGROVET_CATALOG } from "@/lib/agrovet-catalog";
import { adviseChemicals, matchCatalog } from "@/lib/agrovet";
import { emptyConceptCounts } from "@/lib/concepts";
import { emptyFarmerContext } from "@/lib/context";
import { adviseBed, developerPrompt } from "@/lib/server/muse";
import { buildMockResult } from "@/lib/server/mock";
import { matchResearch, researchActives, researchFertilizers, researchFor, researchPractices, RESEARCH } from "@/lib/research";
import { containsDosage, finalizeTriage } from "@/lib/triage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("suspect research", () => {
  it("matches diseases, pests, and deficiencies in English and Swahili", () => {
    expect(matchResearch("early blight")?.id).toBe("early-blight");
    expect(matchResearch("Purple blotch on onion")?.id).toBe("purple-blotch");
    expect(matchResearch("Cercospora leaf spot on beetroot")?.id).toBe("cercospora");
    expect(matchResearch("madoa meusi kwenye majani")?.id).toBe("leaf-spot");
    expect(matchResearch("thrips")?.id).toBe("thrips");
    expect(matchResearch("mites curl young chili fruit")?.id).toBe("spider-mites");
    expect(matchResearch("whitefly")?.id).toBe("whitefly");
    expect(matchResearch("nzi weupe")?.id).toBe("whitefly");
    expect(matchResearch("nitrogen deficiency")?.id).toBe("nitrogen-deficiency");
    expect(matchResearch("yellow leaves, probably low nitrogen")?.id).toBe("nitrogen-deficiency");
    expect(matchResearch("upungufu wa virutubishi")?.id).toBe("nutrient-deficiency");
    expect(matchResearch("fusarium wilt")?.id).toBe("fusarium-wilt");
    expect(matchResearch("mystery shimmer")?.id ?? null).toBeNull();
    expect(matchResearch("")?.id ?? null).toBeNull();
  });

  it("prefers the longest match and falls back to the settled issue", () => {
    expect(matchResearch("early blight and leaf spots")?.id).toBe("early-blight");
    expect(matchResearch("thrips and spider mites")?.id).toBe("spider-mites");
    expect(matchResearch("sucking pests on the leaves")?.id).toBe("sucking-pests");
    expect(researchFor("", "spots")?.id).toBe("leaf-spot");
    expect(researchFor("", "insects")?.id).toBe("sucking-pests");
    expect(researchFor("", "curl")?.id).toBe("sucking-pests");
    expect(researchFor("", "yellowing")?.id).toBe("nitrogen-deficiency");
    expect(researchFor("", "wilt")?.id).toBe("damping-off");
    expect(researchFor("", null)?.id ?? null).toBeNull();
    expect(researchFor("thrips", "curl")?.id).toBe("thrips");
  });

  it("resolves every researched name to a catalog entry with three shop bands", () => {
    expect(RESEARCH.length).toBeGreaterThan(10);
    for (const entry of RESEARCH) {
      expect(entry.practices.en.length).toBeGreaterThanOrEqual(2);
      expect(entry.practices.sw.length).toBe(entry.practices.en.length);
      for (const active of entry.actives) {
        const found = matchCatalog(active);
        expect(found, active).not.toBeNull();
        expect(found?.kind).toBe("chemical");
        expect(found?.offers).toHaveLength(3);
      }
      for (const fertilizer of entry.fertilizers) {
        const found = matchCatalog(fertilizer);
        expect(found, fertilizer).not.toBeNull();
        expect(found?.kind).toBe("fertilizer");
        expect(found?.offers).toHaveLength(3);
      }
      for (const locale of ["en", "sw"] as const) {
        for (const line of entry.practices[locale]) {
          const filled = line.split("{plant}").join(locale === "sw" ? "Kale" : "Kale");
          expect(containsDosage(filled), filled).toBe(false);
          expect(filled.toLowerCase()).not.toMatch(/\b(onions?|kitunguu|beetroots?|\bbeets?\b|chilis?|chillies|pilipili|tomatoes?|nyanya)\b/);
        }
      }
    }
    expect(AGROVET_CATALOG.some((entry) => entry.kind === "fertilizer")).toBe(true);
  });

  it("fills practices with the plant name", () => {
    const entry = researchFor("early blight", "spots");
    expect(researchPractices(entry, "en", "Tomato")[0]).toContain("Tomato");
    expect(researchPractices(entry, "sw", "Nyanya")[0]).toContain("Nyanya");
    expect(researchPractices(null, "en", "Tomato")).toEqual([]);
    expect(researchActives(entry).map((item) => item.activeIngredient)).toEqual(["Mancozeb", "Copper oxychloride"]);
    expect(researchFertilizers(entry)).toEqual([]);
    const deficiency = researchFor("nitrogen deficiency", "yellowing");
    expect(researchActives(deficiency)).toEqual([]);
    expect(researchFertilizers(deficiency).length).toBe(2);
  });
});

describe("researched mitigation in the reading", () => {
  it("orders mitigations as model, research, then story", () => {
    const counts = emptyConceptCounts();
    const specific = finalizeTriage({
      locale: "en",
      plantName: "tomato",
      observations: ["Round spots with pale centres on the lower leaves."],
      likelyCauses: [],
      mitigations: [],
      actions: ["Compare a spotted leaf with a clean leaf.", "Note when the spots started.", "Take this photo to an agrovet."],
      confidence: "medium",
      confidenceScore: 0.6,
      counts,
      context: emptyFarmerContext(),
      symptom: "spots",
      suspect: "early blight",
    });
    expect(specific.issue).toBe("spots");
    expect(specific.mitigations).toHaveLength(3);
    expect(specific.mitigations[0]).toContain("Pull the worst spotted lower leaves");

    const modelFirst = finalizeTriage({
      locale: "en",
      plantName: "tomato",
      observations: ["Round spots with pale centres on the lower leaves."],
      likelyCauses: [],
      mitigations: ["Model step about these spots on tomato."],
      actions: ["Compare a spotted leaf with a clean leaf.", "Note when the spots started.", "Take this photo to an agrovet."],
      confidence: "medium",
      confidenceScore: 0.6,
      counts,
      context: emptyFarmerContext(),
      symptom: "spots",
      suspect: "early blight",
    });
    expect(modelFirst.mitigations[0]).toBe("Model step about these spots on Tomato.");
    expect(modelFirst.mitigations[1]).toContain("Pull the worst spotted lower leaves");
  });

  it("advises fertilizer with shops when yellowing points to feeding", () => {
    const advice = adviseChemicals({
      locale: "en",
      diseaseIndicated: true,
      suspect: "nitrogen deficiency",
      chemicals: researchFertilizers(researchFor("nitrogen deficiency", "yellowing")),
    });
    expect(advice?.products.map((product) => product.activeIngredient)).toEqual([
      "Calcium ammonium nitrate (CAN)",
      "NPK 17-17-17",
    ]);
    expect(advice?.products[0]?.productClass).toBe("fertilizer");
    expect(advice?.products[0]?.offers).toHaveLength(3);
    expect(advice?.verifyNote.toLowerCase()).toContain("fertilizer");
    expect(advice?.lookup).toBe("catalog");
    for (const product of advice?.products ?? []) {
      expect(containsDosage(`${product.activeIngredient} ${product.productClass} ${product.useNote}`)).toBe(false);
    }

    const sw = adviseChemicals({
      locale: "sw",
      diseaseIndicated: true,
      suspect: "nitrogen deficiency",
      chemicals: researchFertilizers(researchFor("nitrogen deficiency", "yellowing")),
    });
    expect(sw?.products[0]?.productClass).toBe("mbolea");
    expect(sw?.products[0]?.useNote).toContain("Kipimo kifuate kibandiko cha bidhaa");
    expect(sw?.verifyNote).toContain("mbolea");
  });

  it("keeps wilt and plain curl free of chemicals in the demo", () => {
    const wilt = buildMockResult({
      scenario: 0,
      locale: "en",
      width: 640,
      height: 480,
      mime: "image/jpeg",
      id: "wilt",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "kale",
      context: { ...emptyFarmerContext(), issues: "the plants are wilting" },
    });
    expect(wilt.chemicals).toBeNull();
    expect(wilt.mitigations.length).toBeGreaterThan(1);

    const curl = buildMockResult({
      scenario: 1,
      locale: "en",
      width: 900,
      height: 1200,
      mime: "image/jpeg",
      id: "curl",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "tomato",
      context: { ...emptyFarmerContext(), notes: "What could be the cause of the curling?" },
    });
    expect(curl.chemicals).toBeNull();

    const yellow = buildMockResult({
      scenario: 0,
      locale: "en",
      width: 900,
      height: 1200,
      mime: "image/jpeg",
      id: "yellow",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "kale",
      context: { ...emptyFarmerContext(), issues: "lower leaves are turning yellow" },
    });
    expect(yellow.chemicals?.products.map((product) => product.activeIngredient)).toEqual([
      "Calcium ammonium nitrate (CAN)",
      "NPK 17-17-17",
    ]);
    expect(yellow.chemicals?.products[0]?.offers.length).toBe(3);
  });
});

describe("research behind the live model", () => {
  function bedOptions() {
    return {
      imageUrl: "data:image/jpeg;base64,aaaa",
      apiKey: "k".repeat(40),
      locale: "en" as const,
      counts: emptyConceptCounts(),
      context: emptyFarmerContext(),
      primaryCrop: null,
      farmerPlant: "kale",
    };
  }

  function readingResponse(reading: Record<string, unknown>): Response {
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reading) } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
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
        return readingResponse(reading);
      }),
    );
  }

  it("fills chemicals the model did not know when a spray is usual", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubModels({
      detectedPlant: "kale",
      symptom: "insects",
      observations: ["Tiny pale insects crowd the underside of the young leaves."],
      likelyCauses: ["Whitefly feeding on young kale."],
      mitigations: [],
      actions: ["Shake the plant and watch for a white cloud.", "Check under young leaves.", "Take a close photo to an agrovet."],
      confidence: "medium",
      confidenceScore: 0.62,
      contextAsk: "",
      diseaseIndicated: true,
      sprayIndicated: true,
      suspect: "whitefly",
      chemicals: [],
    });
    const result = await adviseBed(bedOptions());
    expect(result.triageSource).toBe("muse");
    expect(result.chemicals?.products.map((product) => product.activeIngredient)).toEqual([
      "Lambda-cyhalothrin",
      "Abamectin",
    ]);
    expect(result.chemicals?.lookup).toBe("catalog");
    expect(result.mitigations.join(" ")).toContain("white cloud");
  });

  it("answers a named deficiency with fertilizer instead of a spray", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubModels({
      detectedPlant: "kale",
      symptom: "yellowing",
      observations: ["Oldest kale leaves are evenly yellow while new growth stays green."],
      likelyCauses: ["Nitrogen shortage in older kale leaves."],
      mitigations: [],
      actions: ["Compare old and new leaves.", "Feel the soil before watering.", "Photograph again in two days."],
      confidence: "medium",
      confidenceScore: 0.6,
      contextAsk: "",
      diseaseIndicated: true,
      suspect: "nitrogen deficiency",
      chemicals: [],
    });
    const result = await adviseBed(bedOptions());
    expect(result.triageSource).toBe("muse");
    expect(result.chemicals?.products.map((product) => product.activeIngredient)).toEqual([
      "Calcium ammonium nitrate (CAN)",
      "NPK 17-17-17",
    ]);
    expect(result.chemicals?.verifyNote.toLowerCase()).toContain("fertilizer");
  });

  it("tells the model to name the suspect and leave product lookup to the server", () => {
    expect(developerPrompt("en")).toContain("the server looks up matching chemicals, fertilizer, and practices");
    expect(developerPrompt("en")).toContain("name the deficiency in suspect");
  });
});
