import { adviseChemicals } from "@/lib/agrovet";
import { copy } from "@/lib/copy";
import { CONCEPTS, emptyConceptCounts } from "@/lib/concepts";
import { contextIsEmpty, emptyFarmerContext } from "@/lib/context";
import { contextText, inferIssue, issueActives, issueTriage, sprayIsUsual, type IssueId } from "@/lib/issues";
import { chooseCropFocus } from "@/lib/crop-focus";
import { areaFractionFromGrid, ellipseGrid } from "@/lib/grid";
import { displayPlantName, matchPlant, type KnownPlant } from "@/lib/plants";
import { researchFertilizers, researchFor } from "@/lib/research";
import { followUpFor, mitigationsWithChemicalStep } from "@/lib/server/muse";
import { finalizeTriage } from "@/lib/triage";
import type { AnalyzeResult, ConceptId, CropId, FarmerContext, Locale, MaskMark } from "@/lib/types";

export type DemoScenario = 0 | 1 | 2 | 3 | 4;

type Placed = {
  conceptId: ConceptId;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

export function demoScenario(bytes: Uint8Array): DemoScenario {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 3) as DemoScenario;
}

/** Prefer the plant the farmer named so the demo story matches that bed. */
export function scenarioForPlant(farmerPlant: string, bytes: Uint8Array): DemoScenario {
  return cropScenario(farmerPlant) ?? demoScenario(bytes);
}

function cropScenario(value: string): DemoScenario | null {
  const direct = scenarioForKnown(matchPlant(value));
  if (direct !== null) return direct;
  for (const token of value.toLowerCase().split(/[^a-z]+/)) {
    if (!token) continue;
    const found = scenarioForKnown(matchPlant(token));
    if (found !== null) return found;
  }
  return null;
}

function scenarioForKnown(plant: KnownPlant | null): DemoScenario | null {
  if (plant?.cropId === "onion") return 0;
  if (plant?.cropId === "beetroot") return 1;
  if (plant?.cropId === "chili") return 2;
  if (plant?.en === "Tomato") return 3;
  if (plant?.en === "Potato") return 4;
  return null;
}

export function buildMockResult(options: {
  scenario: DemoScenario;
  locale: Locale;
  width: number;
  height: number;
  mime: string;
  id: string;
  createdAt: string;
  context?: FarmerContext;
  farmerPlant?: string;
  plantName?: string;
}): AnalyzeResult {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const context = options.context ?? emptyFarmerContext();
  const farmerPlant = (options.farmerPlant ?? options.plantName ?? "").trim();
  const issue = inferIssue(contextText(context));
  if (issue) {
    return issueResult({ ...options, width, height, context, farmerPlant, issue });
  }
  const masks = layout(options.scenario, width, height);
  const counts = emptyConceptCounts();
  const areaByCrop: Record<CropId, number> = { onion: 0, beetroot: 0, chili: 0 };
  for (const mask of masks) {
    counts[mask.conceptId] += 1;
    if (mask.crop) areaByCrop[mask.crop] += mask.areaFraction;
  }
  const focus = chooseCropFocus(areaByCrop);
  const text = copy[options.locale];
  const story = stories(options.locale)[options.scenario];
  const problem = problems(options.locale)[options.scenario];
  const triage = finalizeTriage({
    locale: options.locale,
    observations: story.observations,
    actions: story.actions,
    likelyCauses: story.likelyCauses,
    mitigations: story.mitigations,
    confidence: story.confidence,
    confidenceScore: story.confidenceScore,
    counts,
    plantName: farmerPlant,
    context,
    issue: "none",
  });
  const chemicals =
    problem.chemicals.length > 0
      ? adviseChemicals({
          locale: options.locale,
          diseaseIndicated: true,
          suspect: problem.suspect,
          chemicals: problem.chemicals,
        })
      : null;

  return {
    id: options.id,
    createdAt: options.createdAt,
    locale: options.locale,
    mode: "mock",
    models: { sam: "sam-3.1", muse: "muse-spark-1.3-contributor", triageSource: "mock" },
    image: { width, height, mime: options.mime },
    cropFocus: focus.cropFocus,
    primaryCrop: focus.primaryCrop,
    detectedPlant:
      (farmerPlant ? displayPlantName(options.locale, farmerPlant) : "") ||
      (focus.primaryCrop
        ? text.concepts[focus.primaryCrop]
        : scenarioPlantName(options.locale, options.scenario) || text.unknownPlant),
    farmerPlant,
    contextAsk: followUpFor(options.locale, { issue: null, chemicals, needsInfo: false }),
    needsInfo: false,
    contextUsed: !contextIsEmpty(context),
    chemicals,
    counts,
    masks,
    observations: triage.observations,
    likelyCauses: triage.likelyCauses,
    mitigations: mitigationsWithChemicalStep(options.locale, triage.mitigations, chemicals),
    actions: triage.actions,
    confidence: triage.confidence,
    confidenceScore: triage.confidenceScore,
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    note: null,
    recheckDays: 3,
    recheckReason:
      options.locale === "sw"
        ? "Onyesho: madoa mapya yangeonekana ndani ya siku chache kama ugonjwa unaenea."
        : "Demo: new spots would show within days if the problem is still spreading.",
  };
}

