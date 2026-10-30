import { describe, expect, it, vi } from "vitest";
import { AGROVET_CATALOG } from "@/lib/agrovet-catalog";
import { adviseChemicals } from "@/lib/agrovet";
import { emptyConceptCounts } from "@/lib/concepts";
import { emptyFarmerContext } from "@/lib/context";
import { copy } from "@/lib/copy";
import { issueTriage, type IssueId } from "@/lib/issues";
import { ISSUE_IDS } from "@/lib/issues";
import { buildMockResult } from "@/lib/server/mock";
import { RESEARCH } from "@/lib/research";
import { finalizeTriage } from "@/lib/triage";
import { glossaryToSwahili, needsSwahiliRepair, repairSentence, repairSentences, repairSuspect } from "@/lib/translate";
import { POST } from "@/app/api/analyze/route";
import { pngDataUrl } from "@/tests/sam-fixture";

const counts = emptyConceptCounts();

/** Every shipped Swahili string: UI copy, catalog notes, issue lines, and research practices. */
function shippedSwahili(): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.trim()) found.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) walk(item);
    }
  };
  walk(copy.sw);
  const text = copy.sw;
  found.push(
    text.qualityHarshLight([1], 1),
    text.qualityHarshLight([1, 2], 2),
    text.qualityBatch([1], [{ frame: 2, lighting: true }]),
    text.qualityBatch([1, 2], [{ frame: 3, lighting: false }]),
    text.plantLine({ detectedPlant: "Nyanya", cropFocus: "unknown", primaryCrop: null }),
    text.plantLine({ detectedPlant: "Kitunguu", cropFocus: "mixed", primaryCrop: "onion" }),
    text.plantLine({ detectedPlant: "", cropFocus: "unknown", primaryCrop: null }),
    text.countLine(counts),
    text.countLine({ ...counts, onion: 2, "yellow-leaf": 1 }),
    text.segmentFailed("Kitunguu"),
    text.levelLabel("low"),
    text.levelLabel("medium"),
    text.levelLabel("high"),
  );
  for (const entry of AGROVET_CATALOG) {
    found.push(entry.useNote.sw, entry.productClass.sw);
    for (const offer of entry.offers) found.push(offer.shopKind.sw);
  }
  for (const issue of ISSUE_IDS) {
    const story = issueTriage("sw", "Kale", issue);
    found.push(...story.observations, ...story.hypotheses, ...story.mitigations, ...story.actions);
  }
  for (const entry of RESEARCH) {
    found.push(...entry.practices.sw.map((line) => line.split("{plant}").join("Kale")));
  }
  return found;
}

describe("Swahili drift detector", () => {
  it("flags English field sentences and leaves Swahili and short labels alone", () => {
    expect(needsSwahiliRepair("Remove the worst spotted leaves off the bed.")).toBe(true);
    expect(needsSwahiliRepair("Check the soil before you water.")).toBe(true);
    expect(needsSwahiliRepair("When did you last water?")).toBe(true);
    expect(needsSwahiliRepair("Ondoa majani yenye madoa zaidi ya Kale na uyatoe nje ya kitanda.")).toBe(false);
    expect(needsSwahiliRepair("Madoa ya Cercospora kwenye beetroot")).toBe(false);
    expect(needsSwahiliRepair("spots")).toBe(false);
    expect(needsSwahiliRepair("")).toBe(false);
  });

  it("never flags a shipped Swahili string", () => {
    // The kicker is the one brand line that stays English in both locales. It is UI copy, never model text, so repair never sees it.
    const shipped = shippedSwahili().filter((sentence) => sentence !== copy.sw.kicker);
    expect(shipped.length).toBeGreaterThan(100);
    for (const sentence of shipped) {
      expect(needsSwahiliRepair(sentence), sentence).toBe(false);
      expect(repairSentence("sw", sentence), sentence).toBe(sentence);
    }
  });
});

