import { describe, expect, it } from "vitest";
import { daysBetween, memoryPromptBlock, nextRecheckAt, parseProgress, recheckDue, recheckDueAt, resolveRecheckDays, seasonFor, type MemoryCheck } from "@/lib/memory";
import { emptyConceptCounts } from "@/lib/concepts";
import type { PlantRecord, PracticeLog } from "@/lib/types";

const NOW = new Date("2026-10-29T12:00:00Z");

const plant: PlantRecord = {
  id: "p1",
  name: "Chili",
  crop: "chili",
  bedLabel: "Bed 3",
  plantedOn: "2026-09-29",
  location: null,
  createdAt: "2026-09-29T00:00:00Z",
};

function check(createdAt: string, observation: string, extra: Partial<MemoryCheck["result"]> = {}): MemoryCheck {
  return {
    createdAt,
    result: {
      observations: [observation],
      likelyCauses: ["aphids"],
      actions: ["Look under leaves", "Check new growth", "Check soil"],
      qualityHold: null,
      ...extra,
    },
  };
}

describe("day and season helpers", () => {
  it("counts whole days and never goes negative", () => {
    expect(daysBetween("2026-10-26T12:00:00Z", NOW)).toBe(3);
    expect(daysBetween("2026-11-01T00:00:00Z", NOW)).toBe(0);
    expect(daysBetween("not a date", NOW)).toBeNull();
  });

  it("maps months to the Kenyan rain calendar", () => {
    expect(seasonFor(new Date("2026-04-10T00:00:00Z"))).toMatch(/long rains/);
    expect(seasonFor(new Date("2026-07-10T00:00:00Z"))).toMatch(/cool dry/);
    expect(seasonFor(NOW)).toMatch(/short rains/);
    expect(seasonFor(new Date("2026-01-10T00:00:00Z"))).toMatch(/hot dry/);
  });

  it("flags a re-check after two days", () => {
    expect(recheckDue("2026-10-28T12:00:00Z", NOW)).toBe(false);
    expect(recheckDue("2026-10-27T11:00:00Z", NOW)).toBe(true);
    expect(recheckDue(null, NOW)).toBe(false);
  });
});

describe("adaptive recheck interval", () => {
  const base = {
    counts: emptyConceptCounts(),
    likelyCauses: [] as string[],
    mitigations: [] as string[],
    chemicals: null,
    confidence: "high" as const,
    qualityHold: null,
    progress: null,
  };

  it("uses the model's judged interval, clamped to 1-14 days", () => {
    expect(resolveRecheckDays({ ...base, recheckDays: 5 })).toBe(5);
    expect(resolveRecheckDays({ ...base, recheckDays: 0 })).toBe(1);
    expect(resolveRecheckDays({ ...base, recheckDays: 30 })).toBe(14);
    expect(resolveRecheckDays({ ...base, recheckDays: 3.6 })).toBe(4);
  });

  it("falls back by severity when the model gave no interval", () => {
    expect(resolveRecheckDays({ ...base, qualityHold: "unclear" })).toBe(1);
    expect(resolveRecheckDays({ ...base, likelyCauses: ["fungus"], chemicals: { suspect: "leaf spot", verifyNote: "", priceNote: "", lookup: "catalog", products: [{ activeIngredient: "mancozeb", productClass: "fungicide", useNote: "", offers: [] }] } })).toBe(2);
    expect(resolveRecheckDays({ ...base, likelyCauses: ["aphids"] })).toBe(3);
    expect(resolveRecheckDays({ ...base })).toBe(7);
    expect(resolveRecheckDays({ ...base, progress: { growthTrend: "declining", flowering: null, sinceLastCheck: null } })).toBe(2);
  });

  it("computes the due date and whether it has arrived", () => {
    const next = nextRecheckAt("2026-10-29T12:00:00Z", 3);
    expect(next).toBe("2026-11-01T12:00:00.000Z");
    expect(recheckDueAt(next, NOW)).toBe(false);
    expect(recheckDueAt(next, new Date("2026-11-02T00:00:00Z"))).toBe(true);
    expect(recheckDueAt(null, NOW)).toBe(false);
    expect(nextRecheckAt("not a date", 3)).toBeNull();
  });

  it("asks for a treatment verdict when a spray or feed was logged since the last check", () => {
    const sprayed: PracticeLog[] = [{ id: "a1", plantId: "p1", loggedAt: "2026-10-28T09:00:00Z", kind: "spray", note: "Sprayed the bed" }];
    const block = memoryPromptBlock(plant, [check("2026-10-27T12:00:00Z", "spots")], sprayed, NOW);
    expect(block).toMatch(/whether the symptom looks better, the same, or worse/);
    const watered: PracticeLog[] = [{ id: "a2", plantId: "p1", loggedAt: "2026-10-28T09:00:00Z", kind: "watering", note: "Watered" }];
    expect(memoryPromptBlock(plant, [check("2026-10-27T12:00:00Z", "spots")], watered, NOW)).not.toMatch(/whether the symptom looks better/);
  });
});

