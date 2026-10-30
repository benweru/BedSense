import type { IssueId } from "@/lib/issues";
import type { Locale } from "@/lib/types";

/**
 * Field research behind a suspected problem. Muse answers from its own
 * knowledge first; when it names a suspect (or the reading settles on an
 * issue), this table looks up what matches that problem: active ingredients
 * and fertilizers by catalog name, plus cultural practices in both locales.
 * Every active and fertilizer here must resolve in `lib/agrovet-catalog.ts`
 * so the farmer always gets example shops, never a bare name. Practices use
 * a `{plant}` placeholder and never name a rate, a dose, or another crop.
 */

export type ResearchKind = "disease" | "pest" | "deficiency";

export type ResearchEntry = {
  id: string;
  kind: ResearchKind;
  /** English and Swahili names the suspect text is matched against. */
  aliases: readonly string[];
  /** Issues this entry answers when the suspect names nothing specific. */
  issues: readonly IssueId[];
  /** Active ingredient display names, exactly as in the catalog. */
  actives: readonly string[];
  /** Fertilizer display names, exactly as in the catalog. */
  fertilizers: readonly string[];
  practices: Record<Locale, readonly string[]>;
};

export const RESEARCH: readonly ResearchEntry[] = [
  {
    id: "early-blight",
    kind: "disease",
    aliases: ["early blight", "alternaria solani", "alternaria"],
    issues: ["spots"],
    actives: ["Mancozeb", "Copper oxychloride"],
    fertilizers: [],
    practices: {
      en: [
        "Pull the worst spotted lower leaves off {plant} and take them away from the bed.",
        "Water the soil under {plant} in the morning so the leaves dry before night.",
      ],
      sw: [
        "Ng'oa majani ya chini yenye madoa zaidi ya {plant} na uyatoe mbali na kitanda.",
        "Mwagilia udongo chini ya {plant} asubuhi ili majani yakauke kabla ya usiku.",
      ],
    },
  },
  {
    id: "late-blight",
    kind: "disease",
    aliases: ["late blight", "phytophthora"],
    issues: ["spots", "wilt"],
    actives: ["Metalaxyl-M + mancozeb", "Copper oxychloride"],
    fertilizers: [],
    practices: {
      en: [
        "Remove {plant} plants that collapse with dark water-soaked patches and take them off the bed.",
        "Keep water off {plant} leaves and open the row so air moves through.",
      ],
      sw: [
        "Ondoa mimea ya {plant} iliyooza yenye madoa meusi ya majimaji na uitoe nje ya kitanda.",
        "Usimwagilie majani ya {plant} na fungua mstari ili hewa ipite.",
      ],
    },
  },
  {
    id: "purple-blotch",
    kind: "disease",
    aliases: ["purple blotch", "alternaria porri"],
    issues: ["spots"],
    actives: ["Mancozeb", "Copper oxychloride"],
    fertilizers: [],
    practices: {
      en: [
        "Take the worst blotched leaves off {plant} so the rest of the row stays dry.",
        "Water {plant} at the soil and stay out of the bed while the leaves are wet.",
      ],
      sw: [
        "Ondoa majani yenye madoa zaidi ya {plant} ili mstari uliobaki ukae mkavu.",
        "Mwagilia {plant} kwenye udongo na usiingie kitandani majani yakiwa na unyevu.",
      ],
    },
  },
  {
    id: "cercospora",
    kind: "disease",
    aliases: ["cercospora", "cercospora leaf spot"],
    issues: ["spots"],
    actives: ["Copper oxychloride", "Mancozeb"],
    fertilizers: [],
    practices: {
      en: [
        "Pick the most spotted {plant} leaves and carry them away from the bed.",
        "Give {plant} space and morning water at the roots, not over the leaves.",
      ],
      sw: [
        "Chuma majani yenye madoa zaidi ya {plant} na uyapeleke mbali na kitanda.",
        "Pea {plant} nafasi na maji ya asubuhi kwenye mizizi, si juu ya majani.",
      ],
    },
  },
  {
    id: "leaf-spot",
    kind: "disease",
    aliases: ["leaf spots", "leaf spot", "madoa ya majani", "madoa", "doa la jani", "doa"],
    issues: ["spots"],
    actives: ["Mancozeb", "Copper oxychloride"],
    fertilizers: [],
    practices: {
      en: [
        "Strip the worst spotted leaves off {plant} and take them away from the bed.",
        "Water {plant} at the soil line and keep the leaves dry through the evening.",
      ],
      sw: [
        "Ondoa majani yenye madoa zaidi ya {plant} na uyapeleke mbali na kitanda.",
        "Mwagilia {plant} kwenye mstari wa udongo na weka majani makavu jioni.",
      ],
    },
  },
  {
    id: "powdery-mildew",
    kind: "disease",
    aliases: ["powdery mildew", "downy mildew", "mildew", "ukungu wa unga"],
    issues: ["spots"],
    actives: ["Copper oxychloride"],
    fertilizers: [],
    practices: {
      en: [
        "Open the {plant} row so sun and air reach the leaves.",
        "Water {plant} at the roots in the morning and remove the worst coated leaves.",
      ],
      sw: [
        "Fungua mstari wa {plant} ili jua na hewa vifike kwenye majani.",
        "Mwagilia {plant} kwenye mizizi asubuhi na ondoa majani yaliyofunikwa zaidi.",
      ],
    },
  },
  {
    id: "damping-off",
    kind: "disease",
    aliases: ["damping off", "damping-off", "root rot", "kuoza kwa mizizi", "kuoza mizizi"],
    issues: ["wilt"],
    actives: [],
    fertilizers: [],
    practices: {
      en: [
        "Let the soil around {plant} dry between waterings; soggy soil spreads root rot.",
        "Pull collapsed {plant} seedlings with their roots and take them off the bed.",
      ],
      sw: [
        "Ruhusu udongo kuzunguka {plant} ukauke kati ya kumwagilia; udongo wenye maji mengi hueneza kuoza kwa mizizi.",
        "Ng'oa miche ya {plant} iliyoanguka pamoja na mizizi na uitoe nje ya kitanda.",
      ],
    },
  },
  {
    id: "fusarium-wilt",
    kind: "disease",
    aliases: ["fusarium wilt", "fusarium", "bacterial wilt"],
    issues: ["wilt"],
    actives: [],
    fertilizers: [],
    practices: {
      en: [
        "Pull a wilted {plant} with a brown stem core, roots and all, and take it off the bed.",
        "Do not move water or tools from a wilted plant onto healthy plants.",
      ],
      sw: [
        "Ng'oa {plant} iliyonyauka yenye uti wa shina wa kahawia, pamoja na mizizi, na uitoe nje ya kitanda.",
        "Usihamishe maji au zana kutoka kwenye mimea iliyonyauka kwenda kwa yenye afya.",
      ],
    },
  },
  {
    id: "thrips",
    kind: "pest",
    aliases: ["thrips"],
    issues: ["insects", "curl", "deformity"],
    actives: ["Lambda-cyhalothrin", "Abamectin"],
    fertilizers: [],
    practices: {
      en: [
        "Tap {plant} flowers and new leaves over white paper to confirm thrips before you spray.",
        "Clear weeds around {plant}; thrips shelter in them between feedings.",
      ],
      sw: [
        "Gonga maua na majani mapya ya {plant} juu ya karatasi nyeupe ili uthibitishe thrips kabla ya kunyunyizia.",
        "Ondoa magugu kuzunguka {plant}; thrips hujificha humo kati ya kula.",
      ],
    },
  },
  {
    id: "spider-mites",
    kind: "pest",
    aliases: ["spider mites", "spider mite", "mites", "mite", "utitiri"],
    issues: ["insects", "curl", "deformity"],
    actives: ["Abamectin", "Lambda-cyhalothrin"],
    fertilizers: [],
    practices: {
      en: [
        "Check the underside of curled {plant} leaves with a lens for tiny moving mites.",
        "Wash dusty {plant} leaves with plain water; mites thrive in dry dust.",
      ],
      sw: [
        "Angalia upande wa chini wa majani yaliyokunjika ya {plant} kwa lenzi ili utafute utitiri wadogo wanaoenda.",
        "Osha majani yenye vumbi ya {plant} kwa maji matupu; utitiri hustawi kwenye vumbi kavu.",
      ],
    },
  },
  {
    id: "whitefly",
    kind: "pest",
    aliases: ["whiteflies", "whitefly", "white fly", "nzi weupe"],
    issues: ["insects", "curl"],
    actives: ["Lambda-cyhalothrin", "Abamectin"],
    fertilizers: [],
    practices: {
      en: [
        "Shake {plant} gently and watch for a white cloud rising off the leaves.",
        "Remove the worst sticky {plant} leaves so sooty mould does not follow the honeydew.",
      ],
      sw: [
        "Tikisa {plant} kwa upole na uangalie wingu jeupe linalopaa kutoka kwenye majani.",
        "Ondoa majani ya {plant} yenye kunata zaidi ili ukungu usifuate utomvu.",
      ],
    },
  },
  {
    id: "aphids",
    kind: "pest",
    aliases: ["aphids", "aphid", "vidukari", "kidukari"],
    issues: ["insects", "curl"],
    actives: ["Lambda-cyhalothrin", "Abamectin"],
    fertilizers: [],
    practices: {
      en: [
        "Look for clusters of soft insects on {plant} shoot tips and under young leaves.",
        "Knock light aphid colonies off sturdy {plant} with a firm jet of water.",
      ],
      sw: [
        "Tafuta makundi ya wadudu laini kwenye ncha za chipukizi za {plant} na chini ya majani machanga.",
        "Ondoa makoloni mepesi ya vidukari kwenye {plant} imara kwa maji yenye nguvu.",
      ],
    },
  },
  {
    id: "caterpillars",
    kind: "pest",
    aliases: ["caterpillars", "caterpillar", "armyworm", "army worm", "cutworm", "cut worm", "bollworm", "viwavi", "kiwavi"],
    issues: ["insects"],
    actives: ["Lambda-cyhalothrin"],
    fertilizers: [],
    practices: {
      en: [
        "Search {plant} at dusk for feeding caterpillars and hand-pick them off.",
        "Check under {plant} leaves for egg clusters and crush them before they hatch.",
      ],
      sw: [
        "Tafuta {plant} jioni kwa viwavi vinavyokula na uviondoe kwa mkono.",
        "Angalia chini ya majani ya {plant} kwa mayai yaliyokusanyika na uyaponde kabla hayajaanguliwa.",
      ],
    },
  },
  {
    id: "sucking-pests",
    kind: "pest",
    aliases: ["sucking pests", "sucking insects", "sucking pest", "pests", "wadudu", "dudu"],
    issues: ["insects", "curl", "deformity"],
    actives: ["Abamectin", "Lambda-cyhalothrin"],
    fertilizers: [],
    practices: {
      en: [
        "Name the insect on {plant} with a lens before you choose a product.",
        "Check new {plant} growth first; sucking pests gather on the youngest leaves.",
      ],
      sw: [
        "Taja mdudu wa {plant} kwa lenzi kabla ya kuchagua dawa.",
        "Anza na ukuaji mpya wa {plant}; wadudu wanaofyonza hukusanyika kwenye majani machanga zaidi.",
      ],
    },
  },
  {
    id: "nitrogen-deficiency",
    kind: "deficiency",
    aliases: ["nitrogen deficiency", "nitrogen deficient", "lack of nitrogen", "low nitrogen", "nitrogen", "nitrojeni", "upungufu wa nitrojeni"],
    issues: ["yellowing"],
    actives: [],
    fertilizers: ["Calcium ammonium nitrate (CAN)", "NPK 17-17-17"],
    practices: {
      en: [
        "Feed {plant} with a nitrogen top-dress once the soil is moist, not bone dry.",
        "Compare old and new {plant} leaves: even yellowing of the oldest leaves points to nitrogen.",
      ],
      sw: [
        "Lisha {plant} kwa mbolea ya juu yenye nitrojeni udongo ukiwa na unyevu, si mkavu kabisa.",
        "Linganisha majani ya zamani na mapya ya {plant}: njano sawa ya majani ya zamani zaidi huelekeza nitrojeni.",
      ],
    },
  },
  {
    id: "nutrient-deficiency",
    kind: "deficiency",
    aliases: ["nutrient deficiency", "nutrient deficient", "deficiency", "upungufu wa virutubishi", "virutubishi", "upungufu wa madini"],
    issues: ["yellowing"],
    actives: [],
    fertilizers: ["NPK 17-17-17"],
    practices: {
      en: [
        "Feed {plant} a balanced fertilizer and watch whether new growth comes green.",
        "Rule out dry soil first: water {plant} only if the root zone is dry.",
      ],
      sw: [
        "Lisha {plant} mbolea yenye mchanganyiko sawa na uangalie kama ukuaji mpya unakuja wa kijani.",
        "Ondoa shaka ya udongo mkavu kwanza: mwagilia {plant} tu ikiwa eneo la mizizi ni kavu.",
      ],
    },
  },
];