function issueResult(options: {
  locale: Locale;
  width: number;
  height: number;
  mime: string;
  id: string;
  createdAt: string;
  context: FarmerContext;
  farmerPlant: string;
  issue: IssueId;
}): AnalyzeResult {
  const text = copy[options.locale];
  const counts = emptyConceptCounts();
  const plantLabel = displayPlantName(options.locale, options.farmerPlant) || text.unknownPlant;
  const story = issueTriage(options.locale, plantLabel, options.issue);
  const triage = finalizeTriage({
    locale: options.locale,
    observations: story.observations,
    actions: story.actions,
    likelyCauses: story.hypotheses,
    mitigations: story.mitigations,
    confidence: "medium",
    confidenceScore: 0.56,
    counts,
    plantName: options.farmerPlant,
    context: options.context,
    issue: options.issue,
  });
  const research = researchFor("", options.issue);
  const fertilizers = researchFertilizers(research);
  const chemicals = sprayIsUsual(options.issue, contextText(options.context), null)
    ? adviseChemicals({
        locale: options.locale,
        diseaseIndicated: true,
        suspect: story.hypotheses[0],
        chemicals: issueActives(options.issue),
      })
    : fertilizers.length > 0
      ? adviseChemicals({
          locale: options.locale,
          diseaseIndicated: true,
          suspect: story.hypotheses[0],
          chemicals: fertilizers,
        })
      : null;

  return {
    id: options.id,
    createdAt: options.createdAt,
    locale: options.locale,
    mode: "mock",
    models: { sam: "sam-3.1", muse: "muse-spark-1.3-contributor", triageSource: "mock" },
    image: { width: options.width, height: options.height, mime: options.mime },
    cropFocus: "unknown",
    primaryCrop: null,
    detectedPlant: plantLabel,
    farmerPlant: options.farmerPlant,
    contextAsk: followUpFor(options.locale, { issue: options.issue, chemicals, needsInfo: false }),
    needsInfo: false,
    contextUsed: !contextIsEmpty(options.context),
    chemicals,
    counts,
    masks: [],
    observations: triage.observations,
    likelyCauses: triage.likelyCauses,
    mitigations: mitigationsWithChemicalStep(options.locale, triage.mitigations, chemicals),
    actions: triage.actions,
    confidence: triage.confidence,
    confidenceScore: triage.confidenceScore,
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    note: null,
    recheckDays: 3,
    recheckReason:
      options.locale === "sw"
        ? "Onyesho: madoa mapya yangeonekana ndani ya siku chache kama ugonjwa unaenea."
        : "Demo: new spots would show within days if the problem is still spreading.",
  };
}

function layout(scenario: DemoScenario, width: number, height: number): MaskMark[] {
  const placed = placements(scenario, width, height);
  return placed.map((item, index) => {
    const concept = CONCEPTS.find((entry) => entry.id === item.conceptId);
    if (!concept) throw new Error("concept");
    const grid = ellipseGrid(Math.min(28, item.width), Math.min(28, item.height));
    const boxArea = item.width * item.height;
    return {
      id: `${item.conceptId}-mock-${index}`,
      conceptId: item.conceptId,
      phrase: concept.phrase,
      kind: concept.kind,
      crop: concept.crop,
      objectId: String(index),
      confidence: item.confidence,
      box: { x: item.x, y: item.y, width: item.width, height: item.height },
      grid,
      areaFraction: areaFractionFromGrid(grid, boxArea, width * height),
    };
  });
}

