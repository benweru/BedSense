import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/lib/types";
import { watcherChecksFor, watchTimeline, type WatcherCheck } from "@/lib/watcher";

const NOW = new Date("2026-11-03T12:00:00.000Z");

function check(createdAt: string, growthTrend: WatcherCheck["growthTrend"]): WatcherCheck {
  return { createdAt, growthTrend };
}

function entry(createdAt: string, farmerPlant: string, growthTrend: WatcherCheck["growthTrend"], held = false): HistoryEntry {
  return {
    id: createdAt,
    createdAt,
    thumbnail: "",
    result: {
      farmerPlant,
      detectedPlant: farmerPlant,
      qualityHold: held,
      progress: growthTrend ? { growthTrend, flowering: null, sinceLastCheck: null } : null,
    } as unknown as HistoryEntry["result"],
  };
}

describe("watchTimeline", () => {
  it("escalates a declining streak", () => {
    expect(watchTimeline([check("2026-11-03T10:00:00.000Z", "declining")], "Kale", NOW)).toEqual({
      kind: "worsening",
      streak: 1,
      plant: "Kale",
    });
    expect(
      watchTimeline(
        [check("2026-11-03T10:00:00.000Z", "declining"), check("2026-11-02T10:00:00.000Z", "declining")],
        "Kale",
        NOW,
      ),
    ).toEqual({ kind: "worsening", streak: 2, plant: "Kale" });
  });

  it("counts only the leading streak and prefers worsening over overdue", () => {
    const verdict = watchTimeline(
      [
        check("2026-11-03T10:00:00.000Z", "declining"),
        check("2026-10-20T10:00:00.000Z", "improving"),
        check("2026-10-19T10:00:00.000Z", "declining"),
      ],
      "Kale",
      NOW,
    );
    expect(verdict).toEqual({ kind: "worsening", streak: 1, plant: "Kale" });
  });

  it("flags overdue timelines at the two-day boundary", () => {
    expect(watchTimeline([check("2026-10-31T12:00:00.000Z", "stable")], "Kale", NOW)).toEqual({
      kind: "overdue",
      daysSince: 3,
      plant: "Kale",
    });
    expect(watchTimeline([check("2026-11-01T12:00:00.000Z", "stable")], "Kale", NOW).kind).toBe("overdue");
    expect(watchTimeline([check("2026-11-02T12:00:00.000Z", "stable")], "Kale", NOW)).toEqual({ kind: "ok" });
  });

  it("stays quiet with no signal", () => {
    expect(watchTimeline([], "Kale", NOW)).toEqual({ kind: "ok" });
    expect(watchTimeline([check("2026-11-03T10:00:00.000Z", "improving")], "Kale", NOW)).toEqual({ kind: "ok" });
    expect(watchTimeline([check("2026-11-03T10:00:00.000Z", null)], "Kale", NOW)).toEqual({ kind: "ok" });
  });
});

describe("watcherChecksFor", () => {
  it("matches the plant by either name, case-insensitively, and skips held checks", () => {
    const history = [
      entry("2026-11-03T10:00:00.000Z", "Kale", "declining"),
      entry("2026-11-02T10:00:00.000Z", "kale", "stable"),
      entry("2026-11-01T10:00:00.000Z", "Tomato", "declining"),
      entry("2026-10-31T10:00:00.000Z", "Kale", "declining", true),
    ];
    expect(watcherChecksFor(history, "  KALE ")).toEqual([
      { createdAt: "2026-11-03T10:00:00.000Z", growthTrend: "declining" },
      { createdAt: "2026-11-02T10:00:00.000Z", growthTrend: "stable" },
    ]);
    expect(watcherChecksFor(history, "")).toEqual([]);
  });
});