describe("Swahili glossary repair", () => {
  it("moves common field terms to Kiswahili", () => {
    expect(glossaryToSwahili("Remove the worst spotted leaves off the bed.")).toContain("majani yenye madoa");
    expect(glossaryToSwahili("Check the soil before you water.")).toContain("udongo");
    expect(glossaryToSwahili("Check the soil before you water.")).toContain("kumwagilia");
    expect(glossaryToSwahili("Take this photo to an agrovet.")).toBe("Peleka picha hii kwa agrovet.");
    expect(glossaryToSwahili("When did you last water?")).toContain("mara ya mwisho");
    const repaired = glossaryToSwahili("Remove the worst spotted leaves off the bed.");
    expect(repaired).not.toMatch(/\bthe\b/i);
    expect(repaired[0]).toBe(repaired[0]?.toUpperCase());
  });

  it("keeps fertilizer names, disease names, and shop tokens intact", () => {
    expect(glossaryToSwahili("Apply CAN around the plants.")).toContain("CAN");
    expect(glossaryToSwahili("Apply CAN around the plants.")).toContain("mimea");
    expect(glossaryToSwahili("Feed NPK 17-17-17 to yellow plants.")).toContain("NPK 17-17-17");
    expect(glossaryToSwahili("This looks like early blight.")).toContain("early blight");
    expect(glossaryToSwahili("The price is KES 500.")).toContain("KES 500");
  });

  it("repairs suspect labels but keeps the disease name", () => {
    expect(repairSuspect("sw", "Purple blotch on onion")).toBe("Purple blotch kwenye Kitunguu");
    expect(repairSuspect("sw", "Thrips on chili")).toBe("Thrips kwenye Pilipili");
    expect(repairSuspect("sw", "early blight")).toBe("early blight");
    expect(repairSuspect("sw", "Madoa ya Cercospora kwenye beetroot")).toBe("Madoa ya Cercospora kwenye beetroot");
    expect(repairSuspect("en", "Purple blotch on onion")).toBe("Purple blotch on onion");
  });

  it("leaves English readings untouched", () => {
    const lines = ["Remove the worst spotted leaves off the bed.", "Check the soil before you water."];
    expect(repairSentences("en", lines)).toEqual(lines);
    expect(repairSentence("en", lines[0] ?? "")).toBe(lines[0]);
  });
});

describe("Swahili repair across the reading", () => {
  it("repairs English model text in a sw triage and keeps Swahili as written", () => {
    const drifted = finalizeTriage({
      locale: "sw",
      plantName: "tomato",
      observations: ["The lower leaves show dark spots across the bed."],
      likelyCauses: ["The spots are often a fungus after wet leaves."],
      mitigations: ["Remove the worst spotted leaves off the bed."],
      actions: ["Compare a spotted leaf with a clean leaf on the same plant.", "Note whether the spots started after rain.", "Take this photo to an agrovet."],
      confidence: "medium",
      confidenceScore: 0.6,
      counts,
      context: emptyFarmerContext(),
    });
    const joined = [...drifted.observations, ...drifted.likelyCauses, ...drifted.mitigations, ...drifted.actions].join(" ");
    expect(joined).toContain("majani");
    expect(joined).toContain("madoa");
    expect(joined).not.toMatch(/\bthe\b/i);
    expect(joined).not.toMatch(/\bleaves\b/i);

    const story = issueTriage("sw", "Nyanya", "spots" as IssueId);
    const clean = finalizeTriage({
      locale: "sw",
      plantName: "tomato",
      observations: [...story.observations],
      likelyCauses: [...story.hypotheses],
      mitigations: [...story.mitigations],
      actions: [...story.actions],
      confidence: "medium",
      confidenceScore: 0.6,
      counts,
      context: emptyFarmerContext(),
    });
    expect(clean.mitigations.slice(0, 2)).toEqual([...story.mitigations].slice(0, 2));
  });

  it("repairs English use notes and suspects in chemical advice", () => {
    const advice = adviseChemicals({
      locale: "sw",
      diseaseIndicated: true,
      suspect: "Purple blotch on onion",
      chemicals: [
        { activeIngredient: "mancozeb", productClass: "fungicide", useNote: "Protectant for leaf spots. The rate must follow the product label." },
      ],
    });
    expect(advice?.suspect).toBe("Purple blotch kwenye Kitunguu");
    expect(advice?.products[0]?.useNote).toContain("madoa ya majani");
    expect(advice?.products[0]?.useNote).toContain("kibandiko cha bidhaa");
    expect(advice?.products[0]?.useNote).not.toMatch(/\bthe\b/i);
  });

  it("answers a sw mock check in Kiswahili", () => {
    const result = buildMockResult({
      scenario: 2,
      locale: "sw",
      width: 900,
      height: 1200,
      mime: "image/jpeg",
      id: "sw",
      createdAt: "2026-10-25T12:00:00.000Z",
      plantName: "pilipili",
    });
    expect(result.observations.join(" ")).toContain("pilipili");
    expect(result.chemicals?.suspect).toContain("kwenye");
    expect(result.chemicals?.products[0]?.useNote).toContain("Kipimo kifuate kibandiko cha bidhaa");
  });

  it("localizes analyze errors and keeps English byte-identical", async () => {
    const sw = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: pngDataUrl(), locale: "sw", plantName: "  " }),
      }),
    );
    expect(sw.status).toBe(400);
    const swBody = (await sw.json()) as { error: string; message: string };
    expect(swBody.error).toBe("missing_plant");
    expect(swBody.message).toContain("Taja mmea");

    vi.stubEnv("MOCK_META", "1");
    const en = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: pngDataUrl(), plantName: "  " }),
      }),
    );
    const enBody = (await en.json()) as { error: string; message: string };
    expect(enBody.error).toBe("missing_plant");
    expect(enBody.message).toBe("Name the plant in the photo.");
    vi.unstubAllEnvs();
  });
});
