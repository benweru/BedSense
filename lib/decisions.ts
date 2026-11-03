import { copy } from "@/lib/copy";
import type { AskTurn, Locale } from "@/lib/types";

/** The system decisions worth tracing in the Q&A thread, in the farmer's language. */
export type DecisionKind = "worsening" | "overdue" | "photo_requested" | "photo_answered";

/** One decision as a readable thread entry, for example "Evidence stale → asked for a fresh photo (…)". */
export function decisionText(locale: Locale, kind: DecisionKind, detail: string): string {
  const text = copy[locale];
  const clean = detail.replace(/\s+/g, " ").trim().slice(0, 160);
  switch (kind) {
    case "worsening":
      return text.decisionWorsening(clean);
    case "overdue":
      return text.decisionOverdue(clean);
    case "photo_requested":
      return text.decisionPhotoRequested(clean);
    case "photo_answered":
      return text.decisionPhotoAnswered(clean);
  }
}

/**
 * Append a system decision unless the identical entry is already recorded.
 * Returns the input array itself when deduped, so callers can skip a no-op write.
 */
export function threadWithDecision(thread: AskTurn[], locale: Locale, kind: DecisionKind, detail: string): AskTurn[] {
  const entry = decisionText(locale, kind, detail);
  if (thread.some((turn) => turn.role === "system" && turn.text === entry)) return thread;
  return [...thread, { role: "system", text: entry }];
}
