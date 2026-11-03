import { daysBetween, recheckDue } from "@/lib/memory";
import type { GrowthTrend, HistoryEntry } from "@/lib/types";

export type WatcherCheck = {
  createdAt: string;
  growthTrend: GrowthTrend | null;
};

export type WatcherVerdict =
  | { kind: "ok" }
  | { kind: "worsening"; streak: number; plant: string }
  | { kind: "overdue"; daysSince: number; plant: string };

/** Timeline for one plant out of phone history. Held (unreadable) checks carry no progress signal, so they are skipped. */
export function watcherChecksFor(history: readonly HistoryEntry[], plantName: string): WatcherCheck[] {
  const want = plantName.trim().toLowerCase();
  if (!want) return [];
  return history
    .filter((entry) => !entry.result.qualityHold)
    .filter((entry) =>
      [entry.result.farmerPlant, entry.result.detectedPlant].some((name) => name.trim().toLowerCase() === want),
    )
    .map((entry) => ({ createdAt: entry.createdAt, growthTrend: entry.result.progress?.growthTrend ?? null }));
}

/** The system's own read of the timeline: declining streaks escalate, then stale timelines. A single verdict wins. */
export function watchTimeline(checks: readonly WatcherCheck[], plant: string, now: Date): WatcherVerdict {
  const sorted = [...checks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  if (!latest) return { kind: "ok" };
  let streak = 0;
  for (const check of sorted) {
    if (check.growthTrend !== "declining") break;
    streak += 1;
  }
  if (streak > 0) return { kind: "worsening", streak, plant };
  if (recheckDue(latest.createdAt, now)) {
    return { kind: "overdue", daysSince: daysBetween(latest.createdAt, now) ?? 0, plant };
  }
  return { kind: "ok" };
}
