import { copy } from "@/lib/copy";
import { CONCEPTS } from "@/lib/concepts";
import { chooseCropFocus } from "@/lib/crop-focus";
import { areaFractionFromGrid, ellipseGrid } from "@/lib/grid";
import { finalizeTriage } from "@/lib/triage";
import type { AnalyzeResult, ConceptCounts, ConceptId, CropId, Locale, MaskMark } from "@/lib/types";

export type DemoScenario = 0 | 1 | 2;

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

export function buildMockResult(options: {
  scenario: DemoScenario;
  locale: Locale;
  width: number;
  height: number;
  mime: string;
  id: string;
  createdAt: string;
}): AnalyzeResult {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const masks = layout(options.scenario, width, height);
  const counts = emptyCounts();
  const areaByCrop: Record<CropId, number> = { onion: 0, beetroot: 0, chili: 0 };
  for (const mask of masks) {
    counts[mask.conceptId] += 1;
    if (mask.crop) areaByCrop[mask.crop] += mask.areaFraction;
  }
  const focus = chooseCropFocus(areaByCrop);
  const text = copy[options.locale];
  const story = stories(options.locale)[options.scenario];
  const triage = finalizeTriage({
    locale: options.locale,
    observations: story.observations,
    actions: story.actions,
    confidence: story.confidence,
    confidenceScore: story.confidenceScore,
    counts,
    failedConcepts: [],
  });

  return {
    id: options.id,
    createdAt: options.createdAt,
    locale: options.locale,
    mode: "mock",
    models: { sam: "sam-3.1", muse: "muse-spark-1.3-contributor", triageSource: "mock" },
    image: { width, height, mime: options.mime },
    cropFocus: focus.cropFocus,
    primaryCrop: focus.primaryCrop,
    counts,
    masks,
    observations: triage.observations,
    actions: triage.actions,
    confidence: triage.confidence,
    confidenceScore: triage.confidenceScore,
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    note: null,
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
      onion(col(0.08, w), row(0.18, h), 0.62),
      {
        conceptId: "beetroot",
        x: col(0.38, beetW),
        y: row(0.22, beetH),
        width: beetW,
        height: beetH,
        confidence: 0.81,
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
      onion(col(0.08, w), row(0.2, h), 0.55),
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

function stories(locale: Locale): Record<
  DemoScenario,
  { observations: string[]; actions: [string, string, string]; confidence: "low" | "medium" | "high"; confidenceScore: number }
> {
  if (locale === "sw") {
    return {
      0: {
        observations: [
          "Majani ya nje ya kitunguu yanaonekana manjano kuliko katikati ya mstari.",
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
          "Beetroot ina alama nyingi zaidi, na kitunguu bado kipo kwenye fremu.",
          "Madoa kwenye jani yanastahili kutazamwa, si kutibiwa kwa dawa leo.",
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
          "Pilipili inaonekana zaidi kuliko kitunguu, na magugu yanagusia mstari.",
          "Angalia kama pilipili inanyauka kwa ukosefu wa maji au kwa msongamano.",
        ],
        actions: [
          "Ng'oa magugu yanayogusana na pilipili na uyatoe nje ya kitanda.",
          "Fungua nafasi kati ya mimea ikiwa majani yamegandana.",
          "Kagua unyevu wa udongo asubuhi na uonyeshe picha hii kwa mtaalamu wa kilimo.",
        ],
        confidence: "medium",
        confidenceScore: 0.57,
      },
    };
  }
  return {
    0: {
      observations: [
        "Outer onion leaves look more yellow than the centres of the row.",
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
        "Beetroot covers more of the frame than onion, and onion is still in view.",
        "Leaf spots are worth a closer look, not a spray today.",
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
        "Chili marks outweigh the onion, and weeds are touching the row.",
        "Check whether the chili looks crowded or simply thirsty.",
      ],
      actions: [
        "Pull weeds that touch the chili and take them off the bed.",
        "Open a little space if the leaves are packed together.",
        "Check soil moisture in the morning and show this photo to an agronomist.",
      ],
      confidence: "medium",
      confidenceScore: 0.57,
    },
  };
}

function emptyCounts(): ConceptCounts {
  return { onion: 0, beetroot: 0, chili: 0, "yellow-leaf": 0, weed: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
