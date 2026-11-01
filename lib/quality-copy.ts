import { copy } from "@/lib/copy";
import type { PhotoVerdict } from "@/lib/photo-quality";
import type { AnalyzeResult, Locale } from "@/lib/types";

export type QualityHold = NonNullable<AnalyzeResult["qualityHold"]>;
export type QualityBatch = NonNullable<AnalyzeResult["qualityBatch"]>;

/** Which hold a batch of rejected frames resolves to. */
export function holdFor(verdicts: readonly PhotoVerdict[]): QualityHold {
  const rejected = verdicts.filter((verdict) => verdict !== "use");
  if (rejected.every((verdict) => verdict === "too_far")) return "too_far";
  if (rejected.every((verdict) => verdict === "unclear")) return "unclear";
  if (rejected.every((verdict) => verdict === "harsh_light")) return "harsh_light";
  return "mixed";
}

/** The hold message, built from codes so it can be shown in either language. */
export function qualityMessageFor(locale: Locale, hold: QualityHold, verdicts: readonly PhotoVerdict[]): string {
  const text = copy[locale];
  const dark = verdicts.flatMap((verdict, index) => (verdict === "harsh_light" ? [index + 1] : []));
  const lighting = dark.length > 0 ? text.qualityHarshLight(dark, verdicts.length) : "";
  if (hold === "not_plant") return text.qualityNotPlant;
  if (hold === "too_far") return text.qualityTooFar;
  if (hold === "unclear") return text.qualityUnclear;
  if (hold === "harsh_light") return lighting;
  return [text.qualityMixed, lighting].filter(Boolean).join(" ");
}

export function qualityNoteFor(locale: Locale, batch: QualityBatch | null | undefined): string | null {
  if (!batch || batch.skipped.length === 0) return null;
  return copy[locale].qualityBatch(batch.kept, batch.skipped);
}
