import type { AnalyzeResult } from "@/lib/types";

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
