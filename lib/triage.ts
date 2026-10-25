import { chemicalOffers } from "@/lib/agrovet";
import { copy } from "@/lib/copy";
import { emptyFarmerContext } from "@/lib/context";
import { contextText, inferIssue, issueTriage, issueUsesChemicals, parseIssue, type IssueId } from "@/lib/issues";
import { displayPlantName, matchPlant } from "@/lib/plants";
import type { ChemicalOffer, ConceptCounts, ConfidenceLevel, CropId, FarmerContext, Locale } from "@/lib/types";
import { CROPS } from "@/lib/types";

const DOSAGE =
  /\b\d+(?:[.,]\d+)?\s*(?:ml|millilit(?:re|er)s?|mililita|l|lit(?:re|er)s?|lita|g|grams?|gramu|kg|kilo|mg)\b|\b(?:ml|g|kg|mg|l)\s*\/\s*(?:l|ha|acre|\d)|(?:spray|apply|mix|dawa)\b[^.]{0,48}\b\d+(?:[.,]\d+)?\s*(?:ml|g|kg|l|mg|lita|gramu)\b/i;

const NOISE =
  /segmentation did not return|marks may be missing|no plants were marked|no familiar crop marks|notes you added are part of this check|alama za .{0,48}hazijarudi|zinaweza kukosekana|maelezo uliyoongeza|hakuna mimea iliyoalamishwa|hakuna alama za mazao/i;

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

function cleanLines(values: readonly unknown[], max: number, allowed: ReadonlySet<CropId>): string[] {
  const lines: string[] = [];
  for (const value of values) {
    const sentence = cleanSentence(value, max);
    if (!sentence || mentionsDisallowedCrop(sentence, allowed)) continue;
    if (!lines.includes(sentence)) lines.push(sentence);
  }
  return lines;
}

function chemicalsWanted(flag: unknown, issue: IssueId | null): boolean {
  if (flag === false || !issue || !issueUsesChemicals(issue)) return false;
  return true;
}

export function finalizeTriage(options: {
  locale: Locale;
  observations: unknown;
  actions: unknown;
  hypotheses?: unknown;
  confidence: unknown;
  confidenceScore: unknown;
  counts: ConceptCounts;
  plantName?: string;
  context?: FarmerContext;
  chemicalsHelp?: unknown;
  issue?: unknown;
}): {
  observations: string[];
  hypotheses: string[];
  actions: [string, string, string];
  chemicals: ChemicalOffer[];
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
  const rawHypotheses = Array.isArray(options.hypotheses) ? options.hypotheses : [];
  const strippedDosage = [...rawObservations, ...rawActions, ...rawHypotheses].some(
    (item) => typeof item === "string" && containsDosage(item),
  );

  const explicitNone = options.issue === "none";
  const issue = parseIssue(options.issue) ?? (explicitNone ? null : inferIssue(contextText(context)));
  const plantLabel = displayPlantName(options.locale, plantName) || text.unknownPlant;
  const story = issue ? issueTriage(options.locale, plantLabel, issue) : null;

  let notes = cleanLines(rawObservations, 280, allowed);
  if (notes.length === 0 && story) notes = cleanLines(story.observations, 280, allowed);
  const countLine = text.countLine(options.counts);
  const observations = [...(countLine ? [countLine] : []), ...notes].slice(0, 4);

  let hypotheses = cleanLines(rawHypotheses, 320, allowed);
  if (hypotheses.length === 0 && story) hypotheses = cleanLines(story.hypotheses, 320, allowed);
  hypotheses = hypotheses.slice(0, 3);

  let actions = cleanLines(rawActions, 220, allowed);
  const fallbackActions: readonly string[] = text.fallbackActions;
  const allGeneric = actions.length > 0 && actions.every((action) => fallbackActions.includes(action));
  if (story && (actions.length === 0 || allGeneric)) {
    actions = cleanLines(story.actions, 220, allowed);
  }
  for (const fallback of text.fallbackActions) {
    if (actions.length === 3) break;
    if (!actions.includes(fallback)) actions.push(fallback);
  }

  const chemicals = chemicalsWanted(options.chemicalsHelp, issue)
    ? chemicalOffers(options.locale, issue as IssueId).filter(
        (offer) => !containsDosage(`${offer.name} ${offer.why} ${offer.shops} ${offer.kesBand}`),
      )
    : [];

  const parsedLevel = asLevel(options.confidence);
  let confidenceScore = clampScore(options.confidenceScore) ?? scoreFromLevel(parsedLevel ?? "medium");
  let confidence = parsedLevel ?? levelFromScore(confidenceScore);
  if (strippedDosage) {
    confidence = "low";
    confidenceScore = Math.min(confidenceScore, 0.4);
  }

  return {
    observations,
    hypotheses,
    actions: [actions[0] ?? text.fallbackActions[0], actions[1] ?? text.fallbackActions[1], actions[2] ?? text.fallbackActions[2]],
    chemicals,
    confidence,
    confidenceScore,
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    strippedDosage,
  };
}
