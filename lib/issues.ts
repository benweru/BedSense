import type { FarmerContext, Locale } from "@/lib/types";
import { CONTEXT_FIELDS } from "@/lib/types";

export const ISSUE_IDS = ["curl", "deformity", "spots", "wilt", "yellowing", "insects"] as const;
export type IssueId = (typeof ISSUE_IDS)[number];

const RULES: readonly { id: IssueId; pattern: RegExp }[] = [
  {
    id: "deformity",
    pattern: /\b(deform\w*|misshapen|twisted|twisting|distort\w*|spiral\w*|kipind\w*|potofu|yaliyopinda)\b/i,
  },
  {
    id: "curl",
    pattern: /\b(curls?|curling|curled|leaf\s*curl|kukunj\w*|kunjwa|kunja|yaliyokunj\w*)\b/i,
  },
  {
    id: "spots",
    pattern: /\b(spots?|spotted|lesions?|blight|madoa|doa)\b/i,
  },
  {
    id: "wilt",
    pattern: /\b(wilts?|wilting|wilted|droop\w*|nyauka|kunyauka|unanyauka)\b/i,
  },
  {
    id: "yellowing",
    pattern: /\b(yellow\w*|chloros\w*|njano|manjano)\b/i,
  },
  {
    id: "insects",
    pattern: /\b(insects?|pests?|mites?|aphids?|whitefl\w*|thrips?|dudu|wadudu|utitiri|nzi weupe)\b/i,
  },
];

export function contextText(context: FarmerContext): string {
  return CONTEXT_FIELDS.map((field) => context[field]).filter(Boolean).join("\n");
}

export function parseIssue(value: unknown): IssueId | null {
  return typeof value === "string" && (ISSUE_IDS as readonly string[]).includes(value) ? (value as IssueId) : null;
}

/** Symptom class from the farmer's notes. The same rules apply to every plant. */
export function inferIssue(text: string): IssueId | null {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.id;
  }
  return null;
}

export function issueUsesChemicals(issue: IssueId): boolean {
  return issue === "curl" || issue === "deformity" || issue === "spots" || issue === "insects";
}

/** Catalog actives for a symptom. The same list is used for every plant. */
export function issueActives(issue: IssueId): { activeIngredient: string }[] {
  if (issue === "spots") return [{ activeIngredient: "mancozeb" }, { activeIngredient: "copper oxychloride" }];
  if (issue === "curl" || issue === "deformity" || issue === "insects") {
    return [{ activeIngredient: "abamectin" }, { activeIngredient: "lambda-cyhalothrin" }];
  }
  return [];
}

export type IssueStory = {
  observations: [string, string];
  hypotheses: [string, string];
  actions: [string, string, string];
  chemicalsHelp: boolean;
};

export function issueTriage(locale: Locale, plant: string, issue: IssueId): IssueStory {
  const lines = locale === "sw" ? sw[issue] : en[issue];
  return {
    observations: lines.observations(plant),
    hypotheses: lines.hypotheses(plant),
    actions: lines.actions(plant),
    chemicalsHelp: issueUsesChemicals(issue),
  };
}

type Lines = {
  observations: (plant: string) => [string, string];
  hypotheses: (plant: string) => [string, string];
  actions: (plant: string) => [string, string, string];
};

