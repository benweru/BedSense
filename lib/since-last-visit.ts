import type { ConceptCounts, Locale } from "@/lib/types";

export type VisitCheck = {
  createdAt: string;
  counts?: Partial<ConceptCounts> | null;
  sinceLastCheck?: string | null;
};

const LABEL: Record<Locale, { weed: string; "yellow-leaf": string }> = {
  en: { weed: "Weeds", "yellow-leaf": "Yellow leaves" },
  sw: { weed: "Magugu", "yellow-leaf": "Majani ya njano" },
};

/**
 * One line comparing the newest check with the one before it, built only from saved plant-memory checks.
 * Returns null when there is no earlier check, so nothing is shown.
 */
export function sinceLastVisit(checks: readonly VisitCheck[], locale: Locale): string | null {
  if (checks.length < 2) return null;
  const sorted = [...checks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [latest, earlier] = sorted;
  const date = new Intl.DateTimeFormat(locale === "sw" ? "sw-KE" : "en-GB", { day: "numeric", month: "short", timeZone: "Africa/Nairobi" }).format(new Date(earlier.createdAt));
  const parts: string[] = [];
  for (const id of ["weed", "yellow-leaf"] as const) {
    const now = latest.counts?.[id];
    const then = earlier.counts?.[id];
    if (typeof now !== "number" || typeof then !== "number" || now === then) continue;
    const down = now < then;
    parts.push(
      locale === "sw"
        ? `${LABEL.sw[id]} ${down ? "yamepungua" : "yameongezeka"}`
        : `${LABEL.en[id]} ${down ? "down" : "up"}`,
    );
  }
  if (parts.length > 0) return locale === "sw" ? `${parts.join(", ")} tangu ${date}` : `${parts.join(", ")} since ${date}`;
  const note = latest.sinceLastCheck?.trim();
  if (note) return note;
  return locale === "sw" ? `Hakuna mabadiliko kwenye alama tangu ${date}` : `No change in marks since ${date}`;
}
