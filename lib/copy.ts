import { CONCEPT_IDS, type ConceptCounts, type ConceptId, type ConfidenceLevel, type CropFocus, type CropId, type Locale, type QualityBand } from "@/lib/types";

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
  newCheck: string;
  capture: string;
  upload: string;
  checkPhoto: string;
  checkPhotos: string;
  addAngle: string;
  removePhoto: string;
  photoLimit: string;
  qualityTooFar: string;
  qualityNotPlant: string;
  qualityUnclear: string;
  qualityMixed: string;
  qualityHarshLight: (frames: number[], total: number) => string;
  qualityBatch: (kept: number[], skipped: { frame: number; lighting: boolean }[]) => string;
  hint: string;
  preparing: string;
  analyzing: string;
  retake: string;
  retry: string;
  observations: string;
  likelyCauses: string;
  likelyCausesHint: string;
  mitigations: string;
  mitigationsHint: string;
  actions: string;
  actionsHint: string;
  progressTitle: string;
  progressHint: string;
  progressSteps: [string, string, string];
  chemicalsTitle: string;
  chemicalsSuspect: string;
  chemicalsWhere: string;
  chemicalsNoShop: string;
  chemicalsSuspectFallback: string;
  chemicalClassFallback: string;
  chemicalUseFallback: string;
  verifyNote: string;
  fertilizerVerifyNote: string;
  priceNote: string;
  quality: Record<QualityBand, string>;
  confidence: string;
  low: string;
  medium: string;
  high: string;
  history: string;
  historyEmpty: string;
  historyHold: string;
  clear: string;
  deleteCheck: string;
  deleteCheckAsk: string;
  keepCheck: string;
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
  museUnavailable: string;
  footer: string;
  back: string;
  profile: string;
  account: string;
  signedOut: string;
  signOut: string;
  concepts: Record<ConceptId, string>;
  unknownPlant: string;
  dropPhoto: string;
  currentCheck: string;
  contextTitle: string;
  contextHint: string;
  contextGuide: string;
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
  voiceHold: string;
  voiceFinish: string;
  voiceListening: string;
  voiceWriting: string;
  voiceInto: string;
  voiceFailed: string;
  voiceEmpty: string;
  voiceUnsupported: string;
  voiceUnavailable: string;
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
  plantNamePlaceholder: "e.g. Onion",
  plantNameMissing: "Please fill this in. Name the plant in the photo before the check runs.",
  newCheck: "New check",
  capture: "Take a photo",
  upload: "Choose a photo",
  checkPhoto: "Check this plant",
  checkPhotos: "Check these photos",
  addAngle: "Add another angle",
  removePhoto: "Remove",
  photoLimit: "Three photos is the limit for one check.",
  qualityTooFar: "Move closer to the bed. This photo is too far away for a reliable check.",
  qualityNotPlant: "We couldn't find a plant in this photo. Take a picture of the plant or bed you want checked.",
  qualityUnclear: "This photo is not clearly in view. Hold the phone steady and fill the frame with the plant.",
  qualityMixed: "Move closer and take a clearer photo. These ones are too far away or not clearly in view.",
  qualityHarshLight: (frames, total) => {
    const subject =
      total === 1 ? "the image" : frames.length === 1 ? `image ${frames[0]}` : `images ${frames.join(" and ")}`;
    return `Lighting in ${subject} is not good enough. Please upload ${frames.length === 1 ? "an image" : "images"} with better lighting.`;
  },
  qualityBatch: (kept, skipped) => {
    const lit = skipped.filter((item) => item.lighting).map((item) => item.frame);
    const other = skipped.filter((item) => !item.lighting).map((item) => item.frame);
    const keptClause =
      kept.length === 1
        ? `This check only used image ${kept[0]}.`
        : `This check only used the ${kept.length} good images (${kept.join(" and ")}).`;
    const clauses = [keptClause];
    if (lit.length > 0) {
      const list = lit.join(" and ");
      clauses.push(
        lit.length === 1
          ? `Image ${list} was left out because the lighting is not good enough. Please upload it again with better lighting.`
          : `Images ${list} were left out because the lighting is not good enough. Please upload them again with better lighting.`,
      );
    }
    if (other.length > 0) {
      const list = other.join(" and ");
      clauses.push(
        other.length === 1
          ? `Image ${list} was left out because it was too far away or not clear enough.`
          : `Images ${list} were left out because they were too far away or not clear enough.`,
      );
    }
    return clauses.join(" ");
  },
  hint: "Fill the frame with one plant or one bed. Morning light and a steady phone help.",
  preparing: "Preparing the photo…",
  analyzing: "Reading the plant you named. Causes and next checks come next.",
  retake: "New photo",
  retry: "Try again",
  observations: "What stands out",
  likelyCauses: "Likely causes",
  likelyCausesHint: "Hypotheses for this symptom. Not a diagnosis.",
  mitigations: "How to mitigate",
  mitigationsHint: "Steps on the bed: culture, monitoring, sanitation, and water. A spray is listed only when it is the usual next step.",
  actions: "Three next checks",
  actionsHint: "Practical things to look at or do next on this plant. Not a diagnosis or a spray rate.",
  progressTitle: "Checking this photo",
  progressHint: "The bed is being read. Keep this screen open.",
  progressSteps: ["Preparing the photo", "Reading the bed", "Writing causes and next steps"],
  chemicalsTitle: "Chemicals and fertilizer to consider",
  chemicalsSuspect: "Suspected problem",
  chemicalsWhere: "Where to buy in Kenya",
  chemicalsNoShop: "This active ingredient is not in the Kenya catalog yet. Ask an agrovet to match the name.",
  chemicalsSuspectFallback: "A disease or pest looks likely.",
  chemicalClassFallback: "crop protection product",
  chemicalUseFallback: "Typical use for this active ingredient. The rate must follow the product label.",
  verifyNote:
    "Check this with a local agroveterinary officer before you buy or spray. The rate must follow the product label.",
  fertilizerVerifyNote:
    "Check this with a local agroveterinary officer before you buy or apply fertilizer. The rate must follow the product label.",
  priceNote:
    "Example Kenyan shops and KES price bands by quality, from the BedSense catalog. Not a live quote. Ask the shop for today’s price.",
  quality: { economy: "Economy", mid: "Mid", premium: "Premium" },
  confidence: "Confidence",
  low: "Low",
  medium: "Medium",
  high: "High",
  history: "Recent checks",
  historyEmpty: "Your last five checks stay on this phone.",
  historyHold: "Hold a check to delete it, or choose Delete.",
  clear: "Clear",
  deleteCheck: "Delete this check",
  deleteCheckAsk: "Delete this recent check? It will be removed from this phone only.",
  keepCheck: "Keep",
  marks: "Marks",
  noMasks: "Few marks landed in this frame. The named plant is still checked.",
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
  museUnavailable:
    "Muse Spark is not available for this key. In the Meta Model API dashboard, enable a Muse Spark or Muse Wonder chat model, then run the check again.",
  footer: "Triage, not a diagnosis. Spray rates follow the product label.",
  back: "Back",
  profile: "Profile",
  account: "Account",
  signedOut: "You are not signed in.",
  signOut: "Sign out",
  concepts: {
    onion: "Onion",
    beetroot: "Beetroot",
    chili: "Chili",
    plant: "Other plant",
    "yellow-leaf": "Yellow leaf",
    weed: "Weed",
  },
  unknownPlant: "Farm plant",
  dropPhoto: "Or drop a photo here",
  currentCheck: "This is the open check",
  contextTitle: "Context or a question",
  contextHint: "Add what you know, or ask a question about this plant.",
  contextGuide:
    "Optional. Add plant age, practices, sprays, fertilizer, water, weather, or known issues. You can also ask a question, such as whether to water today.",
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
  voiceHold: "Tap to talk",
  voiceFinish: "Tap to finish",
  voiceListening: "Listening… tap to finish",
  voiceWriting: "Writing what you said…",
  voiceInto: "Add the words to",
  voiceFailed: "The voice note did not transcribe. Type the note, or tap to talk and try again.",
  voiceEmpty: "Nothing was heard. Tap to talk, then speak, then tap to finish.",
  voiceUnsupported: "This browser cannot record a voice note. Type the context instead.",
  voiceUnavailable: "Muse Voice is not available for this key. Type the note, or enable Muse Voice Transcribe in the Meta Model API dashboard.",
  fallbackActions: [
    "Press a finger a few centimetres into the soil and water only if it feels dry.",
    "Lift the worst leaves off the bed so they do not sit on healthy plants.",
    "Photograph the same plants again in two days and show both photos to an agronomist if the marks spread.",
  ],
  disclaimer:
    "BedSense offers field triage, not a diagnosis. When a symptom is visible, it names likely causes and practical steps on the bed. A spray or a fertilizer, with example Kenyan shops and KES price bands, appears only when it is the usual next step. It does not set a rate. Follow the product label, and confirm with a local agroveterinary officer before you buy or spray.",
  agronomistCallout:
    "Ask a local agroveterinary officer. Show them this photo, the plant name, and these three next checks before you buy or mix any spray.",
  countLine: (counts) =>
    frameCount(
      {
        onion: "onion",
        beetroot: "beetroot",
        chili: "chili",
        plant: "other plant",
        "yellow-leaf": "yellow leaf",
        weed: "weed",
      },
      counts,
      "No plants were marked in this frame.",
      "In this frame —",
    ),
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
  lede: "Piga picha ya mmea wowote shambani kwako. Modeli za akili za Meta zinaangalia picha na kukuambia tatizo linaloweza kuwa, na unachoweza kukagua au kufanya.",
  plantNameLabel: "Mmea gani uko kwenye picha?",
  plantNameHint: "Lazima ujaze. Jina hili hutumwa pamoja na picha ili ukaguzi ufuatilie mmea huo.",
  plantNamePlaceholder: "mf. Kitunguu",
  plantNameMissing: "Tafadhali andika jina la mmea ulio kwenye picha kabla ya kukagua.",
  newCheck: "Ukaguzi mpya",
  capture: "Piga picha",
  upload: "Chagua picha",
  checkPhoto: "Kagua mmea huu",
  checkPhotos: "Kagua picha hizi",
  addAngle: "Piga picha upande mwingine",
  removePhoto: "Ondoa",
  photoLimit: "Unaweza kutumia picha tatu tu kwa ukaguzi mmoja.",
  qualityTooFar: "Sogea karibu na kitalu. Picha hii iko mbali sana kukaguliwa vizuri.",
  qualityNotPlant: "Hatukuona mmea kwenye picha hii. Piga picha ya mmea au kitalu unachotaka kukagua.",
  qualityUnclear: "Picha hii haiko wazi. Shika simu bila kutikisika, na mmea ujae kwenye picha.",
  qualityMixed: "Sogea karibu upige picha iliyo wazi zaidi. Picha hizi ziko mbali sana au hazionekani vizuri.",
  qualityHarshLight: (frames, total) => {
    const subject = total === 1 ? "picha hii" : `picha ${frames.join(" na ")}`;
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} haina mwanga mzuri. Tafadhali piga au pakia picha yenye mwanga mzuri zaidi.`;
  },
  qualityBatch: (kept, skipped) => {
    const lit = skipped.filter((item) => item.lighting).map((item) => item.frame);
    const other = skipped.filter((item) => !item.lighting).map((item) => item.frame);
    const clauses = [
      kept.length === 1
        ? `Ukaguzi huu ulitumia picha ${kept[0]} pekee.`
        : `Ukaguzi huu ulitumia picha ${kept.length} nzuri pekee (${kept.join(" na ")}).`,
    ];
    if (lit.length > 0) {
      clauses.push(
        `Picha ${lit.join(" na ")} ${lit.length === 1 ? "iliachwa" : "ziliachwa"} kwa sababu mwanga hautoshi. Tafadhali pakia tena picha yenye mwanga mzuri zaidi.`,
      );
    }
    if (other.length > 0) {
      clauses.push(
        other.length === 1
          ? `Picha ${other[0]} iliachwa kwa sababu ilikuwa mbali sana au haikuonekana vizuri.`
          : `Picha ${other.join(" na ")} ziliachwa kwa sababu zilikuwa mbali sana au hazikuonekana vizuri.`,
      );
    }
    return clauses.join(" ");
  },
  hint: "Mmea mmoja au kitalu kimoja kijae kwenye picha. Mwanga wa asubuhi na kushika simu bila kutikisika husaidia.",
  preparing: "Inaandaa picha…",
  analyzing: "Inakagua mmea uliotaja. Sababu na hatua zinakuja.",
  retake: "Piga picha tena",
  retry: "Jaribu tena",
  observations: "Kinachoonekana",
  likelyCauses: "Sababu zinazowezekana",
  likelyCausesHint: "Huenda hizi ndizo sababu za dalili hii. Si jibu la uhakika.",
  mitigations: "Unachoweza kufanya",
  mitigationsHint: "Hatua za kuchukua shambani: utunzaji, kufuatilia, usafi na maji. Dawa inatajwa tu ikiwa ndiyo hatua ya kawaida inayofuata.",
  actions: "Mambo matatu ya kukagua",
  actionsHint: "Mambo ya kuangalia au kufanya kwenye mmea huu. Si jibu la uhakika wala kipimo cha dawa.",
  progressTitle: "Inakagua picha hii",
  progressHint: "Tunakagua picha. Usifunge ukurasa huu.",
  progressSteps: ["Inaandaa picha", "Inakagua kitalu", "Inaandika sababu na hatua"],
  chemicalsTitle: "Dawa na mbolea unazoweza kutumia",
  chemicalsSuspect: "Tatizo linaloshukiwa",
  chemicalsWhere: "Unapoweza kununua Kenya",
  chemicalsNoShop: "Dawa hii bado haiko kwenye orodha yetu ya Kenya. Muulize muuzaji wa agrovet akupe yenye kiambato hicho.",
  chemicalsSuspectFallback: "Huenda kuna ugonjwa au wadudu.",
  chemicalClassFallback: "dawa ya kulinda mimea",
  chemicalUseFallback: "Matumizi ya kawaida ya dawa hii. Fuata kipimo kilicho kwenye kibandiko.",
  verifyNote:
    "Uliza mtaalamu wa agroveterinary wa eneo lako kabla ya kununua au kunyunyizia. Fuata kipimo kilicho kwenye kibandiko.",
  fertilizerVerifyNote:
    "Uliza mtaalamu wa agroveterinary wa eneo lako kabla ya kununua au kutumia mbolea. Fuata kipimo kilicho kwenye kibandiko.",
  priceNote:
    "Mifano ya maduka ya Kenya na bei kwa KES kulingana na ubora, kutoka orodha ya BedSense. Hizi si bei za leo. Uliza dukani bei ya sasa.",
  quality: { economy: "Bei nafuu", mid: "Ya kati", premium: "Ya juu" },
  confidence: "Uhakika",
  low: "Chini",
  medium: "Wastani",
  high: "Juu",
  history: "Ukaguzi wa hivi karibuni",
  historyEmpty: "Ukaguzi wako tano wa mwisho huhifadhiwa kwenye simu hii.",
  historyHold: "Bonyeza na ushikilie ukaguzi ili kuufuta, au chagua Futa.",
  clear: "Futa",
  deleteCheck: "Futa ukaguzi huu",
  deleteCheckAsk: "Futa ukaguzi huu? Utafutwa kwenye simu hii pekee.",
  keepCheck: "Usifute",
  marks: "Alama",
  noMasks: "Hakuna alama nyingi kwenye picha hii. Bado tunakagua mmea uliotaja.",
  errorGeneric: "Ukaguzi haukukamilika. Jaribu picha nyingine.",
  errorFormat: "Picha hii haikufunguka. Piga picha tena au chagua JPEG.",
  language: "Lugha",
  english: "English",
  swahili: "Kiswahili",
  askAgronomist: "Uliza mtaalamu wa kilimo",
  beforeYouAct: "Kabla hujaanza",
  modeMock: "Onyesho",
  modeLive: "Moja kwa moja",
  backupNote: "Ushauri huu umetoka kwenye hifadhi ya simu kwa sababu Muse Spark haikujibu.",
  museUnavailable:
    "Muse Spark haipatikani kwa ufunguo huu. Kwenye dashibodi ya Meta Model API, washa modeli ya Muse Spark au Muse Wonder, kisha jaribu kukagua tena.",
  footer: "Huu ni mwongozo, si jibu la uhakika. Fuata kipimo cha dawa kilicho kwenye kibandiko.",
  back: "Rudi",
  profile: "Wasifu",
  account: "Akaunti",
  signedOut: "Hujaingia.",
  signOut: "Ondoka",
  concepts: {
    onion: "Kitunguu",
    beetroot: "Beetroot",
    chili: "Pilipili",
    plant: "Mmea mwingine",
    "yellow-leaf": "Majani ya njano",
    weed: "Magugu",
  },
  unknownPlant: "Mmea wa shamba",
  dropPhoto: "Au buruta picha hapa",
  currentCheck: "Ukaguzi unaoangalia sasa",
  contextTitle: "Maelezo au swali",
  contextHint: "Ongeza unachojua, au uliza swali kuhusu mmea huu.",
  contextGuide:
    "Si lazima. Andika umri wa mmea, unavyoutunza, dawa, mbolea, maji, hali ya hewa au matatizo uliyoona. Unaweza pia kuuliza swali, kama vile kama umwagilie leo.",
  contextAskLabel: "Haya yangesaidia ukaguzi kuwa sahihi zaidi",
  contextUpdate: "Sasisha ukaguzi",
  contextAskDefault: "Kama unajua, andika umri wa mmea na mara ya mwisho ulipomwagilia.",
  contextNoted: "Maelezo yako yametumika kwenye ukaguzi huu.",
  contextFields: {
    stage: "Umri au hatua ya mmea",
    practices: "Unavyoutunza sasa",
    chemicals: "Dawa ulizotumia",
    weather: "Hali ya hewa au umwagiliaji",
    issues: "Matatizo uliyoona",
    notes: "Mengineyo",
  },
  voiceHold: "Bonyeza kuongea",
  voiceFinish: "Bonyeza kumaliza",
  voiceListening: "Inasikiliza… bonyeza kumaliza",
  voiceWriting: "Inaandika ulichosema…",
  voiceInto: "Weka maneno kwenye",
  voiceFailed: "Sauti haikuandikwa. Andika maelezo, au bonyeza kuongea ujaribu tena.",
  voiceEmpty: "Hakuna kilichosikika. Bonyeza kuongea, sema, kisha bonyeza kumaliza.",
  voiceUnsupported: "Kivinjari hiki hakiwezi kurekodi sauti. Andika maelezo badala yake.",
  voiceUnavailable: "Muse Voice haipatikani kwa ufunguo huu. Andika maelezo, au washa Muse Voice Transcribe kwenye dashibodi ya Meta Model API.",
  fallbackActions: [
    "Ingiza kidole sentimita chache kwenye udongo; mwagilia tu ikiwa ni mkavu.",
    "Ondoa majani yaliyoathirika zaidi ili yasiguse mimea mizima.",
    "Piga picha tena baada ya siku mbili, na umpelekee mtaalamu wa kilimo picha zote ikiwa dalili zinaenea.",
  ],
  disclaimer:
    "BedSense inakupa mwongozo wa shambani, si utambuzi kamili. Dalili ikionekana, inataja sababu zinazowezekana na hatua za kuchukua shambani. Dawa au mbolea, pamoja na mifano ya maduka ya Kenya na bei kwa KES, inatajwa tu ikiwa ndiyo hatua ya kawaida inayofuata. Haitoi kipimo. Fuata kibandiko cha bidhaa, na uliza mtaalamu wa agroveterinary wa eneo lako kabla ya kununua, kunyunyizia, au kuweka mbolea.",
  agronomistCallout:
    "Uliza mtaalamu wa agroveterinary wa eneo lako. Mwonyeshe picha hii, jina la mmea, na mambo matatu ya kukagua kabla ya kununua au kuchanganya dawa yoyote.",
  countLine: (counts) =>
    frameCount(
      {
        onion: "kitunguu",
        beetroot: "beetroot",
        chili: "pilipili",
        plant: "mmea mwingine",
        "yellow-leaf": "majani ya njano",
        weed: "magugu",
      },
      counts,
      "Hakuna mimea iliyowekwa alama kwenye picha hii.",
      "Kwenye picha hii —",
    ),
  plantLine: ({ detectedPlant, cropFocus, primaryCrop }) => {
    const named =
      detectedPlant?.trim() ||
      (primaryCrop === "onion" ? "Kitunguu" : primaryCrop === "beetroot" ? "Beetroot" : primaryCrop === "chili" ? "Pilipili" : "");
    if (cropFocus === "mixed") {
      const lead = named || "Picha hii";
      return `${lead} iko kwenye picha hii pamoja na zao lingine. Picha moja ni kitalu kimoja. Kitunguu, beetroot na pilipili hupandwa kwenye vitalu tofauti, kwa hiyo mchanganyiko huu si wa kawaida.`;
    }
    if (named) return `Hii inaonekana kama ${named}.`;
    return "Hii inaonekana kama mmea wa shamba. Mambo matatu ya kukagua bado yanafaa.";
  },
  segmentFailed: (name) => `Alama za ${name} hazikupatikana, kwa hiyo huenda baadhi hazipo.`,
  levelLabel: (level) => (level === "low" ? "Chini" : level === "medium" ? "Wastani" : "Juu"),
};

function frameCount(labels: Record<ConceptId, string>, counts: ConceptCounts, empty: string, prefix: string): string {
  const parts = CONCEPT_IDS.filter((id) => counts[id] > 0).map((id) => `${labels[id]} ${counts[id]}`);
  if (parts.length === 0) return empty;
  return `${prefix} ${parts.join(", ")}.`;
}

export const copy: Record<Locale, Copy> = { en, sw };

export function normalizeLocale(value: unknown): Locale {
  return value === "sw" ? "sw" : "en";
}
