import { copy } from "@/lib/copy";
import { emptyFarmerContext } from "@/lib/context";
import { contextText, inferIssue, issueTriage, parseIssue, type IssueId } from "@/lib/issues";
import { displayPlantName, foldPlantSpelling, matchPlant } from "@/lib/plants";
import { researchFor, researchPractices } from "@/lib/research";
import { repairSentences } from "@/lib/translate";
import type { ConceptCounts, ConceptId, ConfidenceLevel, CropId, FarmerContext, Locale } from "@/lib/types";
import { CROPS } from "@/lib/types";

const DOSAGE =
  /\b\d+(?:[.,]\d+)?\s*(?:ml|millilit(?:re|er)s?|mililita|l|lit(?:re|er)s?|lita|g|grams?|gramu|kg|kilo|mg)\b|\b(?:ml|g|kg|mg|l)\s*\/\s*(?:l|ha|acre|\d)|(?:spray|apply|mix|dawa)\b[^.]{0,48}\b\d+(?:[.,]\d+)?\s*(?:ml|g|kg|l|mg|lita|gramu)\b/i;

const NOISE =
  /segmentation did not return|marks may be missing|no plants were marked|no familiar crop marks|notes you added are part of this check|alama za .{0,48}hazijarudi|zinaweza kukosekana|maelezo uliyoongeza|hakuna mimea iliyoalamishwa|hakuna alama za mazao/i;

const ABSENT_CROP: [ConceptId, RegExp][] = [
  ["onion", /\b(onions?|kitunguu|vitunguu)\b/i],
  ["beetroot", /\b(beetroots?|beets?)\b/i],
  ["chili", /\b(chilli(?:es)?|chilies|chili|pilipili)\b/i],
];

const ABSENT_TALK =
  /\b(another crop|other crops|secondary crops?|different beds?|on its own bed|not in (?:this |the )?(?:photo|frame|picture)|missing from the (?:photo|frame))\b|\b(zao lingine|vitanda tofauti|kitanda kingine)\b/i;

const CROP_MENTION: Record<CropId, RegExp> = {
  onion: /\b(?:onions?|kitunguu|vitunguu)\b/i,
  beetroot: /\b(?:beets?|beet\s?roots?)\b/i,
  chili: /\b(?:chilli(?:es)?|chilly|chilis|chilies|chili|pilipili)\b/i,
};

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

/** Drop a note that names a crop SAM did not mark, unless the farmer named that crop. */
export function mentionsAbsentCrop(sentence: string, counts: ConceptCounts, plantName = ""): boolean {
  if (ABSENT_TALK.test(sentence)) return true;
  const named = matchPlant(plantName)?.cropId ?? null;
  return ABSENT_CROP.some(([id, pattern]) => counts[id] === 0 && id !== named && pattern.test(sentence));
}

function asLevel(value: unknown): ConfidenceLevel | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function cleanSentence(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || containsDosage(text) || NOISE.test(text)) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function allowedCrops(plantName: string, counts: ConceptCounts): Set<CropId> {
  const allowed = new Set<CropId>();
  const known = matchPlant(plantName);
  if (known?.cropId) allowed.add(known.cropId);
  for (const crop of CROPS) {
    if (counts[crop] > 0) allowed.add(crop);
  }
  return allowed;
}

function mentionsDisallowedCrop(sentence: string, allowed: ReadonlySet<CropId>): boolean {
  for (const crop of CROPS) {
    if (allowed.has(crop)) continue;
    if (CROP_MENTION[crop].test(sentence)) return true;
  }
  return false;
}

function cleanLines(
  values: readonly unknown[],
  max: number,
  allowed: ReadonlySet<CropId>,
  counts: ConceptCounts,
  plantName: string,
  locale: Locale,
): string[] {
  const lines: string[] = [];
  for (const value of values) {
    const sentence = cleanSentence(value, max);
    if (!sentence || mentionsAbsentCrop(sentence, counts, plantName) || mentionsDisallowedCrop(sentence, allowed)) continue;
    const folded = foldPlantSpelling(locale, sentence, plantName);
    if (!lines.includes(folded)) lines.push(folded);
  }
  return lines;
}

const GENERIC_CHECK =
  /(?:press|push) a finger|finger .{0,48}soil|into the soil|feel the soil|soil moisture|water only if|worst leaves|lift the .{0,32}leaves|photograph the same plants again|photograph again in two days|bonyeza kidole|gusa udongo|mwagilia tu ikiwa|majani yaliyoathirika|piga picha tena baada ya siku mbili|siku mbili/i;

/** A check that does not name the symptom and only repeats the healthy-bed backup. */
export function isGenericCheck(action: string): boolean {
  if (inferIssue(action)) return false;
  return GENERIC_CHECK.test(action);
}

function textList(values: readonly unknown[]): string {
  return values.filter((value): value is string => typeof value === "string").join("\n");
}

