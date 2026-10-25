export const LOCALES = ["en", "sw"] as const;
export type Locale = (typeof LOCALES)[number];

export const CROPS = ["onion", "beetroot", "chili"] as const;
export type CropId = (typeof CROPS)[number];

export const CONCEPT_IDS = ["onion", "beetroot", "chili", "plant", "yellow-leaf", "weed"] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];

export type ConceptKind = "crop" | "symptom" | "other";

export type ConfidenceLevel = "low" | "medium" | "high";

export const QUALITY_BANDS = ["economy", "mid", "premium"] as const;
export type QualityBand = (typeof QUALITY_BANDS)[number];

export type ShopOffer = {
  quality: QualityBand;
  brand: string;
  pack: string;
  shopName: string;
  shopKind: string;
  place: string;
  priceMinKes: number;
  priceMaxKes: number;
};

export type ChemicalProduct = {
  activeIngredient: string;
  productClass: string;
  useNote: string;
  offers: ShopOffer[];
};

/** Present when a disease or pest is suspected. Shop rows come from the Kenya catalog. */
export type ChemicalAdvice = {
  suspect: string;
  products: ChemicalProduct[];
  verifyNote: string;
  priceNote: string;
  lookup: "catalog" | "live";
};

/** One of the familiar crops, an unusual multi-crop frame (`mixed`), or none of those marks (`unknown`). Other plants are still named from the photo. */
export type CropFocus = CropId | "mixed" | "unknown";

export const CONTEXT_FIELDS = ["stage", "practices", "chemicals", "weather", "issues", "notes"] as const;
export type ContextField = (typeof CONTEXT_FIELDS)[number];
export type FarmerContext = Record<ContextField, string>;

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
  detectedPlant: string;
  /** Free-text name the farmer typed before the check. */
  farmerPlant: string;
  contextAsk: string | null;
  contextUsed: boolean;
  chemicals: ChemicalAdvice | null;
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
  readonly code: "bad_request" | "unsupported_image" | "image_too_large" | "missing_key" | "missing_plant" | "upstream";

  constructor(code: AnalyzeError["code"]) {
    super(code);
    this.name = "AnalyzeError";
    this.code = code;
  }
}
