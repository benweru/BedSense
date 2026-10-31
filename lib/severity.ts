import type { AnalyzeResult } from "@/lib/types";

export type Severity = "healthy" | "watch" | "act";

type SeverityInput = Pick<AnalyzeResult, "counts" | "likelyCauses" | "mitigations" | "chemicals" | "confidence" | "qualityHold" | "progress">;

/**
 * Map an existing check onto a three-step pill. Uses only triage data already on the result:
 * no new model calls, no new prompt fields. Returns null when the photo was held for quality,
 * because there is no reading to grade.
 */
export function severityFor(result: SeverityInput): Severity | null {
  if (result.qualityHold) return null;
  const causes = result.likelyCauses?.length ?? 0;
  const steps = result.mitigations?.length ?? 0;
  const yellow = result.counts?.["yellow-leaf"] ?? 0;
  const weeds = result.counts?.weed ?? 0;
  const declining = result.progress?.growthTrend === "declining";
  const chemicals = Boolean(result.chemicals && result.chemicals.products.length > 0);

  if (declining) return "act";
  if (chemicals && causes > 0) return "act";
  if (yellow > 0 && causes > 0 && result.confidence === "high") return "act";
  if (causes > 0 || steps > 0 || yellow > 0 || weeds > 0 || chemicals) return "watch";
  return "healthy";
}