describe("memoryPromptBlock", () => {
  it("treats a plant with no readable checks as a baseline", () => {
    const text = memoryPromptBlock(plant, [check("2026-10-27T00:00:00Z", "blurry", { qualityHold: "unclear" })], [], NOW);
    expect(text).toMatch(/baseline/);
    expect(text).toMatch(/Planted 30 days ago/);
    expect(text).not.toMatch(/growthTrend/);
  });

  it("lists newest checks first and asks for progress fields", () => {
    const text = memoryPromptBlock(
      plant,
      [check("2026-10-20T12:00:00Z", "older note"), check("2026-10-26T12:00:00Z", "curled leaves")],
      [],
      NOW,
    );
    expect(text.indexOf("curled leaves")).toBeLessThan(text.indexOf("older note"));
    expect(text).toMatch(/Last check was 3 days ago/);
    expect(text).toMatch(/growthTrend/);
    expect(text).toMatch(/no actions since/);
  });

  it("keeps only practices since the last check and drops dosage text", () => {
    const logs: PracticeLog[] = [
      { id: "a", plantId: "p1", loggedAt: "2026-10-27T08:00:00Z", kind: "watering", note: "Watered every morning" },
      { id: "b", plantId: "p1", loggedAt: "2026-10-28T08:00:00Z", kind: "spray", note: "Sprayed 20 ml per litre" },
      { id: "c", plantId: "p1", loggedAt: "2026-10-01T08:00:00Z", kind: "pruning", note: "Old pruning" },
    ];
    const text = memoryPromptBlock(plant, [check("2026-10-26T12:00:00Z", "curled leaves")], logs, NOW);
    expect(text).toMatch(/watering: Watered every morning/);
    expect(text).not.toMatch(/20 ml/);
    expect(text).not.toMatch(/Old pruning/);
  });

  it("caps the block length", () => {
    const long = "x".repeat(1_000);
    const checks = Array.from({ length: 10 }, (_, index) => check(`2026-10-${String(10 + index).padStart(2, "0")}T00:00:00Z`, long));
    expect(memoryPromptBlock(plant, checks, [], NOW).length).toBeLessThanOrEqual(2_400);
  });
});

describe("parseProgress", () => {
  it("reads valid fields and drops junk", () => {
    expect(parseProgress({ growthTrend: "Improving", flowering: "true", sinceLastCheck: "New flowers opened." })).toEqual({
      growthTrend: "improving",
      flowering: true,
      sinceLastCheck: "New flowers opened.",
    });
    expect(parseProgress({ growthTrend: "huge", flowering: 3, sinceLastCheck: "" })).toBeNull();
    expect(parseProgress({ sinceLastCheck: "Sprayed 10 ml per litre" })).toBeNull();
  });
});