function topUp(lines: string[], extras: readonly string[], cap: number): string[] {
  const next = [...lines];
  for (const extra of extras) {
    if (next.length >= cap) break;
    if (!next.includes(extra)) next.push(extra);
  }
  return next;
}

export function finalizeTriage(options: {
  locale: Locale;
  observations: unknown;
  actions: unknown;
  confidence: unknown;
  confidenceScore: unknown;
  counts: ConceptCounts;
  /** Accepted so older callers compile. Failure notes are never shown. */
  failedConcepts?: readonly ConceptId[];
  plantName?: string;
  context?: FarmerContext;
  /** Pass `"none"` to keep a healthy-bed story from being rewritten. */
  issue?: unknown;
  symptom?: unknown;
  suspect?: unknown;
  likelyCauses?: unknown;
  mitigations?: unknown;
}): {
  observations: string[];
  actions: [string, string, string];
  likelyCauses: string[];
  mitigations: string[];
  issue: IssueId | null;
  /** Findings only. Checks that say "look for thrips" are not treated as a spray. */
  sprayEvidence: string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  disclaimer: string;
  agronomistCallout: string;
  strippedDosage: boolean;
} {
  const text = copy[options.locale];
  const context = options.context ?? emptyFarmerContext();
  const plantName = options.plantName ?? "";
  const allowed = allowedCrops(plantName, options.counts);
  const rawObservations = Array.isArray(options.observations) ? options.observations : [];
  const rawActions = Array.isArray(options.actions) ? options.actions : [];
  const strippedDosage = [...rawObservations, ...rawActions].some((item) => typeof item === "string" && containsDosage(item));

  const findingText = [contextText(context), textList(rawObservations), textList([options.suspect, options.symptom])].join("\n");
  const blocked = options.issue === "none";
  const issue = blocked
    ? null
    : (parseIssue(options.issue) ?? parseIssue(options.symptom) ?? inferIssue(findingText) ?? inferIssue(textList(rawActions)));
  const plantLabel = displayPlantName(options.locale, plantName) || text.unknownPlant;
  const story = issue ? issueTriage(options.locale, plantLabel, issue) : null;
  const suspectText = typeof options.suspect === "string" ? options.suspect : "";
  const research = researchFor(suspectText, issue);
  const line = (values: readonly unknown[], max: number) => cleanLines(values, max, allowed, options.counts, plantName, options.locale);

  let notes = line(rawObservations, 280);
  if (notes.length === 0 && story) notes = line(story.observations, 280);

  const countLine = text.countLine(options.counts);
  const observations = [...(countLine && !NOISE.test(countLine) ? [countLine] : []), ...notes].slice(0, 4);

  let likelyCauses = line(Array.isArray(options.likelyCauses) ? options.likelyCauses : [], 320);
  let mitigations = line(Array.isArray(options.mitigations) ? options.mitigations : [], 320);
  // The model's own steps first, then researched practices for the named
  // suspect, then the generic issue story. Each pass keeps its cap.
  if (research) {
    mitigations = topUp(mitigations, line(researchPractices(research, options.locale, plantLabel), 320), 3);
  }
  if (story) {
    likelyCauses = topUp(likelyCauses, line(story.hypotheses, 320), 3);
    mitigations = topUp(mitigations, line(story.mitigations, 320), 3);
  }

  let actions = line(rawActions, 220);
  if (story) {
    const specific = actions.filter((action) => !isGenericCheck(action));
    actions = specific;
    actions = topUp(actions, line(story.actions, 220), 3);
  } else {
    for (const fallback of text.fallbackActions) {
      if (actions.length === 3) break;
      if (!actions.includes(fallback)) actions.push(fallback);
    }
  }

  const parsedLevel = asLevel(options.confidence);
  let confidenceScore = clampScore(options.confidenceScore) ?? scoreFromLevel(parsedLevel ?? "medium");
  let confidence = parsedLevel ?? levelFromScore(confidenceScore);
  if (strippedDosage) {
    confidence = "low";
    confidenceScore = Math.min(confidenceScore, 0.4);
  }

  const checks: [string, string, string] = [
    actions[0] ?? text.fallbackActions[0],
    actions[1] ?? text.fallbackActions[1],
    actions[2] ?? text.fallbackActions[2],
  ];
  // A `sw` reading repairs English drift in place. Proper Swahili passes through untouched.
  const repaired = repairSentences(options.locale, checks);
  return {
    observations: repairSentences(options.locale, observations),
    actions: [repaired[0] ?? checks[0], repaired[1] ?? checks[1], repaired[2] ?? checks[2]],
    likelyCauses: repairSentences(options.locale, likelyCauses),
    mitigations: repairSentences(options.locale, mitigations),
    issue,
    sprayEvidence: findingText,
    confidence,
    confidenceScore,
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    strippedDosage,
  };
}
