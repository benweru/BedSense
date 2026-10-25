import { emptyConceptCounts } from "@/lib/concepts";
import { contextIsEmpty, noteContextUse, parseFarmerContext } from "@/lib/context";
import { normalizeLocale } from "@/lib/copy";
import { chooseCropFocus } from "@/lib/crop-focus";
import { clampDeclaredSize, decodeDataUrl, type ImageSize } from "@/lib/image";
import { buildMockResult, demoScenario } from "@/lib/server/mock";
import { adviseBed } from "@/lib/server/muse";
import { isMockMode, readApiKey } from "@/lib/server/meta";
import { segmentBed } from "@/lib/server/sam";
import { AnalyzeError, type AnalyzeResult, type ConceptCounts, type CropId, type MaskMark } from "@/lib/types";

export type AnalyzeInput = {
  image?: unknown;
  locale?: unknown;
  width?: unknown;
  height?: unknown;
  context?: unknown;
};

export async function analyzeBedPhoto(input: AnalyzeInput): Promise<AnalyzeResult> {
  if (typeof input.image !== "string" || !input.image.trim()) {
    throw new AnalyzeError("bad_request");
  }

  let decoded;
  try {
    decoded = decodeDataUrl(input.image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "image_too_large") throw new AnalyzeError("image_too_large");
    throw new AnalyzeError("unsupported_image");
  }

  const locale = normalizeLocale(input.locale);
  const context = parseFarmerContext(input.context);
  const size = resolveSize(decoded.size, clampDeclaredSize(input.width, input.height));
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();

  if (isMockMode()) {
    return buildMockResult({
      scenario: demoScenario(decoded.bytes),
      locale,
      width: size.width,
      height: size.height,
      mime: decoded.mime,
      id,
      createdAt,
      context,
    });
  }

  const apiKey = readApiKey();
  if (!apiKey) throw new AnalyzeError("missing_key");

  const segmented = await segmentBed(input.image, apiKey, size.width * size.height);
  const image = segmented.sourceSize ?? size;
  const counts = countMasks(segmented.masks);
  const focus = chooseCropFocus(areaByCrop(segmented.masks));
  const advice = await adviseBed({
    imageUrl: input.image,
    apiKey,
    locale,
    counts,
    failedConcepts: segmented.failed,
    context,
    primaryCrop: focus.primaryCrop,
  });

  return {
    id,
    createdAt,
    locale,
    mode: "live",
    models: {
      sam: "sam-3.1",
      muse: advice.model,
      triageSource: advice.triageSource,
    },
    image: { width: image.width, height: image.height, mime: decoded.mime },
    cropFocus: focus.cropFocus,
    primaryCrop: focus.primaryCrop,
    detectedPlant: advice.detectedPlant,
    contextAsk: advice.contextAsk,
    contextUsed: !contextIsEmpty(context),
    counts,
    masks: segmented.masks,
    observations: noteContextUse(locale, advice.observations, context),
    actions: advice.actions,
    confidence: advice.confidence,
    confidenceScore: advice.confidenceScore,
    disclaimer: advice.disclaimer,
    agronomistCallout: advice.agronomistCallout,
    note: advice.triageSource === "local-fallback" ? "local-fallback" : null,
  };
}

function resolveSize(decoded: ImageSize | null, declared: ImageSize | null): ImageSize {
  return decoded ?? declared ?? { width: 900, height: 1200 };
}

function countMasks(masks: readonly MaskMark[]): ConceptCounts {
  const counts = emptyConceptCounts();
  for (const mask of masks) counts[mask.conceptId] += 1;
  return counts;
}

function areaByCrop(masks: readonly MaskMark[]): Record<CropId, number> {
  const areas: Record<CropId, number> = { onion: 0, beetroot: 0, chili: 0 };
  for (const mask of masks) {
    if (mask.crop) areas[mask.crop] += mask.areaFraction;
  }
  return areas;
}