const en: Record<IssueId, Lines> = {
  curl: {
    observations: (plant) => [
      `${plant} is the plant in this check. A close-up with few marks is still read.`,
      `Curling on ${plant} is the sign this check follows.`,
    ],
    hypotheses: (plant) => [
      `Curling on ${plant} is often sucking pests (mites, thrips, or whitefly), a virus they spread, or a sharp change in water.`,
      `Twisted new growth or curled fruit can come from those same pests, especially mites, even when the photo shows no leaf spots.`,
    ],
    actions: (plant) => [
      `Check the newest ${plant} growth and the underside of a leaf for mites, thrips, or whitefly, even on a close-up.`,
      `Compare a curled leaf or fruit with a newer and an older one on the same ${plant}.`,
      `If several ${plant} plants show the same curl, take this photo to an agrovet before you buy a spray.`,
    ],
  },
  deformity: {
    observations: (plant) => [
      `${plant} is the plant in this check. A close-up of fruit or leaves is still read.`,
      `Misshapen growth on ${plant} is the sign this check follows.`,
    ],
    hypotheses: (plant) => [
      `Misshapen ${plant} fruit or leaves are often mites or thrips, poor pollination, or a virus.`,
      `A spiral or twisted fruit with healthy-looking skin still fits a mite or thrips check.`,
    ],
    actions: (plant) => [
      `Look at the newest ${plant} growth and under a nearby leaf for mites or thrips.`,
      `See whether the deformity is on one fruit or on most of the ${plant}.`,
      `Show this photo to an agrovet before you spray, and ask them to match a product to the pest if one is present.`,
    ],
  },
  spots: {
    observations: (plant) => [
      `${plant} is the plant in this check.`,
      `Spots or lesions on ${plant} are the sign this check follows.`,
    ],
    hypotheses: (plant) => [
      `Spots on ${plant} are often a fungus or a bacterium, especially after wet leaves or crowded plants.`,
      `A nutrient mark can look similar. Compare the pattern on old leaves and new leaves before you treat.`,
    ],
    actions: (plant) => [
      `Compare a spotted ${plant} leaf with a clean leaf on the same plant.`,
      `Note whether the spots started after rain, overhead watering, or crowded growth.`,
      `Take this photo to an agrovet or extension officer before you spray the bed.`,
    ],
  },
  wilt: {
    observations: (plant) => [
      `${plant} is the plant in this check.`,
      `Wilting on ${plant} is the sign this check follows.`,
    ],
    hypotheses: (plant) => [
      `Wilting on ${plant} is often dry soil, damaged roots, or a stem infection. Some wilts are not helped by a spray.`,
      `A brown ring or ooze in a cut stem means stop moving water from that plant onto healthy ones.`,
    ],
    actions: (plant) => [
      `Feel the soil a few centimetres down beside the wilted ${plant}. Water only if it is dry.`,
      `Split one wilted stem and look for a brown ring or ooze before you buy a chemical.`,
      `Keep water from a wilted ${plant} off healthy plants, and show this photo to an extension officer.`,
    ],
  },
  yellowing: {
    observations: (plant) => [
      `${plant} is the plant in this check.`,
      `Yellowing on ${plant} is the sign this check follows.`,
    ],
    hypotheses: (plant) => [
      `Yellowing on ${plant} is often water, nitrogen, or older leaves finishing, and sometimes a pest or a root problem.`,
      `Yellow lower leaves with green new growth is a different problem from yellow new growth.`,
    ],
    actions: (plant) => [
      `See whether the yellowing on ${plant} is on old leaves, new leaves, or the whole plant.`,
      `Feel the soil a few centimetres down and water only if it is dry.`,
      `If the yellowing spreads into new growth, photograph again in two days and show both photos to an agronomist.`,
    ],
  },
  insects: {
    observations: (plant) => [
      `${plant} is the plant in this check.`,
      `Insects on ${plant} are the sign this check follows.`,
    ],
    hypotheses: (plant) => [
      `Insects on ${plant} should be named before a product is chosen. Mites, caterpillars, aphids, and whitefly need different products.`,
      `Look for the insect, the shed skins, or the damage, not only the symptom.`,
    ],
    actions: (plant) => [
      `Look under ${plant} leaves and along the stems for the insect or its skins.`,
      `Note whether the damage is chewing, stippling, or sticky honeydew.`,
      `Take a close photo of the pest to an agrovet so the product matches the insect.`,
    ],
  },
};

