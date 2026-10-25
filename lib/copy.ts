import type { ChemicalQuality, ConceptCounts, ConceptId, ConfidenceLevel, CropFocus, CropId, Locale } from "@/lib/types";

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
  plantNameLabel: string;
  plantNamePlaceholder: string;
  plantNameRequired: string;
  plantNameHint: string;
  hypotheses: string;
  hypothesesHint: string;
  chemicalsTitle: string;
  chemicalsHint: string;
  qualityLabel: (quality: ChemicalQuality) => string;
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
  levelLabel: (level: ConfidenceLevel) => string;
};

const en: Copy = {
  kicker: "Meta Global AI Developer Hackathon · Indie · Build for Your World",
  title: "BedSense",
  lede: "Name the plant, then photograph a bed, a leaf, or fruit in your hand. SAM 3.1 and Muse Spark read that photo and any notes you add. You get exactly three next checks, likely causes when something looks wrong, and Kenyan shop options when a product would help. Not a diagnosis, and not a treatment rate.",
  supportLine: "Works well with onion. Often used for beetroot and chili.",
  supportNote:
    "Each of those crops grows on its own bed. Onion and beetroot are never on the same bed, and chili is a separate bed too. Any other farm plant is welcome.",
  capture: "Take a photo",
  upload: "Choose a photo",
  hint: "Fill the frame with one plant or one bed. Morning light and a steady phone help.",
  preparing: "Preparing the photo…",
  analyzing: "Reading the photo, the plant name, and your notes.",
  retake: "New photo",
  retry: "Try again",
  observations: "What stands out",
  actions: "Three next checks",
  actionsHint: "Practical checks for this plant. Not a diagnosis or a treatment rate.",
  confidence: "Confidence",
  low: "Low",
  medium: "Medium",
  high: "High",
  history: "Recent checks",
  historyEmpty: "Your last five checks stay on this phone.",
  clear: "Clear",
  marks: "Marks",
  noMasks: "No plant marks landed in this frame. The photo, the plant name, and your notes are still used.",
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
  footer: "Hypotheses, not a diagnosis. No spray doses.",
  concepts: {
    onion: "Onion",
    beetroot: "Beetroot",
    chili: "Chili",
    plant: "Other plant",
    "yellow-leaf": "Yellow leaf",
    weed: "Weed",
  },
  unknownPlant: "Farm plant",
  plantNameLabel: "Plant",
  plantNamePlaceholder: "Onion / mf. Kitunguu",
  plantNameRequired: "Name the plant before you take the photo.",
  plantNameHint: "Any plant. A bed, a leaf, or fruit in your hand.",
  hypotheses: "Likely causes",
  hypothesesHint: "Possibilities to check. Not a diagnosis.",
  chemicalsTitle: "Chemicals and Kenyan shops",
  chemicalsHint: "Indicative KES bands by quality. A licensed agrovet confirms the product and the label rate. BedSense does not give a spray dose.",
  qualityLabel: (quality) => (quality === "economy" ? "Economy" : quality === "standard" ? "Standard" : "Premium"),
  contextTitle: "Add context (optional)",
  contextHint: "Plant age or stage, current practices, chemicals already used, recent weather or irrigation, known issues, or a note. This is not required.",
  contextAskLabel: "A clearer check would use this",
  contextUpdate: "Update the check",
  contextAskDefault: "If you know it, add the plant’s age and when you last watered.",
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
    "BedSense offers field hypotheses, not a diagnosis. It does not give a treatment rate or a spray dose. Confirm with a qualified agronomist or a licensed agrovet before you treat the bed.",
  agronomistCallout:
    "Ask an agronomist or a licensed agrovet. Show them this photo, the likely causes, and any listed product before you buy or mix a spray.",
  countLine: (counts) => {
    const parts = [
      counts.onion ? `onion ${counts.onion}` : "",
      counts.beetroot ? `beetroot ${counts.beetroot}` : "",
      counts.chili ? `chili ${counts.chili}` : "",
      counts.plant ? `other plant ${counts.plant}` : "",
      counts["yellow-leaf"] ? `yellow leaf ${counts["yellow-leaf"]}` : "",
      counts.weed ? `weed ${counts.weed}` : "",
    ].filter(Boolean);
    return parts.length ? `In this frame: ${parts.join(", ")}.` : "";
  },
  plantLine: ({ detectedPlant, cropFocus, primaryCrop }) => {
    const named = detectedPlant?.trim() || (primaryCrop === "onion" ? "Onion" : primaryCrop === "beetroot" ? "Beetroot" : primaryCrop === "chili" ? "Chili" : "");
    if (cropFocus === "mixed") {
      const lead = named || "This frame";
      return `${lead} is in this frame with another crop. A photo is one bed. Onion, beetroot, and chili are grown on different beds, so more than one of them here is unusual.`;
    }
    if (named) return `This looks like ${named}.`;
    return "This looks like a farm plant. The three next checks still apply.";
  },
  levelLabel: (level) => (level === "low" ? "Low" : level === "medium" ? "Medium" : "High"),
};