function placements(scenario: DemoScenario, width: number, height: number): Placed[] {
  // Each scene is one bed. Onion, beetroot, and chili are not placed together.
  const col = (fraction: number, size: number) => clamp(Math.round(width * fraction), 0, Math.max(0, width - size));
  const row = (fraction: number, size: number) => clamp(Math.round(height * fraction), 0, Math.max(0, height - size));
  const w = Math.max(1, Math.round(width * 0.16));
  const h = Math.max(1, Math.round(height * 0.2));
  const onion = (x: number, y: number, confidence: number): Placed => ({
    conceptId: "onion",
    x,
    y,
    width: w,
    height: h,
    confidence,
  });

  if (scenario === 1) {
    const beetW = Math.max(1, Math.round(width * 0.28));
    const beetH = Math.max(1, Math.round(height * 0.34));
    return [
      {
        conceptId: "beetroot",
        x: col(0.12, beetW),
        y: row(0.16, beetH),
        width: beetW,
        height: beetH,
        confidence: 0.84,
      },
      {
        conceptId: "beetroot",
        x: col(0.5, beetW),
        y: row(0.36, beetH),
        width: beetW,
        height: beetH,
        confidence: 0.76,
      },
      {
        conceptId: "yellow-leaf",
        x: col(0.48, Math.max(1, Math.round(w * 0.7))),
        y: row(0.28, Math.max(1, Math.round(h * 0.45))),
        width: Math.max(1, Math.round(w * 0.7)),
        height: Math.max(1, Math.round(h * 0.45)),
        confidence: 0.58,
      },
    ];
  }

  if (scenario === 2) {
    const chiliW = Math.max(1, Math.round(width * 0.22));
    const chiliH = Math.max(1, Math.round(height * 0.3));
    return [
      {
        conceptId: "chili",
        x: col(0.14, chiliW),
        y: row(0.16, chiliH),
        width: chiliW,
        height: chiliH,
        confidence: 0.8,
      },
      {
        conceptId: "chili",
        x: col(0.4, chiliW),
        y: row(0.18, chiliH),
        width: chiliW,
        height: chiliH,
        confidence: 0.77,
      },
      {
        conceptId: "chili",
        x: col(0.66, chiliW),
        y: row(0.4, chiliH),
        width: chiliW,
        height: chiliH,
        confidence: 0.7,
      },
      {
        conceptId: "weed",
        x: col(0.72, Math.max(1, Math.round(w * 0.8))),
        y: row(0.62, Math.max(1, Math.round(h * 0.4))),
        width: Math.max(1, Math.round(w * 0.8)),
        height: Math.max(1, Math.round(h * 0.4)),
        confidence: 0.64,
      },
    ];
  }

  if (scenario === 3) {
    return [
      {
        conceptId: "yellow-leaf",
        x: col(0.23, Math.max(1, Math.round(width * 0.32))),
        y: row(0.34, Math.max(1, Math.round(height * 0.44))),
        width: Math.max(1, Math.round(width * 0.32)),
        height: Math.max(1, Math.round(height * 0.44)),
        confidence: 0.86,
      },
      {
        conceptId: "plant",
        x: col(0.12, Math.max(1, Math.round(width * 0.28))),
        y: row(0.02, Math.max(1, Math.round(height * 0.3))),
        width: Math.max(1, Math.round(width * 0.28)),
        height: Math.max(1, Math.round(height * 0.3)),
        confidence: 0.78,
      },
      {
        conceptId: "plant",
        x: col(0.62, Math.max(1, Math.round(width * 0.2))),
        y: row(0.52, Math.max(1, Math.round(height * 0.32))),
        width: Math.max(1, Math.round(width * 0.2)),
        height: Math.max(1, Math.round(height * 0.32)),
        confidence: 0.74,
      },
    ];
  }

  if (scenario === 4) {
    return [
      {
        conceptId: "plant",
        x: col(0.08, Math.max(1, Math.round(width * 0.66))),
        y: row(0.32, Math.max(1, Math.round(height * 0.56))),
        width: Math.max(1, Math.round(width * 0.66)),
        height: Math.max(1, Math.round(height * 0.56)),
        confidence: 0.88,
      },
      {
        conceptId: "plant",
        x: col(0.22, Math.max(1, Math.round(width * 0.48))),
        y: row(0.02, Math.max(1, Math.round(height * 0.3))),
        width: Math.max(1, Math.round(width * 0.48)),
        height: Math.max(1, Math.round(height * 0.3)),
        confidence: 0.81,
      },
      {
        conceptId: "plant",
        x: col(0.68, Math.max(1, Math.round(width * 0.3))),
        y: row(0.18, Math.max(1, Math.round(height * 0.68))),
        width: Math.max(1, Math.round(width * 0.3)),
        height: Math.max(1, Math.round(height * 0.68)),
        confidence: 0.77,
      },
    ];
  }

  return [
    onion(col(0.12, w), row(0.16, h), 0.86),
    onion(col(0.38, w), row(0.18, h), 0.83),
    onion(col(0.64, w), row(0.2, h), 0.74),
    {
      conceptId: "yellow-leaf",
      x: col(0.42, Math.max(1, Math.round(w * 0.55))),
      y: row(0.22, Math.max(1, Math.round(h * 0.4))),
      width: Math.max(1, Math.round(w * 0.55)),
      height: Math.max(1, Math.round(h * 0.4)),
      confidence: 0.66,
    },
  ];
}

