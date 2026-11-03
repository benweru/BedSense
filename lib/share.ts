import type { AnalyzeResult, Locale } from "@/lib/types";

/** Canonical public URL printed on the share card. Override per deploy with NEXT_PUBLIC_SITE_URL. */
export const SHARE_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://bedsense.vercel.app";

export type ShareSummary = {
  plant: string;
  finding: string;
  action: string;
};

/** The three lines of a share card: the plant, the top finding, the first next step. Never throws on thin results. */
export function selectShareSummary(result: AnalyzeResult): ShareSummary {
  const plant = result.farmerPlant || result.detectedPlant;
  const finding = result.likelyCauses[0] ?? result.observations[0] ?? "";
  const action = result.actions[0] ?? "";
  return { plant, finding, action };
}

const INTENT_TEXT: Record<Locale, (summary: ShareSummary) => string> = {
  en: (summary) => `My ${summary.plant} check: ${summary.finding} Next step: ${summary.action}`,
  sw: (summary) => `Ukaguzi wa ${summary.plant}: ${summary.finding} Hatua: ${summary.action}`,
};

/** X counts every link as 23 characters, so the text keeps 240 to stay safely inside one post. */
const INTENT_TEXT_BUDGET = 240;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Prefilled X post for a check: encoded text plus the site link, both configurable through lib/share.ts. */
export function buildShareIntent(locale: Locale, summary: ShareSummary): string {
  const text = truncate(INTENT_TEXT[locale](summary), INTENT_TEXT_BUDGET);
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_SITE_URL)}`;
}
