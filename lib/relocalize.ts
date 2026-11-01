import { AGROVET_CATALOG } from "@/lib/agrovet-catalog";
import { copy } from "@/lib/copy";
import { ISSUE_IDS, issueTriage } from "@/lib/issues";
import { displayPlantName } from "@/lib/plants";
import { qualityMessageFor, qualityNoteFor } from "@/lib/quality-copy";
import { buildMockResult } from "@/lib/server/mock";
import type { AnalyzeResult, Locale } from "@/lib/types";

type Pair = Record<Locale, string>;
const LOCALES: readonly Locale[] = ["en", "sw"];

function addPair(table: Map<string, Pair>, en: unknown, sw: unknown) {
  if (typeof en === "string" && typeof sw === "string") {
    if (en && sw) {
      const pair = { en, sw };
      table.set(en, pair);
      table.set(sw, pair);
    }
    return;
  }
  if (Array.isArray(en) && Array.isArray(sw)) {
    en.forEach((item, index) => addPair(table, item, sw[index]));
  }
}

let fixedTable: Map<string, Pair> | null = null;

/** Every fixed app string the server can put into a result, in both languages. */
function fixedPairs(): Map<string, Pair> {
  if (fixedTable) return fixedTable;
  const table = new Map<string, Pair>();
  for (const key of Object.keys(copy.en) as (keyof typeof copy.en)[]) addPair(table, copy.en[key], copy.sw[key]);
  for (const entry of AGROVET_CATALOG) {
    addPair(table, entry.productClass.en, entry.productClass.sw);
    addPair(table, entry.useNote.en, entry.useNote.sw);
    for (const offer of entry.offers) addPair(table, offer.shopKind.en, offer.shopKind.sw);
  }
  for (const scenario of [0, 1, 2] as const) {
    const scene = (locale: Locale) => buildMockResult({ scenario, locale, width: 900, height: 1200, mime: "image/jpeg", id: "pair", createdAt: "1970-01-01T00:00:00.000Z" });
    const en = scene("en");
    const sw = scene("sw");
    addPair(table, [en.observations, en.likelyCauses, en.mitigations, en.actions, en.contextAsk, en.chemicals?.suspect], [sw.observations, sw.likelyCauses, sw.mitigations, sw.actions, sw.contextAsk, sw.chemicals?.suspect]);
  }
  addPair(table, "Demo: the plant looks about the same as the last check.", "Onyesho: mmea unaonekana sawa na ukaguzi uliopita.");
  fixedTable = table;
  return table;
}

/** Local triage lines for this plant (the fallback and mock reads), in both languages. */
function storyPairs(plants: readonly string[]): Map<string, Pair> {
  const table = new Map<string, Pair>();
  for (const plant of new Set(plants.filter(Boolean))) {
    const label = { en: displayPlantName("en", plant) || copy.en.unknownPlant, sw: displayPlantName("sw", plant) || copy.sw.unknownPlant };
    for (const issue of ISSUE_IDS) {
      const en = issueTriage("en", label.en, issue);
      const sw = issueTriage("sw", label.sw, issue);
      addPair(table, en.observations, sw.observations);
      addPair(table, en.hypotheses, sw.hypotheses);
      addPair(table, en.mitigations, sw.mitigations);
      addPair(table, en.actions, sw.actions);
    }
  }
  return table;
}

/** Swap one stored fixed line (a saved-check summary, say) into `locale`. Prose with no pair is returned as is. */
export function relocalizeText(value: string, locale: Locale, plants: readonly string[] = []): string {
  return fixedPairs().get(value)?.[locale] ?? storyPairs(plants).get(value)?.[locale] ?? value;
}

/**
 * Show a stored result in `locale` without re-running the check.
 * Fixed app copy (hold messages, frame notes, Before you act, agrovet notes,
 * local fallback triage) is rebuilt from codes or swapped for its pair.
 * Free-form Muse prose has no pair and is left as written.
 */
export function relocalizeResult(result: AnalyzeResult, locale: Locale): AnalyzeResult {
  if (!LOCALES.includes(locale) || result.locale === locale) return result;
  const fixed = fixedPairs();
  const stories = storyPairs([result.farmerPlant, result.detectedPlant]);
  const swap = (value: string): string => fixed.get(value)?.[locale] ?? stories.get(value)?.[locale] ?? value;
  const swapAll = <T extends string[]>(values: T): T => values.map(swap) as T;
  const text = copy[locale];
  const hold = result.qualityHold ?? null;
  const verdicts = result.qualityVerdicts ?? null;

  return {
    ...result,
    locale,
    qualityMessage: hold
      ? verdicts
        ? qualityMessageFor(locale, hold, verdicts)
        : hold === "harsh_light" || hold === "mixed"
          ? (result.qualityMessage ?? null)
          : qualityMessageFor(locale, hold, [])
      : (result.qualityMessage ?? null),
    qualityNote: result.qualityBatch ? qualityNoteFor(locale, result.qualityBatch) : (result.qualityNote ?? null),
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    contextAsk: result.contextAsk ? swap(result.contextAsk) : result.contextAsk,
    observations: swapAll(result.observations),
    likelyCauses: swapAll(result.likelyCauses),
    mitigations: swapAll(result.mitigations),
    actions: swapAll(result.actions),
    chemicals: result.chemicals
      ? {
          ...result.chemicals,
          suspect: swap(result.chemicals.suspect),
          verifyNote: swap(result.chemicals.verifyNote),
          priceNote: swap(result.chemicals.priceNote),
          products: result.chemicals.products.map((product) => ({
            ...product,
            productClass: swap(product.productClass),
            useNote: swap(product.useNote),
            offers: product.offers.map((offer) => ({ ...offer, shopKind: swap(offer.shopKind) })),
          })),
        }
      : result.chemicals,
    progress: result.progress ? { ...result.progress, sinceLastCheck: result.progress.sinceLastCheck ? swap(result.progress.sinceLastCheck) : result.progress.sinceLastCheck } : result.progress,
  };
}