const sw: Record<IssueId, Lines> = {
  curl: {
    observations: (plant) => [
      `${plant} ndio mmea wa ukaguzi huu. Picha ya karibu yenye alama chache bado inasomwa.`,
      `Kukunja kwa ${plant} ndio dalili inayofuatwa.`,
    ],
    hypotheses: (plant) => [
      `Kukunja kwa ${plant} mara nyingi husababishwa na wadudu wanaofyonza (utitiri, thrips, au nzi weupe), virusi wanavyosambaza, au mabadiliko ya ghafla ya maji.`,
      `Ukuaji mpya uliopinda au tunda lililokunjika linaweza kutoka kwa wadudu hao hao, hasa utitiri, hata kama picha haina madoa.`,
    ],
    actions: (plant) => [
      `Angalia ukuaji mpya wa ${plant} na sehemu ya chini ya jani kwa utitiri, thrips, au nzi weupe, hata kwenye picha ya karibu.`,
      `Linganisha jani au tunda lililokunjika na jipya na la zamani kwenye ${plant} hiyohiyo.`,
      `Ikiwa mimea kadhaa ya ${plant} imekunjika vivyo hivyo, peleka picha hii kwa agrovet kabla ya kununua dawa.`,
    ],
  },
  deformity: {
    observations: (plant) => [
      `${plant} ndio mmea wa ukaguzi huu. Picha ya karibu ya tunda au jani bado inasomwa.`,
      `Ukuaji uliopinda wa ${plant} ndio dalili inayofuatwa.`,
    ],
    hypotheses: (plant) => [
      `Tunda au jani potofu la ${plant} mara nyingi hutokana na utitiri au thrips, uchavushaji dhaifu, au virusi.`,
      `Tunda lililojizungusha lenye ngozi inayoonekana nzuri bado linastahili ukaguzi wa utitiri au thrips.`,
    ],
    actions: (plant) => [
      `Angalia ukuaji mpya wa ${plant} na chini ya jani la karibu kwa utitiri au thrips.`,
      `Tazama kama upotofu uko kwenye tunda moja au kwa ${plant} nyingi.`,
      `Mwonyeshe agrovet picha hii kabla ya kunyunyizia, ili dawa ilingane na mdudu ikiwa yupo.`,
    ],
  },
  spots: {
    observations: (plant) => [
      `${plant} ndio mmea wa ukaguzi huu.`,
      `Madoa kwenye ${plant} ndio dalili inayofuatwa.`,
    ],
    hypotheses: (plant) => [
      `Madoa kwenye ${plant} mara nyingi ni kuvu au bakteria, hasa baada ya majani mvua au msongamano.`,
      `Upungufu wa virutubishi unaweza kufanana. Linganisha jani la zamani na jipya kabla ya kutibu.`,
    ],
    actions: (plant) => [
      `Linganisha jani lenye madoa la ${plant} na jani safi kwenye mmea huohuo.`,
      `Tambua kama madoa yalianza baada ya mvua, kumwagilia majani, au msongamano.`,
      `Peleka picha hii kwa agrovet au afisa ugani kabla ya kunyunyizia kitanda.`,
    ],
  },
  wilt: {
    observations: (plant) => [
      `${plant} ndio mmea wa ukaguzi huu.`,
      `Kunyauka kwa ${plant} ndio dalili inayofuatwa.`,
    ],
    hypotheses: (plant) => [
      `Kunyauka kwa ${plant} mara nyingi ni udongo mkavu, mizizi iliyoharibika, au maambukizi ya shina. Baadhi ya nyauka haiponi kwa dawa.`,
      `Pete ya kahawia au ute kwenye shina lililokatwa ni sababu ya kusimamisha maji kutoka mmea huo kwenda kwa wenye afya.`,
    ],
    actions: (plant) => [
      `Gusa udongo sentimita chache kando ya ${plant} iliyonyauka. Mwagilia tu ikiwa umekauka.`,
      `Pasua shina moja lililonyauka na utafute pete ya kahawia au ute kabla ya kununua dawa.`,
      `Usiruhusu maji kutoka kwa ${plant} iliyonyauka yaguse mimea yenye afya, na uonyeshe picha hii kwa afisa ugani.`,
    ],
  },
  yellowing: {
    observations: (plant) => [
      `${plant} ndio mmea wa ukaguzi huu.`,
      `Njano kwenye ${plant} ndio dalili inayofuatwa.`,
    ],
    hypotheses: (plant) => [
      `Njano kwenye ${plant} mara nyingi ni maji, nitrojeni, au majani ya zamani yanaisha, na wakati mwingine mdudu au tatizo la mizizi.`,
      `Majani ya chini ya manjano yenye ukuaji mpya wa kijani ni tatizo tofauti na njano ya ukuaji mpya.`,
    ],
    actions: (plant) => [
      `Tazama kama njano ya ${plant} iko kwenye majani ya zamani, mapya, au mmea wote.`,
      `Gusa udongo sentimita chache chini na umwagilie tu ikiwa umekauka.`,
      `Ikiwa njano inaingia kwenye ukuaji mpya, piga picha tena baada ya siku mbili na uonyeshe zote kwa mtaalamu.`,
    ],
  },
  insects: {
    observations: (plant) => [
      `${plant} ndio mmea wa ukaguzi huu.`,
      `Wadudu kwenye ${plant} ndio dalili inayofuatwa.`,
    ],
    hypotheses: (plant) => [
      `Wadudu kwenye ${plant} wanatakiwa kutajwa kabla ya kuchagua dawa. Utitiri, viwavi, vidukari, na nzi weupe huhitaji dawa tofauti.`,
      `Tafuta mdudu, ngozi alizoacha, au uharibifu, si dalili peke yake.`,
    ],
    actions: (plant) => [
      `Angalia chini ya majani ya ${plant} na kwenye shina kwa mdudu au ngozi zake.`,
      `Tambua kama uharibifu ni kutafuna, madoa madogo, au utomvu wenye kunata.`,
      `Peleka picha ya karibu ya mdudu kwa agrovet ili dawa ilingane na mdudu huyo.`,
    ],
  },
};
