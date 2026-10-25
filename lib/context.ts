import { copy } from "@/lib/copy";
import { containsDosage } from "@/lib/triage";
import { CONTEXT_FIELDS, type ContextField, type CropId, type FarmerContext, type Locale } from "@/lib/types";

const LIMITS: Record<ContextField, number> = {
  stage: 120,
  practices: 240,
  chemicals: 240,
  weather: 240,
  issues: 240,
  notes: 600,
};

const PROMPT_LABELS: Record<ContextField, string> = {
  stage: "Plant age or stage",
  practices: "Current practices",
  chemicals: "Chemicals already used",
  weather: "Recent weather or irrigation",
  issues: "Known issues",
  notes: "Other notes",
};

export function emptyFarmerContext(): FarmerContext {
  return { stage: "", practices: "", chemicals: "", weather: "", issues: "", notes: "" };
}

export function parseFarmerContext(value: unknown): FarmerContext {
  const context = emptyFarmerContext();
  if (typeof value === "string") {
    context.notes = clip(value, LIMITS.notes);
    return context;
  }
  if (!value || typeof value !== "object") return context;
  const record = value as Record<string, unknown>;
  for (const field of CONTEXT_FIELDS) {
    context[field] = clip(record[field], LIMITS[field]);
  }
  return context;
}

export function contextIsEmpty(context: FarmerContext): boolean {
  return CONTEXT_FIELDS.every((field) => context[field].length === 0);
}

export function contextPromptBlock(context: FarmerContext): string {
  if (contextIsEmpty(context)) {
    return "Farmer context: none. Still read the photo and the named plant, and return three next checks. Put one short question in contextAsk only if a missing fact would change those checks.";
  }
  const lines = CONTEXT_FIELDS.filter((field) => context[field]).map((field) => `- ${PROMPT_LABELS[field]}: ${context[field]}`);
  return [
    "Farmer context (already offered, optional detail — do not ask them to pick a crop):",
    ...lines,
    "Use this as history. Do not repeat a spray dose or a mixing rate.",
  ].join("\n");
}

export function cleanPlantName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || containsDosage(text)) return null;
  return text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text;
}

export function fallbackPlantName(locale: Locale, primaryCrop: CropId | null): string {
  if (primaryCrop) return copy[locale].concepts[primaryCrop];
  return copy[locale].unknownPlant;
}

export function cleanContextAsk(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || containsDosage(text)) return null;
  return text.length > 220 ? `${text.slice(0, 219).trimEnd()}…` : text;
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