function scenarioPlantName(locale: Locale, scenario: DemoScenario): string | null {
  if (scenario === 3) return locale === "sw" ? "Nyanya" : "Tomato";
  if (scenario === 4) return locale === "sw" ? "Viazi" : "Potato";
  return null;
}

type MockStory = {
  observations: string[];
  actions: [string, string, string];
  likelyCauses?: string[];
  mitigations?: string[];
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
};

function stories(locale: Locale): Record<DemoScenario, MockStory> {
  if (locale === "sw") {
    return {
      0: {
        observations: [
          "Majani ya nje ya kitunguu yanaonekana manjano, na madoa yanayofanana na purple blotch.",
          "Udongo ukingoni unaonekana mkavu zaidi kuliko katikati ya kitanda.",
        ],
        actions: [
          "Gusa udongo sentimita chache chini kabla ya kumwagilia.",
          "Ondoa majani ya nje yaliyomanjano zaidi na uyatoe nje ya kitanda.",
          "Piga picha ya mimea hiyo hiyo baada ya siku mbili na umwonyeshe mtaalamu ikiwa njano inaingia ndani.",
        ],
        confidence: "medium",
        confidenceScore: 0.61,
      },
      1: {
        observations: [
          "Majani kadhaa ya beetroot yana madoa duara yenye katikati iliyopauka, kama Cercospora.",
          "Mimea bado imesimama, lakini majani yenye madoa yanaonekana dhaifu kuliko majani mapya.",
        ],
        actions: [
          "Linganisha jani lenye madoa na jani jipya kwenye mmea huohuo.",
          "Epuka kumwagilia majani jioni; mwagilia udongo ikiwa umekauka.",
          "Chukua picha hii kwa afisa ugani kabla ya kutumia dawa yoyote.",
        ],
        confidence: "low",
        confidenceScore: 0.42,
      },
      2: {
        observations: [
          "Fremu hii ni kitanda cha pilipili, na magugu yanagusia mstari.",
          "Majani mengine yanaonekana yenye madoa madogo, jambo linaloweza kuwa thrips.",
        ],
        actions: [
          "Ng'oa magugu yanayogusana na pilipili na uyatoe nje ya kitanda.",
          "Fungua nafasi kati ya mimea ikiwa majani yamegandana.",
          "Kagua unyevu wa udongo asubuhi na uonyeshe picha hii kwa mtaalamu wa kilimo.",
        ],
        confidence: "medium",
        confidenceScore: 0.57,
      },
      3: {
        observations: [
          "Jani la nyanya lina njano na madoa meusi ya mviringo yenye kingo zilizokauka, dalili ya early blight au Septoria.",
          "Matunda mabichi bado yanakua vizuri, kwa hivyo kudhibiti majani ya chini mapema kutalinda mazao.",
        ],
        likelyCauses: [
          "Early blight (Alternaria) au madoa ya Septoria yanayosambazwa na matone ya maji kwenye majani ya chini.",
          "Unyevu mwingi usiku na majani yanayogusana karibu na udongo.",
        ],
        mitigations: [
          "Ng'oa majani ya chini yenye madoa na uyatoe mbali na kitanda cha nyanya.",
          "Mwagilia udongo asubuhi pekee na epuka kulowesha majani jioni.",
          "Weka matandazo chini ya mimea ili kuzuia udongo kurukia majani wakati wa mvua au umwagiliaji.",
        ],
        actions: [
          "Kagua chini ya majani ya chini kwenye mimea ya jirani kuona kama madoa mapya yanaenea.",
          "Ondoa majani yaliyoharibika sana na osha mikono au vifaa kabla ya kugusa mimea mingine.",
          "Piga picha tena baada ya siku tatu ili kuona kama madoa yanaacha kupanda juu.",
        ],
        confidence: "medium",
        confidenceScore: 0.72,
      },
      4: {
        observations: [
          "Viazi vilivyovunwa vina madoa meusi ya duara yaliyobonyea kwenye ganda, yanayofanana na common scab au madoa ya late blight.",
          "Viazi kadhaa kwenye fungu hili vina alama hizi, na vikihifadhiwa kwenye unyevu vinaweza kuoza haraka.",
        ],
        likelyCauses: [
          "Common scab au magonjwa ya ganda yanayopatikana udongoni wakati viazi vinapoanza kutengenezwa.",
          "Maambukizi ya late blight kwenye viazi au unyevu mwingi udongoni kabla ya kuvuna.",
        ],
        mitigations: [
          "Tenganisha viazi vyenye madoa na vilivyo safi kabla ya kuvihifadhi mahali pakavu na penye hewa.",
          "Usitumie viazi vyenye madoa kama mbegu za msimu ujao; tumia mbegu zilizothibitishwa na zungusha mazao.",
          "Usipulizie dawa ya ukungu kwenye viazi vilivyovunwa tayari kwa chakula.",
        ],
        actions: [
          "Kata kiazi kimoja chenye madoa: ganda gumu la juu linaashiria scab, ilhali nyama ya kahawia chini ya ganda inaashiria late blight.",
          "Kausha viazi safi kivulini kwenye hewa kabla ya kuviweka ghalani.",
          "Onyesha picha ya kiazi kilichokatwa kwa afisa ugani kabla ya kuchagua mbegu za msimu ujao.",
        ],
        confidence: "medium",
        confidenceScore: 0.68,
      },
    };
  }
  return {
    0: {
      observations: [
        "Outer onion leaves look more yellow than the centres of the row, with spots that can be purple blotch.",
        "The soil at the edge of the bed looks drier than the middle.",
      ],
      actions: [
        "Feel the soil a few centimetres down before you water.",
        "Lift the yellowest outer leaves off the bed so they do not rest on healthy plants.",
        "Photograph these same plants again in two days and show an agronomist if the yellowing moves inward.",
      ],
      confidence: "medium",
      confidenceScore: 0.61,
    },
    1: {
      observations: [
        "Several beetroot leaves show round spots with pale centres, like Cercospora.",
        "The plants are still standing, but the spotted leaves look weaker than the newer ones.",
      ],
      actions: [
        "Compare a spotted leaf with a newer leaf on the same plant.",
        "Water the soil only if it is dry, and keep evening water off the leaves.",
        "Take this photo to an extension officer before using any spray.",
      ],
      confidence: "low",
      confidenceScore: 0.42,
    },
    2: {
      observations: [
        "This frame is a chili bed, and weeds are touching the row.",
        "Some leaves look stippled, which can be thrips rather than thirst alone.",
      ],
      actions: [
        "Pull weeds that touch the chili and take them off the bed.",
        "Open a little space if the leaves are packed together.",
        "Check soil moisture in the morning and show this photo to an agronomist.",
      ],
      confidence: "medium",
      confidenceScore: 0.57,
    },
    3: {
      observations: [
        "This tomato leaflet is yellowing with dark sunken spots and dried edges, a classic pattern of early blight or Septoria leaf spot.",
        "Green fruit are still developing nearby, so removing affected lower leaves early helps protect the rest of the canopy.",
      ],
      likelyCauses: [
        "Early blight (Alternaria) or Septoria leaf spot splashed from soil onto lower tomato leaves.",
        "Long overnight leaf wetness or crowded lower foliage holding moisture.",
      ],
      mitigations: [
        "Remove the worst spotted lower leaves and carry them away from the tomato bed.",
        "Water at the soil line in the morning so foliage dries before nightfall.",
        "Mulch beneath the plants to reduce soil splash onto clean leaves.",
      ],
      actions: [
        "Inspect the lower leaves of neighbouring tomato plants for fresh dark spots spreading upward.",
        "Trim off heavily spotted leaves and wash your hands or shears before touching healthy rows.",
        "Photograph the same canopy in three days to check whether new spots are still appearing.",
      ],
      confidence: "medium",
      confidenceScore: 0.72,
    },
    4: {
      observations: [
        "Harvested potato tubers show dark, circular sunken spots across the skin, consistent with common scab or blight tuber lesions.",
        "Several tubers in this lot are marked, which raises the risk of storage rot if they stay damp.",
      ],
      likelyCauses: [
        "Common scab or skin-spot lesions picked up in soil during tuber set.",
        "Late blight tuber infection or wet soil conditions before harvest.",
      ],
      mitigations: [
        "Sort spotted tubers out from clean ones and cure the clean lot in a cool, dry, shaded spot.",
        "Do not save spotted tubers as seed for next season; rotate to a fresh bed with certified seed.",
        "Do not spray fungicides onto harvested potatoes meant for eating.",
      ],
      actions: [
        "Slice one spotted tuber open: shallow corky pits point to scab, while reddish-brown flesh beneath the skin points to late blight.",
        "Air-dry clean tubers in the shade before bagging or stacking in storage.",
        "Show a photo of the sliced tuber to an extension officer before choosing next season's seed and bed.",
      ],
      confidence: "medium",
      confidenceScore: 0.68,
    },
  };
}

