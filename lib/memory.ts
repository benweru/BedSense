import { containsDosage } from "@/lib/triage";
import {
  GROWTH_TRENDS,
  type AnalyzeResult,
  type GrowthTrend,
  type PlantProgress,
  type PlantRecord,
  type PracticeLog,
} from "@/lib/types";

const DAY_MS = 86_400_000;
export const MEMORY_CHECKS = 4;
export const MEMORY_PRACTICES = 8;
export const RECHECK_AFTER_DAYS = 2;
const LINE_LIMIT = 220;
const BLOCK_LIMIT = 2_400;

/** The slice of an earlier check the model needs. */
export type MemoryCheck = {
  createdAt: string;
  result: Pick<AnalyzeResult, "observations" | "likelyCauses" | "actions" | "qualityHold" | "progress">;
};

export function daysBetween(from: string | Date, to: string | Date): number | null {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / DAY_MS));
}

/** Kenya's two rainy seasons. Most BedSense farmers grow on this calendar. */
export function seasonFor(date: Date): string {
  const month = date.getUTCMonth();
  if (month >= 2 && month <= 4) return "long rains (March to May)";
  if (month >= 5 && month <= 8) return "cool dry season (June to September)";
  if (month >= 9 && month <= 11) return "short rains (October to December)";
  return "hot dry season (January to February)";
}

export function recheckDue(lastCheckAt: string | null, now: Date): boolean {
  if (!lastCheckAt) return false;
  const days = daysBetween(lastCheckAt, now);
  return days !== null && days >= RECHECK_AFTER_DAYS;
}

export function memoryPromptBlock(
  plant: PlantRecord,
  checks: readonly MemoryCheck[],
  practices: readonly PracticeLog[],
  now: Date,
): string {
  const usable = [...checks]
    .filter((check) => !check.result.qualityHold)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MEMORY_CHECKS);
  const lines = [`Plant memory for "${clean(plant.name)}"${plant.bedLabel ? ` on bed "${clean(plant.bedLabel)}"` : ""}:`];
  const age = plant.plantedOn ? daysBetween(plant.plantedOn, now) : null;
  if (age !== null) lines.push(`- Planted ${age} days ago.`);
  lines.push(`- Season now: ${seasonFor(now)}${plant.location ? ` near ${clean(plant.location)}` : ""}.`);

  if (usable.length === 0) {
    lines.push("- No earlier readable check of this plant. Treat this photo as the baseline.");
    return cap(lines.join("\n"));
  }

  const last = usable[0];
  const gap = last ? daysBetween(last.createdAt, now) : null;
  if (gap !== null) lines.push(`- Last check was ${gap} days ago.`);
  for (const check of usable) {
    const when = daysBetween(check.createdAt, now);
    const seen = safeJoin(check.result.observations.slice(0, 2));
    const causes = safeJoin(check.result.likelyCauses.slice(0, 2));
    const advice = safeJoin(check.result.actions.filter(Boolean));
    const parts = [seen && `seen: ${seen}`, causes && `suspected: ${causes}`, advice && `advised: ${advice}`].filter(Boolean);
    if (parts.length > 0) lines.push(`- ${when ?? "?"} days ago, ${parts.join("; ")}.`);
  }

  const since = last ? practices.filter((log) => log.loggedAt >= last.createdAt) : practices;
  const recent = [...since].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)).slice(0, MEMORY_PRACTICES);
  if (recent.length > 0) {
    lines.push("Farmer actions since the last check:");
    for (const log of recent) {
      const note = clean(log.note);
      if (note && !containsDosage(note)) lines.push(`- ${log.kind}: ${note}`);
    }
  } else {
    lines.push("- Farmer logged no actions since the last check.");
  }

  lines.push(
    "Compare this photo with that history: growth since last time, flowering or fruiting, and whether the earlier advice seems to have helped.",
    'Add "growthTrend" (improving, stable, or declining), "flowering" (true or false), and "sinceLastCheck" (one short sentence on what changed) to the JSON.',
    "Do not repeat earlier advice that is already done. Do not repeat a spray dose.",
  );
  return cap(lines.join("\n"));
}

export function parseProgress(value: { growthTrend?: unknown; flowering?: unknown; sinceLastCheck?: unknown }): PlantProgress | null {
  const trend = typeof value.growthTrend === "string" ? value.growthTrend.trim().toLowerCase() : "";
  const growthTrend = (GROWTH_TRENDS as readonly string[]).includes(trend) ? (trend as GrowthTrend) : null;
  const flowering = value.flowering === true || value.flowering === "true" ? true : value.flowering === false || value.flowering === "false" ? false : null;
  const note = typeof value.sinceLastCheck === "string" ? clean(value.sinceLastCheck) : "";
  const sinceLastCheck = note && !containsDosage(note) ? note : null;
  if (!growthTrend && flowering === null && !sinceLastCheck) return null;
  return { growthTrend, flowering, sinceLastCheck };
}

function safeJoin(items: readonly string[]): string {
  return items.map(clean).filter((item) => item && !containsDosage(item)).join(" / ");
}

function clean(value: string): string {
  const text = value.replace(/[\u0000-\u001f"]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > LINE_LIMIT ? `${text.slice(0, LINE_LIMIT - 1).trimEnd()}…` : text;
}

function cap(text: string): string {
  return text.length > BLOCK_LIMIT ? `${text.slice(0, BLOCK_LIMIT - 1).trimEnd()}…` : text;
}
