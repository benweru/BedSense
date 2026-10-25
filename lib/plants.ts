import type { ConceptId, CropId, Locale } from "@/lib/types";

/**
 * Canonical plant names. Matching folds spelling in a general way: case,
 * diacritics, y/i, and repeated letters. The table is not a special case for
 * one crop. Unknown plants keep a tidy version of what the farmer typed.
 */
export type KnownPlant = {
  en: string;
  sw: string;
  cropId: CropId | null;
  samPhrase: string | null;
};

type PlantRecord = KnownPlant & { surfaces: readonly string[] };

const PLANTS: readonly PlantRecord[] = [
  {
    en: "Chili",
    sw: "Pilipili",
    cropId: "chili",
    samPhrase: "chili pepper plant",
    surfaces: ["chili", "chilli", "chilly", "chilies", "chillies", "chilis", "pilipili"],
  },
  {
    en: "Onion",
    sw: "Kitunguu",
    cropId: "onion",
    samPhrase: "onion plant",
    surfaces: ["onion", "onions", "kitunguu", "vitunguu"],
  },
  {
    en: "Beetroot",
    sw: "Beetroot",
    cropId: "beetroot",
    samPhrase: "beetroot plant",
    surfaces: ["beetroot", "beetroots", "beet", "beets", "beet root"],
  },
  {
    en: "Tomato",
    sw: "Nyanya",
    cropId: null,
    samPhrase: "tomato plant",
    surfaces: ["tomato", "tomatoes", "nyanya"],
  },
  {
    en: "Kale",
    sw: "Sukuma wiki",
    cropId: null,
    samPhrase: "kale plant",
    surfaces: ["kale", "kales", "sukuma wiki", "sukuma"],
  },
  {
    en: "Cabbage",
    sw: "Kabichi",
    cropId: null,
    samPhrase: "cabbage plant",
    surfaces: ["cabbage", "cabbages", "kabichi"],
  },
  {
    en: "Spinach",
    sw: "Mchicha",
    cropId: null,
    samPhrase: "spinach plant",
    surfaces: ["spinach", "mchicha"],
  },
  {
    en: "Bean",
    sw: "Maharagwe",
    cropId: null,
    samPhrase: "bean plant",
    surfaces: ["bean", "beans", "maharagwe"],
  },
];

export function variantKey(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(" ").map(foldToken).filter(Boolean).join(" ");
}

function foldToken(token: string): string {
  return token.replace(/y/g, "i").replace(/([a-z])\1+/g, "$1");
}

function lookupKeys(input: string): string[] {
  const key = variantKey(input);
  if (!key) return [];
  const keys = [key];
  const parts = key.split(" ");
  const last = parts[parts.length - 1] ?? "";
  const stems: string[] = [];
  if (last.length > 4 && last.endsWith("es")) stems.push(last.slice(0, -2));
  if (last.length > 3 && last.endsWith("s")) stems.push(last.slice(0, -1));
  for (const stem of stems) {
    const next = [...parts.slice(0, -1), stem].filter(Boolean).join(" ");
    if (next && !keys.includes(next)) keys.push(next);
  }
  return keys;
}

const INDEX = new Map<string, KnownPlant>();
for (const plant of PLANTS) {
  const known: KnownPlant = {
    en: plant.en,
    sw: plant.sw,
    cropId: plant.cropId,
    samPhrase: plant.samPhrase,
  };
  for (const surface of [plant.en, plant.sw, ...plant.surfaces]) {
    const key = variantKey(surface);
    if (key && !INDEX.has(key)) INDEX.set(key, known);
  }
}

export function matchPlant(value: string): KnownPlant | null {
  for (const key of lookupKeys(value)) {
    const found = INDEX.get(key);
    if (found) return found;
  }
  return null;
}

export function readPlantName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function displayPlantName(locale: Locale, value: string): string {
  const cleaned = readPlantName(value);
  if (!cleaned) return "";
  const known = matchPlant(cleaned);
  if (known) return locale === "sw" ? known.sw : known.en;
  return cleaned
    .split(" ")
    .map((word) => {
      const lower = word.toLocaleLowerCase();
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export type Probe = { id: ConceptId; phrase: string };

const SYMPTOM_PROBES: readonly Probe[] = [
  { id: "yellow-leaf", phrase: "yellow leaf" },
  { id: "weed", phrase: "weed" },
];

/**
 * SAM prompts for this photo. The named plant, plus symptom marks.
 * Other crops are not probed, so a miss on another bed cannot become a note.
 */
export function probesForPlant(plantName: string): Probe[] {
  const named = readPlantName(plantName);
  const known = named ? matchPlant(named) : null;
  if (known?.cropId && known.samPhrase) {
    return [{ id: known.cropId, phrase: known.samPhrase }, ...SYMPTOM_PROBES];
  }
  if (known?.samPhrase) {
    return [{ id: "plant", phrase: known.samPhrase }, ...SYMPTOM_PROBES];
  }
  if (named) {
    return [{ id: "plant", phrase: `${displayPlantName("en", named)} plant` }, ...SYMPTOM_PROBES];
  }
  return [{ id: "plant", phrase: "vegetable plant" }, ...SYMPTOM_PROBES];
}
