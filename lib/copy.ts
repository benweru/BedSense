import type { ConceptCounts, ConceptId, ConfidenceLevel, CropFocus, CropId, Locale } from "@/lib/types";

export type Copy = {
  kicker: string;
  title: string;
  lede: string;
  primary: string;
  secondary: string;
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
  fallbackActions: [string, string, string];
  disclaimer: string;
  agronomistCallout: string;
  countLine: (counts: ConceptCounts) => string;
  focusLine: (focus: CropFocus, primary: CropId | null) => string;
  segmentFailed: (name: string) => string;
  levelLabel: (level: ConfidenceLevel) => string;
};

const en: Copy = {
  kicker: "Meta Global AI Developer Hackathon · Indie · Build for Your World",
  title: "BedSense",
  lede: "Photograph any vegetable farm bed. SAM 3.1 marks the plants. Muse Spark returns exactly three next checks: practical, non-chemical things to look at or do next on the bed. Triage steps only — not a diagnosis, and not a treatment rate.",
  primary: "First",
  secondary: "Also",
  capture: "Take a photo",
  upload: "Choose a photo",
  hint: "Fill the frame with the bed. Morning light and a steady phone help.",
  preparing: "Preparing the photo…",
  analyzing: "SAM 3.1 is marking the bed. Muse Spark will return three next checks.",
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
  noMasks: "No plants were marked in this frame. Try a closer photo of the bed.",
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
    "yellow-leaf": "Yellow leaf",
    weed: "Weed",
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
    `Marks — onion ${counts.onion}, beetroot ${counts.beetroot}, chili ${counts.chili}, yellow leaf ${counts["yellow-leaf"]}, weed ${counts.weed}.`,
  focusLine: (focus, primary) => {
    if (focus === "unknown" || !primary) {
      return "No onion, beetroot, or chili plants were marked. Try a closer photo of the bed.";
    }
    if (focus === "onion") return "Onion is the crop this check follows first.";
    if (focus === "mixed") {
      const name = primary === "onion" ? "Onion" : primary === "beetroot" ? "Beetroot" : "Chili";
      return `${name} leads the marks on a mixed bed. Onion is still the crop BedSense watches first.`;
    }
    const name = focus === "beetroot" ? "Beetroot" : "Chili";
    return `${name} is the strongest mark. Onion stays the crop BedSense is built around.`;
  },
  segmentFailed: (name) => `${name} segmentation did not return, so those marks may be missing.`,
  levelLabel: (level) => (level === "low" ? "Low" : level === "medium" ? "Medium" : "High"),
};

const sw: Copy = {
  kicker: "Meta Global AI Developer Hackathon · Indie · Build for Your World",
  title: "BedSense",
  lede: "Piga picha ya kitanda chochote cha mboga shambani. SAM 3.1 inaweka alama kwenye mimea. Muse Spark inarudisha ukaguzi tatu hasa: mambo ya kivitendo, bila kemikali, ya kuangalia au kufanya kwenye kitanda. Hatua za mapitio tu — si utambuzi, wala kipimo cha tiba.",
  primary: "Kwanza",
  secondary: "Pia",
  capture: "Piga picha",
  upload: "Chagua picha",
  hint: "Jaza fremu na kitanda. Mwanga wa asubuhi na simu tulivu husaidia.",
  preparing: "Inatayarisha picha…",
  analyzing: "SAM 3.1 inaweka alama kwenye kitanda. Muse Spark itarudisha ukaguzi tatu.",
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
  noMasks: "Hakuna mimea iliyowekwa alama. Jaribu picha ya karibu zaidi ya kitanda.",
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
    "yellow-leaf": "Jani njano",
    weed: "Magugu",
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
    `Alama — kitunguu ${counts.onion}, beetroot ${counts.beetroot}, pilipili ${counts.chili}, jani njano ${counts["yellow-leaf"]}, magugu ${counts.weed}.`,
  focusLine: (focus, primary) => {
    if (focus === "unknown" || !primary) {
      return "Hakuna kitunguu, beetroot, wala pilipili vilivyowekwa alama. Jaribu picha ya karibu zaidi.";
    }
    if (focus === "onion") return "Kitunguu ndicho zao linalofuatiliwa kwanza katika ukaguzi huu.";
    if (focus === "mixed") {
      const name = primary === "onion" ? "Kitunguu" : primary === "beetroot" ? "Beetroot" : "Pilipili";
      return `${name} linaongoza alama kwenye kitanda kilichochanganyika. Kitunguu bado ndicho zao ambalo BedSense inalinda kwanza.`;
    }
    const name = focus === "beetroot" ? "Beetroot" : "Pilipili";
    return `${name} ndiyo alama kali zaidi. Kitunguu kinabaki zao ambalo BedSense imejengwa kulizungumzia.`;
  },
  segmentFailed: (name) => `Alama za ${name} hazijarudi, kwa hiyo zinaweza kukosekana.`,
  levelLabel: (level) => (level === "low" ? "Chini" : level === "medium" ? "Wastani" : "Juu"),
};

export const copy: Record<Locale, Copy> = { en, sw };

export function normalizeLocale(value: unknown): Locale {
  return value === "sw" ? "sw" : "en";
}
