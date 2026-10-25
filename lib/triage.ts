import { copy } from "@/lib/copy";
import type { ConceptCounts, ConceptId, ConfidenceLevel, Locale } from "@/lib/types";

const DOSAGE =
  /\b\d+(?:[.,]\d+)?\s*(?:ml|millilit(?:re|er)s?|mililita|l|lit(?:re|er)s?|lita|g|grams?|gramu|kg|kilo|mg)\b|\b(?:ml|g|kg|mg|l)\s*\/\s*(?:l|ha|acre|\d)|(?:spray|apply|mix|dawa)\b[^.]{0,48}\b\d+(?:[.,]\d+)?\s*(?:ml|g|kg|l|mg|lita|gramu)\b/i;

export function containsDosage(text: string): boolean {
  return DOSAGE.test(text);
}

export function clampScore(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number)) return null;
  return Math.min(1, Math.max(0, number));
}

export function levelFromScore(score: number): ConfidenceLevel {
  if (score < 0.45) return "low";
  if (score < 0.75) return "medium";
  return "high";
}

export function scoreFromLevel(level: ConfidenceLevel): number {
  if (level === "low") return 0.35;
  if (level === "medium") return 0.62;
  return 0.84;
}

const ABSENT_CROP: [ConceptId, RegExp][] = [
  ["onion", /\b(onions?|kitunguu)\b/i],
  ["beetroot", /\b(beetroots?|beets?)\b/i],
  ["chili", /\b(chilli(?:es)?|chilies|chili|pilipili)\b/i],
];

const ABSENT_TALK =
  /\b(another crop|other crops|secondary crops?|different beds?|on its own bed|not in (?:this |the )?(?:photo|frame|picture)|missing from the (?:photo|frame))\b|\b(zao lingine|vitanda tofauti|kitanda kingine)\b/i;

/** Drop a note that names a crop SAM did not mark, or that talks about a crop outside the frame. */
export function mentionsAbsentCrop(sentence: string, counts: ConceptCounts): boolean {
  if (ABSENT_TALK.test(sentence)) return true;
  return ABSENT_CROP.some(([id, pattern]) => counts[id] === 0 && pattern.test(sentence));
}

function asLevel(value: unknown): ConfidenceLevel | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function cleanSentence(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || containsDosage(text)) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function finalizeTriage(options: {
  locale: Locale;
  observations: unknown;
  actions: unknown;
  confidence: unknown;
  confidenceScore: unknown;
  counts: ConceptCounts;
  failedConcepts: readonly ConceptId[];
}): {
  observations: string[];
  actions: [string, string, string];
  confidence: ConfidenceLevel;
  confidenceScore: number;
  disclaimer: string;
  agronomistCallout: string;
  strippedDosage: boolean;
} {
  const text = copy[options.locale];
  const rawObservations = Array.isArray(options.observations) ? options.observations : [];
  const rawActions = Array.isArray(options.actions) ? options.actions : [];
  const strippedDosage =
    rawObservations.some((item) => typeof item === "string" && containsDosage(item)) ||
    rawActions.some((item) => typeof item === "string" && containsDosage(item));

  const observations = [text.countLine(options.counts)];
  for (const conceptId of options.failedConcepts) {
    observations.push(text.segmentFailed(text.concepts[conceptId]));
  }
  for (const item of rawObservations) {
    const sentence = cleanSentence(item, 280);
    if (!sentence || mentionsAbsentCrop(sentence, options.counts)) continue;
    observations.push(sentence);
    if (observations.length >= 4) break;
  }

  const actions: string[] = [];
  for (const item of rawActions) {
    const sentence = cleanSentence(item, 220);
    if (sentence && !actions.includes(sentence)) actions.push(sentence);
    if (actions.length === 3) break;
  }
  for (const fallback of text.fallbackActions) {
    if (actions.length === 3) break;
    if (!actions.includes(fallback)) actions.push(fallback);
  }

  const parsedLevel = asLevel(options.confidence);
  let confidenceScore = clampScore(options.confidenceScore) ?? scoreFromLevel(parsedLevel ?? "medium");
  let confidence = parsedLevel ?? levelFromScore(confidenceScore);
  if (strippedDosage) {
    confidence = "low";
    confidenceScore = Math.min(confidenceScore, 0.4);
  }

  return {
    observations,
    actions: [actions[0] ?? text.fallbackActions[0], actions[1] ?? text.fallbackActions[1], actions[2] ?? text.fallbackActions[2]],
    confidence,
    confidenceScore,
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    strippedDosage,
  };
}
