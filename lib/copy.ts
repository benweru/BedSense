import type { ConceptCounts, ConceptId, ConfidenceLevel, CropFocus, CropId, Locale } from "@/lib/types";

export type PlantLineInput = {
  detectedPlant?: string | null;
  cropFocus: CropFocus;
  primaryCrop: CropId | null;
};

export type Copy = {
  kicker: string;
  title: string;
  lede: string;
  supportLine: string;
  supportNote: string;
  capture: string;
  upload: string;
  hint: string;
  preparing: string;
  analyzing: string;
  retake: string;
  retry: string;
  observations: string;
  actions: string;
  actionsHint: string;
  confidence: string;
  low: string;
  medium: string;
  high: string;
  history: string;
  historyEmpty: string;
  clear: string;
  marks: string;
  noMasks: string;
  errorGeneric: string;
  errorFormat: string;
  language: string;
  english: string;
  swahili: string;
  askAgronomist: string;
  beforeYouAct: string;
  modeMock: string;
  modeLive: string;
  backupNote: string;
  footer: string;
  concepts: Record<ConceptId, string>;
  unknownPlant: string;
  contextTitle: string;
  contextHint: string;
  contextAskLabel: string;
  contextUpdate: string;
  contextAskDefault: string;
  contextNoted: string;
  contextFields: {
    stage: string;
    practices: string;
    chemicals: string;
    weather: string;
    issues: string;
    notes: string;
  };
  fallbackActions: [string, string, string];
  disclaimer: string;
  agronomistCallout: string;
  countLine: (counts: ConceptCounts) => string;
  plantLine: (input: PlantLineInput) => string;
  segmentFailed: (name: string) => string;
  levelLabel: (level: ConfidenceLevel) => string;
};

const en: Copy = {
  kicker: "Meta Global AI Developer Hackathon · Indie · Build for Your World",
  title: "BedSense",
  lede: "Photograph any plant on a vegetable farm bed. You do not pick a crop first. SAM 3.1 and Muse Spark read the photo and return exactly three next checks: practical, non-chemical things to look at or do next. Triage steps only — not a diagnosis, and not a treatment rate.",
  supportLine: "Works well with onion. Often used for beetroot and chili.",
  supportNote:
    "Each of those crops grows on its own bed. Onion and beetroot are never on the same bed, and chili is a separate bed too. Any other farm plant is welcome.",
  capture: "Take a photo",
  upload: "Choose a photo",
  hint: "Fill the frame with one plant or one bed. Morning light and a steady phone help.",
  preparing: "Preparing the photo…",
  analyzing: "Reading the plant in this photo. Three next checks come next.",
  retake: "New photo",
  retry: "Try again",
  observations: "What stands out",
  actions: "Three next checks",
  actionsHint: "Practical, non-chemical things to look at or do on the bed. Not a diagnosis or a treatment rate.",
  confidence: "Confidence",
  low: "Low",
  medium: "Medium",
  high: "High",
  history: "Recent checks",
  historyEmpty: "Your last five checks stay on this phone.",
  clear: "Clear",
  marks: "Marks",
  noMasks: "No familiar crop marks landed in this frame. The photo is still read.",
  errorGeneric: "The check did not finish. Try another photo.",
  errorFormat: "This photo did not open. Take it again or choose a JPEG.",
  language: "Language",
  english: "English",
  swahili: "Kiswahili",
  askAgronomist: "Ask an agronomist",
  beforeYouAct: "Before you act",
  modeMock: "Demo mode",
  modeLive: "Live models",
  backupNote: "This advice came from the on-phone backup because Muse Spark did not answer.",
  footer: "Triage, not a diagnosis. No spray doses.",
  concepts: {
    onion: "Onion",
    beetroot: "Beetroot",
    chili: "Chili",
    plant: "Other plant",
    "yellow-leaf": "Yellow leaf",
    weed: "Weed",
  },
  unknownPlant: "Farm plant",
  contextTitle: "Add context (optional)",
  contextHint: "Plant age or stage, current practices, chemicals already used, recent weather or irrigation, known issues, or a note. This is not required.",
  contextAskLabel: "A clearer check would use this",
  contextUpdate: "Update the check",
  contextAskDefault: "If you know it, add the plant’s age and when you last watered.",
  contextNoted: "The notes you added are part of this check.",
  contextFields: {
    stage: "Plant age or stage",
    practices: "Current practices",
    chemicals: "Chemicals already used",
    weather: "Recent weather or irrigation",
    issues: "Known issues",
    notes: "Anything else",
  },
  fallbackActions: [
    "Press a finger a few centimetres into the soil and water only if it feels dry.",
    "Lift the worst leaves off the bed so they do not sit on healthy plants.",
    "Photograph the same plants again in two days and show both photos to an agronomist if the marks spread.",
  ],
  disclaimer:
    "BedSense offers field triage, not a diagnosis. It does not name a disease with certainty, and it does not give a treatment rate or a spray dose. Confirm with a qualified agronomist or your local extension officer before you treat the bed.",
  agronomistCallout:
    "Ask an agronomist. Show them this photo and these three next checks before you buy or mix any spray.",
  countLine: (counts) =>
    `Marks — onion ${counts.onion}, beetroot ${counts.beetroot}, chili ${counts.chili}, other plant ${counts.plant}, yellow leaf ${counts["yellow-leaf"]}, weed ${counts.weed}.`,
  plantLine: ({ detectedPlant, cropFocus, primaryCrop }) => {
    const named = detectedPlant?.trim() || (primaryCrop === "onion" ? "Onion" : primaryCrop === "beetroot" ? "Beetroot" : primaryCrop === "chili" ? "Chili" : "");
    if (cropFocus === "mixed") {
      const lead = named || "This frame";
      return `${lead} is in this frame with another crop. A photo is one bed. Onion, beetroot, and chili are grown on different beds, so more than one of them here is unusual.`;
    }
    if (named) return `This looks like ${named}.`;
    return "This looks like a farm plant. The three next checks still apply.";
  },
  segmentFailed: (name) => `${name} segmentation did not return, so those marks may be missing.`,
  levelLabel: (level) => (level === "low" ? "Low" : level === "medium" ? "Medium" : "High"),
};

