import type { ConceptCounts, ConceptId, ConfidenceLevel, CropFocus, CropId, Locale, QualityBand } from "@/lib/types";

export type PlantLineInput = {
  detectedPlant?: string | null;
  cropFocus: CropFocus;
  primaryCrop: CropId | null;
};

export type Copy = {
  kicker: string;
  title: string;
  lede: string;
  plantNameLabel: string;
  plantNameHint: string;
  plantNamePlaceholder: string;
  plantNameMissing: string;
  capture: string;
  upload: string;
  checkPhoto: string;
  hint: string;
  preparing: string;
  analyzing: string;
  retake: string;
  retry: string;
  observations: string;
  actions: string;
  actionsHint: string;
  chemicalsTitle: string;
  chemicalsSuspect: string;
  chemicalsWhere: string;
  chemicalsNoShop: string;
  chemicalsSuspectFallback: string;
  chemicalClassFallback: string;
  chemicalUseFallback: string;
  verifyNote: string;
  priceNote: string;
  quality: Record<QualityBand, string>;
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
  lede: "Photograph any plant on your farm bed. Meta intelligence models read the photo and return diagnoses and practical things to look at or do next.",
  plantNameLabel: "What plant is in the photo?",
  plantNameHint: "Required. The name is sent with the photo so the check can follow that plant.",
  plantNamePlaceholder: "For example, onion",
  plantNameMissing: "Name the plant in the photo before the check runs.",
  capture: "Take a photo",
  upload: "Choose a photo",
  checkPhoto: "Check this photo",
  hint: "Fill the frame with one plant or one bed. Morning light and a steady phone help.",
  preparing: "Preparing the photo…",
  analyzing: "Reading the plant you named. Three next checks come next.",
  retake: "New photo",
  retry: "Try again",
  observations: "What stands out",
  actions: "Three next checks",
  actionsHint: "Practical things to look at or do next on the bed. Not a diagnosis or a spray rate.",
  chemicalsTitle: "Chemicals to consider",
  chemicalsSuspect: "Suspected problem",
  chemicalsWhere: "Where to buy in Kenya",
  chemicalsNoShop: "This active ingredient is not in the Kenya catalog yet. Ask an agrovet to match the name.",
  chemicalsSuspectFallback: "A disease or pest looks likely.",
  chemicalClassFallback: "crop protection product",
  chemicalUseFallback: "Typical use for this active ingredient. The rate must follow the product label.",
  verifyNote:
    "Check this with a local agroveterinary officer before you buy or spray. The rate must follow the product label.",
  priceNote:
    "Example Kenyan shops and KES price bands by quality, from the BedSense catalog. Not a live quote. Ask the shop for today’s price.",
  quality: { economy: "Economy", mid: "Mid", premium: "Premium" },
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
  askAgronomist: "Ask an agroveterinary officer",
  beforeYouAct: "Before you act",
  modeMock: "Demo mode",
  modeLive: "Live models",
  backupNote: "This advice came from the on-phone backup because Muse Spark did not answer.",
  footer: "Triage, not a diagnosis. Spray rates follow the product label.",
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
    "BedSense offers field triage, not a diagnosis. When a disease or pest looks likely, it names chemicals and active ingredients to consider, plus example Kenyan shops and KES price bands. It does not set a spray rate. Follow the product label, and confirm with a local agroveterinary officer before you buy or spray.",
  agronomistCallout:
    "Ask a local agroveterinary officer. Show them this photo, the plant name, and these three next checks before you buy or mix any spray.",
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
  lede: "Piga picha ya mmea wowote kwenye kitanda chako. Modeli za akili za Meta zinasoma picha na kurudisha utambuzi na mambo ya kivitendo ya kuangalia au kufanya.",
  plantNameLabel: "Mmea gani uko kwenye picha?",
  plantNameHint: "Inahitajika. Jina linatumwa pamoja na picha ili ukaguzi ufuatilie mmea huo.",
  plantNamePlaceholder: "Kwa mfano, kitunguu",
  plantNameMissing: "Taja mmea ulio kwenye picha kabla ya ukaguzi.",
  capture: "Piga picha",
  upload: "Chagua picha",
  checkPhoto: "Kagua picha hii",
  hint: "Jaza fremu na mmea mmoja au kitanda kimoja. Mwanga wa asubuhi na simu tulivu husaidia.",
  preparing: "Inatayarisha picha…",
  analyzing: "Inasoma mmea ulioutaja. Ukaguzi tatu unafuata.",
  retake: "Picha nyingine",
  retry: "Jaribu tena",
  observations: "Kinachoonekana",
  actions: "Ukaguzi tatu unaofuata",
  actionsHint: "Mambo ya kivitendo ya kuangalia au kufanya kwenye kitanda. Si utambuzi wala kipimo cha dawa.",
  chemicalsTitle: "Kemikali za kuzingatia",
  chemicalsSuspect: "Tatizo linaloshukiwa",
  chemicalsWhere: "Mahali pa kununua Kenya",
  chemicalsNoShop: "Kemikali hii tendaji bado haiko kwenye orodha ya Kenya. Muulize muuzaji wa agrovet ailinganishe jina.",
  chemicalsSuspectFallback: "Inawezekana kuna ugonjwa au wadudu.",
  chemicalClassFallback: "bidhaa ya kulinda mmea",
  chemicalUseFallback: "Matumizi ya kawaida ya kemikali hii tendaji. Kipimo kifuate kibandiko cha bidhaa.",
  verifyNote:
    "Thibitisha na afisa wa agroveterinary wa eneo lako kabla ya kununua au kunyunyizia. Kipimo kifuate kibandiko cha bidhaa.",
  priceNote:
    "Mifano ya maduka ya Kenya na viwango vya bei kwa KES kulingana na ubora, kutoka kwenye orodha ya BedSense. Si bei ya sasa. Uliza dukani bei ya leo.",
  quality: { economy: "Bei nafuu", mid: "Kati", premium: "Ya juu" },
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
  askAgronomist: "Muulize afisa wa agroveterinary",
  beforeYouAct: "Kabla ya kutenda",
  modeMock: "Hali ya onyesho",
  modeLive: "Modeli hai",
  backupNote: "Ushauri huu umetoka kwenye chelezo ya ndani kwa sababu Muse Spark haijajibu.",
  footer: "Mapitio si utambuzi. Vipimo vya dawa vinafuata kibandiko.",
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
    "BedSense hutoa mapitio ya shambani, si utambuzi. Ugonjwa au wadudu wanapoonekana kuwa karibu, inataja kemikali na viambato vya kuzingatia, pamoja na mifano ya maduka ya Kenya na viwango vya bei kwa KES. Haitoi kipimo cha dawa. Fuata kibandiko cha bidhaa, na thibitisha na afisa wa agroveterinary wa eneo lako kabla ya kununua au kunyunyizia.",
  agronomistCallout:
    "Muulize afisa wa agroveterinary wa eneo lako. Mwonyeshe picha hii, jina la mmea, na ukaguzi tatu kabla ya kununua au kuchanganya dawa yoyote.",
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
