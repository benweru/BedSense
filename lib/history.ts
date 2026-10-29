import type { AnalyzeResult, HistoryEntry } from "@/lib/types";

export const HISTORY_KEY = "bedsense.checks.v1";
export const LOCALE_KEY = "bedsense.locale";
export const HISTORY_LIMIT = 5;

export function rememberCheck(existing: readonly HistoryEntry[], next: HistoryEntry): HistoryEntry[] {
  return [next, ...existing.filter((entry) => entry.id !== next.id)].slice(0, HISTORY_LIMIT);
}

export function forgetCheck(existing: readonly HistoryEntry[], id: string): HistoryEntry[] {
  return existing.filter((entry) => entry.id !== id);
}

export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function serializeHistory(entries: readonly HistoryEntry[]): string {
  return JSON.stringify(entries.slice(0, HISTORY_LIMIT));
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HistoryEntry>;
  if (typeof entry.id !== "string" || typeof entry.createdAt !== "string") return false;
  if (typeof entry.thumbnail !== "string" || !entry.thumbnail.startsWith("data:image/")) return false;
  const result = entry.result as Partial<AnalyzeResult> | undefined;
  return Array.isArray(result?.actions) && result.actions.length === 3 && typeof result.id === "string";
}