function problems(locale: Locale): Record<DemoScenario, { suspect: string; chemicals: { activeIngredient: string }[] }> {
  if (locale === "sw") {
    return {
      0: {
        suspect: "Purple blotch kwenye kitunguu",
        chemicals: [{ activeIngredient: "mancozeb" }, { activeIngredient: "metalaxyl-M + mancozeb" }],
      },
      1: {
        suspect: "Madoa ya Cercospora kwenye beetroot",
        chemicals: [{ activeIngredient: "copper oxychloride" }, { activeIngredient: "mancozeb" }],
      },
      2: {
        suspect: "Thrips kwenye pilipili",
        chemicals: [{ activeIngredient: "lambda-cyhalothrin" }, { activeIngredient: "abamectin" }],
      },
      3: {
        suspect: "Early blight kwenye nyanya",
        chemicals: [{ activeIngredient: "mancozeb" }, { activeIngredient: "copper oxychloride" }],
      },
      4: {
        suspect: "Common scab au madoa ya late blight kwenye viazi",
        chemicals: [],
      },
    };
  }
  return {
    0: {
      suspect: "Purple blotch on onion",
      chemicals: [{ activeIngredient: "mancozeb" }, { activeIngredient: "metalaxyl-M + mancozeb" }],
    },
    1: {
      suspect: "Cercospora leaf spot on beetroot",
      chemicals: [{ activeIngredient: "copper oxychloride" }, { activeIngredient: "mancozeb" }],
    },
    2: {
      suspect: "Thrips on chili",
      chemicals: [{ activeIngredient: "lambda-cyhalothrin" }, { activeIngredient: "abamectin" }],
    },
    3: {
      suspect: "Early blight on tomato",
      chemicals: [{ activeIngredient: "mancozeb" }, { activeIngredient: "copper oxychloride" }],
    },
    4: {
      suspect: "Common scab or blight lesions on potato",
      chemicals: [],
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
