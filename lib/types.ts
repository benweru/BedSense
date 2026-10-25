export const LOCALES = ["en", "sw"] as const;
export type Locale = (typeof LOCALES)[number];

export const CROPS = ["onion", "beetroot", "chili"] as const;
export type CropId = (typeof CROPS)[number];

export const CONCEPT_IDS = ["onion", "beetroot", "chili", "yellow-leaf", "weed"] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];

export type ConceptKind = "crop" | "symptom" | "other";

export type ConfidenceLevel = "low" | "medium" | "high";

export type CropFocus = CropId | "mixed" | "unknown";

export type MaskGrid = {
  width: number;
  height: number;
  rows: string[];
};

export type MaskBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MaskMark = {
  id: string;
  conceptId: ConceptId;
  phrase: string;
  kind: ConceptKind;
  crop: CropId | null;
  objectId: string;
  confidence: number | null;
  box: MaskBox;
  grid: MaskGrid;
  areaFraction: number;
};

export type ConceptCounts = Record<ConceptId, number>;

export type AnalyzeResult = {
  id: string;
  createdAt: string;
  locale: Locale;
  mode: "mock" | "live";
  models: {
    sam: "sam-3.1";
    muse: "muse-spark-1.3-contributor" | "muse-spark-1.3" | null;
    triageSource: "muse" | "mock" | "local-fallback";
  };
  image: {
    width: number;
    height: number;
    mime: string;
  };
  cropFocus: CropFocus;
  primaryCrop: CropId | null;
  counts: ConceptCounts;
  masks: MaskMark[];
  observations: string[];
  actions: [string, string, string];
  confidence: ConfidenceLevel;
  confidenceScore: number;
  disclaimer: string;
  agronomistCallout: string;
  note: string | null;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  thumbnail: string;
  result: AnalyzeResult;
};

export class AnalyzeError extends Error {
  readonly code: "bad_request" | "unsupported_image" | "image_too_large" | "missing_key" | "upstream";

  constructor(code: AnalyzeError["code"]) {
    super(code);
    this.name = "AnalyzeError";
    this.code = code;
  }
}