/** Generic answer per issue when the suspect names nothing this table knows. */
const ISSUE_FALLBACK: Record<IssueId, string> = {
  spots: "leaf-spot",
  insects: "sucking-pests",
  curl: "sucking-pests",
  deformity: "sucking-pests",
  yellowing: "nitrogen-deficiency",
  wilt: "damping-off",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normResearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasMatches(haystack: string, alias: string): boolean {
  const needle = normResearch(alias);
  if (!needle) return false;
  // A bare word must stand alone ("mite" is not "mites"); a phrase may sit inside a longer sentence.
  if (!needle.includes(" ")) return new RegExp(`\\b${escapeRegExp(needle)}\\b`).test(haystack);
  return haystack.includes(needle);
}

/** Longest matching entry wins, so "early blight" beats a bare "blight" and "spider mites" beats "mites". */
export function matchResearch(text: string): ResearchEntry | null {
  const haystack = normResearch(text);
  if (!haystack) return null;
  let best: { entry: ResearchEntry; length: number } | null = null;
  for (const entry of RESEARCH) {
    for (const alias of entry.aliases) {
      if (!aliasMatches(haystack, alias)) continue;
      const length = normResearch(alias).length;
      if (!best || length > best.length) best = { entry, length };
    }
  }
  return best?.entry ?? null;
}

function byId(id: string): ResearchEntry | null {
  return RESEARCH.find((entry) => entry.id === id) ?? null;
}

/** The entry for this reading: the named suspect first, the settled issue when the suspect names nothing known. */
export function researchFor(suspect: string, issue: IssueId | null): ResearchEntry | null {
  return matchResearch(suspect) ?? (issue ? byId(ISSUE_FALLBACK[issue]) : null);
}

/** Cultural practices for the reading, with the plant name filled in. Never a rate or a dose. */
export function researchPractices(entry: ResearchEntry | null, locale: Locale, plantLabel: string): string[] {
  if (!entry) return [];
  return entry.practices[locale].map((line) => line.split("{plant}").join(plantLabel));
}

/** Catalog-ready chemical names for the reading. The caller still gates these on a spray being usual. */
export function researchActives(entry: ResearchEntry | null): { activeIngredient: string }[] {
  if (!entry) return [];
  return entry.actives.map((activeIngredient) => ({ activeIngredient }));
}

/** Catalog-ready fertilizer names for the reading. Shown even when no spray is usual. */
export function researchFertilizers(entry: ResearchEntry | null): { activeIngredient: string }[] {
  if (!entry) return [];
  return entry.fertilizers.map((activeIngredient) => ({ activeIngredient }));
}
