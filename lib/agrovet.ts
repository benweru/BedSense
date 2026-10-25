import { AGROVET_CATALOG, type CatalogEntry } from "@/lib/agrovet-catalog";
import { copy } from "@/lib/copy";
import { containsDosage } from "@/lib/triage";
import type { ChemicalAdvice, ChemicalProduct, Locale, ShopOffer } from "@/lib/types";

/**
 * Live Kenya agrovet search is intentionally unwired.
 * No free public price API is called, so a Vercel Hobby deploy stays on
 * the curated catalog. Return shop rows from here later to replace the
 * catalog match for one active ingredient.
 */
export function liveKenyaShopOffers(_activeIngredient: string): ShopOffer[] | null {
  return null;
}

export function adviseChemicals(options: {
  locale: Locale;
  diseaseIndicated: unknown;
  suspect: unknown;
  chemicals: unknown;
}): ChemicalAdvice | null {
  const parsed = parseProducts(options.chemicals, options.locale);
  const flagged = isIndicated(options.diseaseIndicated);
  if (!flagged && parsed.products.length === 0) return null;
  const text = copy[options.locale];
  const suspect = cleanProse(options.suspect, 140) ?? text.chemicalsSuspectFallback;
  return {
    suspect,
    products: parsed.products,
    verifyNote: text.verifyNote,
    priceNote: text.priceNote,
    lookup: parsed.usedLive ? "live" : "catalog",
  };
}

function isIndicated(value: unknown): boolean {
  return value === true || value === "true" || value === "yes";
}

function parseProducts(value: unknown, locale: Locale): { products: ChemicalProduct[]; usedLive: boolean } {
  if (!Array.isArray(value)) return { products: [], usedLive: false };
  const text = copy[locale];
  const products: ChemicalProduct[] = [];
  const seen = new Set<string>();
  let usedLive = false;
  for (const item of value) {
    if (products.length >= 3) break;
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rawActive = cleanLabel(record.activeIngredient, 80);
    if (!rawActive) continue;
    const entry = matchCatalog(rawActive);
    const key = entry?.id ?? norm(rawActive);
    if (seen.has(key)) continue;
    seen.add(key);
    const modelNote = cleanProse(record.useNote, 280);
    const modelClass = cleanLabel(record.productClass, 60);
    const live = entry ? liveKenyaShopOffers(entry.name) : liveKenyaShopOffers(rawActive);
    if (live && live.length > 0) usedLive = true;
    products.push({
      activeIngredient: entry?.name ?? rawActive,
      productClass: entry?.productClass[locale] ?? modelClass ?? text.chemicalClassFallback,
      useNote: modelNote ?? entry?.useNote[locale] ?? text.chemicalUseFallback,
      offers: live && live.length > 0 ? live : entry ? catalogOffers(entry, locale) : [],
    });
  }
  return { products, usedLive };
}

function catalogOffers(entry: CatalogEntry, locale: Locale): ShopOffer[] {
  return entry.offers.map((offer) => ({
    quality: offer.quality,
    brand: offer.brand,
    pack: offer.pack,
    shopName: offer.shopName,
    shopKind: offer.shopKind[locale],
    place: offer.place,
    priceMinKes: offer.priceMinKes,
    priceMaxKes: offer.priceMaxKes,
  }));
}

export function matchCatalog(active: string): CatalogEntry | null {
  const needle = norm(active);
  if (!needle) return null;
  let best: { entry: CatalogEntry; score: number } | null = null;
  for (const entry of AGROVET_CATALOG) {
    for (const alias of entry.aliases) {
      const normalized = norm(alias);
      if (!normalized) continue;
      const exact = needle === normalized;
      const contained = needle.includes(normalized);
      if (!exact && !contained) continue;
      const score = (exact ? 1000 : 0) + normalized.length;
      if (!best || score > best.score) best = { entry, score };
    }
  }
  return best?.entry ?? null;
}

function cleanProse(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || containsDosage(text)) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cleanLabel(value: unknown, max: number): string | null {
  return cleanProse(value, max);
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