const sw: Copy = {
  kicker: "Meta Global AI Developer Hackathon · Indie · Build for Your World",
  title: "BedSense",
  lede: "Piga picha ya mmea wowote kwenye kitanda cha mboga shambani. Huchagui zao kwanza. SAM 3.1 na Muse Spark zinasoma picha na kurudisha ukaguzi tatu hasa: mambo ya kivitendo, bila kemikali, ya kuangalia au kufanya. Hatua za mapitio tu — si utambuzi, wala kipimo cha tiba.",
  supportLine: "Hufanya kazi vizuri na kitunguu. Hutumika mara nyingi kwa beetroot na pilipili.",
  supportNote:
    "Kila moja ya mazao hayo iko kwenye kitanda chake. Kitunguu na beetroot havipandwi kamwe kwenye kitanda kimoja, na pilipili iko kwenye kitanda chake. Mmea mwingine wowote shambani unakubalika.",
  capture: "Piga picha",
  upload: "Chagua picha",
  hint: "Jaza fremu na mmea mmoja au kitanda kimoja. Mwanga wa asubuhi na simu tulivu husaidia.",
  preparing: "Inatayarisha picha…",
  analyzing: "Inasoma mmea kwenye picha hii. Ukaguzi tatu unafuata.",
  retake: "Picha nyingine",
  retry: "Jaribu tena",
  observations: "Kinachoonekana",
  actions: "Ukaguzi tatu unaofuata",
  actionsHint: "Mambo ya kivitendo, bila kemikali, ya kuangalia au kufanya kwenye kitanda. Si utambuzi wala kipimo cha tiba.",
  confidence: "Imani",
  low: "Chini",
  medium: "Wastani",
  high: "Juu",
  history: "Ukaguzi wa hivi karibuni",
  historyEmpty: "Ukaguzi tano wa mwisho unabaki kwenye simu hii.",
  clear: "Futa",
  marks: "Alama",
  noMasks: "Hakuna alama za mazao ya kawaida kwenye fremu hii. Picha bado inasomwa.",
  errorGeneric: "Ukaguzi haujakamilika. Jaribu picha nyingine.",
  errorFormat: "Picha hii haikufunguka. Piga tena au chagua JPEG.",
  language: "Lugha",
  english: "English",
  swahili: "Kiswahili",
  askAgronomist: "Muulize mtaalamu wa kilimo",
  beforeYouAct: "Kabla ya kutenda",
  modeMock: "Hali ya onyesho",
  modeLive: "Modeli hai",
  backupNote: "Ushauri huu umetoka kwenye chelezo ya ndani kwa sababu Muse Spark haijajibu.",
  footer: "Mapitio si utambuzi. Hakuna vipimo vya dawa.",
  concepts: {
    onion: "Kitunguu",
    beetroot: "Beetroot",
    chili: "Pilipili",
    plant: "Mmea mwingine",
    "yellow-leaf": "Jani njano",
    weed: "Magugu",
  },
  unknownPlant: "Mmea wa shamba",
  contextTitle: "Ongeza muktadha (si lazima)",
  contextHint: "Umri au hatua ya mmea, mazoea, kemikali zilizotumika, hali ya hewa au umwagiliaji, matatizo unayoyajua, au maelezo. Haihitajiki.",
  contextAskLabel: "Ukaguzi ulio wazi zaidi ungetumia hili",
  contextUpdate: "Sasisha ukaguzi",
  contextAskDefault: "Ikiwa unajua, ongeza umri wa mmea na lini ulimwagilia mara ya mwisho.",
  contextNoted: "Maelezo uliyoongeza yameingia kwenye ukaguzi huu.",
  contextFields: {
    stage: "Umri au hatua ya mmea",
    practices: "Mazoea ya sasa",
    chemicals: "Kemikali zilizotumika",
    weather: "Hali ya hewa au umwagiliaji",
    issues: "Matatizo unayoyajua",
    notes: "Mengineyo",
  },
  fallbackActions: [
    "Bonyeza kidole sentimita chache kwenye udongo; mwagilia tu ikiwa umekauka.",
    "Ondoa majani yaliyoathirika zaidi kwenye kitanda ili yasiguse mimea yenye afya.",
    "Piga picha tena baada ya siku mbili, na peleka picha zote kwa mtaalamu wa kilimo ikiwa dalili zinaenea.",
  ],
  disclaimer:
    "BedSense hutoa mapitio ya shambani, si utambuzi wa ugonjwa. Haitaji ugonjwa kwa uhakika, wala haitoi kipimo cha tiba au kipimo cha dawa. Thibitisha na mtaalamu wa kilimo au afisa ugani kabla ya kutibu kitanda.",
  agronomistCallout:
    "Muulize mtaalamu wa kilimo. Mwonyeshe picha hii na ukaguzi tatu kabla ya kununua au kuchanganya dawa yoyote.",
  countLine: (counts) =>
    `Alama — kitunguu ${counts.onion}, beetroot ${counts.beetroot}, pilipili ${counts.chili}, mmea mwingine ${counts.plant}, jani njano ${counts["yellow-leaf"]}, magugu ${counts.weed}.`,
  plantLine: ({ detectedPlant, cropFocus, primaryCrop }) => {
    const named =
      detectedPlant?.trim() ||
      (primaryCrop === "onion" ? "Kitunguu" : primaryCrop === "beetroot" ? "Beetroot" : primaryCrop === "chili" ? "Pilipili" : "");
    if (cropFocus === "mixed") {
      const lead = named || "Fremu hii";
      return `${lead} iko kwenye fremu hii pamoja na zao lingine. Picha ni kitanda kimoja. Kitunguu, beetroot, na pilipili hukuzwa kwenye vitanda tofauti, kwa hiyo mchanganyiko huu si wa kawaida.`;
    }
    if (named) return `Hii inaonekana kama ${named}.`;
    return "Hii inaonekana kama mmea wa shamba. Ukaguzi tatu bado unatumika.";
  },
  segmentFailed: (name) => `Alama za ${name} hazijarudi, kwa hiyo zinaweza kukosekana.`,
  levelLabel: (level) => (level === "low" ? "Chini" : level === "medium" ? "Wastani" : "Juu"),
};

export const copy: Record<Locale, Copy> = { en, sw };

export function normalizeLocale(value: unknown): Locale {
  return value === "sw" ? "sw" : "en";
}
