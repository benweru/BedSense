import { MetaHttpError, postMeta, readApiKey } from "@/lib/server/meta";

/**
 * Muse Image "what to look for" reference illustrations. Grounded in the
 * rendered reading: the plant, the named suspect, and the visible symptom.
 * Generation prompts are constrained to the known suspect list (see item 16);
 * this module builds and sends the prompt and returns the image bytes.
 */
export const MUSE_IMAGE_MODEL = "muse-image-1.0";

export class IllustrateError extends Error {
  readonly code: "bad_request" | "missing_key" | "muse_unavailable" | "rate_limited" | "upstream";

  constructor(code: IllustrateError["code"]) {
    super(code);
    this.name = "IllustrateError";
    this.code = code;
  }
}

export const PLANT_LIMIT = 120;
export const SUSPECT_LIMIT = 160;
export const SYMPTOM_LIMIT = 300;

export type ReferenceImage = {
  image: string;
  mime: string;
  model: string;
};

export async function illustrateReference(input: {
  plant: unknown;
  suspect: unknown;
  symptom: unknown;
}): Promise<ReferenceImage> {
  const plant = cleanText(input.plant, PLANT_LIMIT);
  const suspect = cleanText(input.suspect, SUSPECT_LIMIT);
  const symptom = cleanText(input.symptom, SYMPTOM_LIMIT);
  // The illustration is only ever grounded in a named suspect and a visible symptom.
  if (!suspect || !symptom) throw new IllustrateError("bad_request");
  const apiKey = readApiKey();
  if (!apiKey) throw new IllustrateError("missing_key");

  const prompt = referencePrompt(plant || "crop plant", suspect, symptom);
  let payload: unknown;
  try {
    const response = await postMeta("/responses", { model: MUSE_IMAGE_MODEL, input: prompt }, apiKey, 55_000);
    if (response.kind !== "json") throw new IllustrateError("upstream");
    payload = response.value;
  } catch (error) {
    throw illustrateFailure(error);
  }
  const result = imageResult(payload);
  if (!result) throw new IllustrateError("upstream");
  const bytes = Buffer.from(result, "base64");
  if (bytes.length === 0) throw new IllustrateError("upstream");
  const mime = sniffMime(bytes);
  return { image: `data:${mime};base64,${result}`, mime, model: MUSE_IMAGE_MODEL };
}

/** Flat educational diagram, never a photograph: markings stay comparable to the farmer's leaf. */
export function referencePrompt(plant: string, suspect: string, symptom: string): string {
  return (
    `Botanical reference illustration in flat educational diagram style: a ${plant} leaf showing ${symptom}, ` +
    `characteristic markings of ${suspect}. One leaf centered on a clean off-white background, crisp edges, ` +
    `accurate spots and discoloration, no photograph, no people, no hands, no text, no watermark.`
  );
}

/** The image is the base64 `result` on the `image_generation_call` output item. */
function imageResult(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as { status?: unknown; output?: unknown };
  if (response.status !== undefined && response.status !== "completed") return null;
  if (!Array.isArray(response.output)) return null;
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const record = item as { type?: unknown; result?: unknown };
    if (record.type !== "image_generation_call") continue;
    if (typeof record.result !== "string") continue;
    const cleaned = record.result.replace(/\s/g, "");
    if (cleaned) return cleaned;
  }
  return null;
}

function sniffMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  // The cookbook's renders save as webp; assume it when the bytes carry no signature.
  return "image/webp";
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function illustrateFailure(error: unknown): IllustrateError {
  if (error instanceof IllustrateError) return error;
  if (error instanceof MetaHttpError) {
    if (error.status === 429) return new IllustrateError("rate_limited");
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.reason === "model_not_found") {
      return new IllustrateError("muse_unavailable");
    }
  }
  return new IllustrateError("upstream");
}