const sw: Copy = {
  kicker: "Meta Global AI Developer Hackathon · Indie · Build for Your World",
  title: "BedSense",
  lede: "Taja mmea, kisha piga picha ya kitanda, jani, au tunda mkononi. SAM 3.1 na Muse Spark zinasoma picha hiyo na maelezo yako. Unapata ukaguzi tatu hasa, visababishi vinavyowezekana, na maduka ya Kenya ikiwa dawa ingesaidia. Si utambuzi, wala kipimo cha tiba.",
  supportLine: "Hufanya kazi vizuri na kitunguu. Hutumika mara nyingi kwa beetroot na pilipili.",
  supportNote:
    "Kila moja ya mazao hayo iko kwenye kitanda chake. Kitunguu na beetroot havipandwi kamwe kwenye kitanda kimoja, na pilipili iko kwenye kitanda chake. Mmea mwingine wowote shambani unakubalika.",
  capture: "Piga picha",
  upload: "Chagua picha",
  hint: "Jaza fremu na mmea mmoja au kitanda kimoja. Mwanga wa asubuhi na simu tulivu husaidia.",
  preparing: "Inatayarisha picha…",
  analyzing: "Inasoma picha, jina la mmea, na maelezo yako.",
  retake: "Picha nyingine",
  retry: "Jaribu tena",
  observations: "Kinachoonekana",
  actions: "Ukaguzi tatu unaofuata",
  actionsHint: "Ukaguzi wa kivitendo kwa mmea huu. Si utambuzi wala kipimo cha tiba.",
  confidence: "Imani",
  low: "Chini",
  medium: "Wastani",
  high: "Juu",
  history: "Ukaguzi wa hivi karibuni",
  historyEmpty: "Ukaguzi tano wa mwisho unabaki kwenye simu hii.",
  clear: "Futa",
  marks: "Alama",
  noMasks: "Hakuna alama za mmea kwenye fremu hii. Picha, jina la mmea, na maelezo yako bado yanatumika.",
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
  footer: "Nadharia, si utambuzi. Hakuna vipimo vya dawa.",
  concepts: {
    onion: "Kitunguu",
    beetroot: "Beetroot",
    chili: "Pilipili",
    plant: "Mmea mwingine",
    "yellow-leaf": "Jani njano",
    weed: "Magugu",
  },
  unknownPlant: "Mmea wa shamba",
  plantNameLabel: "Mmea",
  plantNamePlaceholder: "Kitunguu / mf. Onion",
  plantNameRequired: "Taja mmea kabla ya kupiga picha.",
  plantNameHint: "Mmea wowote. Kitanda, jani, au tunda mkononi.",
  hypotheses: "Visababishi vinavyowezekana",
  hypothesesHint: "Uwezekano wa kukagua. Si utambuzi.",
  chemicalsTitle: "Kemikali na maduka ya Kenya",
  chemicalsHint: "Viwango vya KES kwa ubora, si bei rasmi. Agrovet yenye leseni inathibitisha dawa na maagizo ya lebo. BedSense haitoi kipimo cha dawa.",
  qualityLabel: (quality) => (quality === "economy" ? "Bei nafuu" : quality === "standard" ? "Kawaida" : "Daraja la juu"),
  contextTitle: "Ongeza muktadha (si lazima)",
  contextHint: "Umri au hatua ya mmea, mazoea, kemikali zilizotumika, hali ya hewa au umwagiliaji, matatizo unayoyajua, au maelezo. Haihitajiki.",
  contextAskLabel: "Ukaguzi ulio wazi zaidi ungetumia hili",
  contextUpdate: "Sasisha ukaguzi",
  contextAskDefault: "Ikiwa unajua, ongeza umri wa mmea na lini ulimwagilia mara ya mwisho.",
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
    "BedSense hutoa nadharia za shambani, si utambuzi. Haitoi kipimo cha tiba wala kipimo cha dawa. Thibitisha na mtaalamu wa kilimo au agrovet yenye leseni kabla ya kutibu kitanda.",
  agronomistCallout:
    "Muulize mtaalamu wa kilimo au agrovet yenye leseni. Mwonyeshe picha hii, visababishi, na dawa iliyoorodheshwa kabla ya kununua au kuchanganya dawa.",
  countLine: (counts) => {
    const parts = [
      counts.onion ? `kitunguu ${counts.onion}` : "",
      counts.beetroot ? `beetroot ${counts.beetroot}` : "",
      counts.chili ? `pilipili ${counts.chili}` : "",
      counts.plant ? `mmea mwingine ${counts.plant}` : "",
      counts["yellow-leaf"] ? `jani njano ${counts["yellow-leaf"]}` : "",
      counts.weed ? `magugu ${counts.weed}` : "",
    ].filter(Boolean);
    return parts.length ? `Katika fremu hii: ${parts.join(", ")}.` : "";
  },
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
  levelLabel: (level) => (level === "low" ? "Chini" : level === "medium" ? "Wastani" : "Juu"),
};

export const copy: Record<Locale, Copy> = { en, sw };

export function normalizeLocale(value: unknown): Locale {
  return value === "sw" ? "sw" : "en";
}
