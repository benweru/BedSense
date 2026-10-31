import { describe, expect, it } from "vitest";
import { severityFor } from "@/lib/severity";
import { sinceLastVisit } from "@/lib/since-last-visit";

const counts = { onion: 0, beetroot: 0, chili: 1, plant: 1, "yellow-leaf": 0, weed: 0 };
const base = { counts, likelyCauses: [], mitigations: [], chemicals: null, confidence: "medium" as const, qualityHold: null, progress: null };

describe("severityFor", () => {
  it("is healthy when nothing concrete showed up", () => {
    expect(severityFor(base)).toBe("healthy");
  });
  it("is watch when there are causes or weeds", () => {
    expect(severityFor({ ...base, likelyCauses: ["Water stress"] })).toBe("watch");
    expect(severityFor({ ...base, counts: { ...counts, weed: 2 } })).toBe("watch");
  });
  it("is act when the plant is declining or a confident symptom has a cause", () => {
    expect(severityFor({ ...base, progress: { growthTrend: "declining", flowering: null, sinceLastCheck: null } })).toBe("act");
    expect(severityFor({ ...base, confidence: "high", likelyCauses: ["Mites"], counts: { ...counts, "yellow-leaf": 1 } })).toBe("act");
  });
  it("returns null on a quality hold", () => {
    expect(severityFor({ ...base, qualityHold: "too_far" })).toBeNull();
  });
});

describe("sinceLastVisit", () => {
  it("returns null without an earlier check", () => {
    expect(sinceLastVisit([], "en")).toBeNull();
    expect(sinceLastVisit([{ createdAt: "2026-10-30T08:00:00Z", counts }], "en")).toBeNull();
  });
  it("compares weed counts with the previous check", () => {
    const line = sinceLastVisit(
      [
        { createdAt: "2026-10-12T08:00:00Z", counts: { ...counts, weed: 4 } },
        { createdAt: "2026-10-30T08:00:00Z", counts: { ...counts, weed: 1 } },
      ],
      "en",
    );
    expect(line).toBe("Weeds down since 12 Oct");
  });
  it("falls back to the saved progress note, then to no change", () => {
    const a = { createdAt: "2026-10-12T08:00:00Z", counts };
    expect(sinceLastVisit([a, { createdAt: "2026-10-30T08:00:00Z", counts, sinceLastCheck: "New leaves came in." }], "en")).toBe("New leaves came in.");
    expect(sinceLastVisit([a, { createdAt: "2026-10-30T08:00:00Z", counts }], "en")).toBe("No change in marks since 12 Oct");
  });
  it("speaks Swahili", () => {
    const line = sinceLastVisit(
      [
        { createdAt: "2026-10-12T08:00:00Z", counts: { ...counts, weed: 1 } },
        { createdAt: "2026-10-30T08:00:00Z", counts: { ...counts, weed: 3 } },
      ],
      "sw",
    );
    expect(line).toMatch(/^Magugu yameongezeka tangu /);
  });
});
