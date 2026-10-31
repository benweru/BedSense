import { emptyConceptCounts } from "@/lib/concepts";
import { contextIsEmpty, parseFarmerContext } from "@/lib/context";
import { copy, normalizeLocale } from "@/lib/copy";
import { chooseCropFocus } from "@/lib/crop-focus";
import { clampDeclaredSize, decodeDataUrl, type ImageSize } from "@/lib/image";
import { parseFarmerPlant } from "@/lib/plant-name";
import { holdFor, qualityMessageFor, qualityNoteFor } from "@/lib/quality-copy";
import { buildMockResult, scenarioForPlant } from "@/lib/server/mock";
import { adviseBed } from "@/lib/server/muse";
import { isMockMode, readApiKey } from "@/lib/server/meta";
import { isSoftPhoto, isUnsureRead, judgeFrame, measureJpeg, type PhotoVerdict } from "@/lib/photo-quality";
import { memoryPromptBlock } from "@/lib/memory";
import { isUuid, supabasePlantStore, type PlantMemoryStore } from "@/lib/server/plant-store";
import { segmentBed } from "@/lib/server/sam";
import { AnalyzeError, type AnalyzeResult, type ConceptCounts, type CropId, type Locale, type MaskMark, type PlantProgress } from "@/lib/types";

export type AnalyzeInput = {
  image?: unknown;
  /** Up to three data URLs of the same plant, from different angles. */
  images?: unknown;
  locale?: unknown;
  width?: unknown;
  height?: unknown;
  context?: unknown;
  plantName?: unknown;
  /** Saved plant to read memory from and file this check under. Ignored when signed out. */
  plantId?: unknown;
};

const MAX_PHOTOS = 3;

type MemoryInput = { block: string; hasHistory: boolean } | null;

export async function analyzeBedPhoto(input: AnalyzeInput, store: PlantMemoryStore = supabasePlantStore): Promise<AnalyzeResult> {
  const plantId = isUuid(input.plantId) ? input.plantId : null;
  const memory = plantId ? await store.load(plantId).catch(() => null) : null;
  const memoryInput: MemoryInput = memory
    ? {
        block: memoryPromptBlock(memory.plant, memory.checks, memory.practices, new Date()),
        hasHistory: memory.checks.some((check) => !check.result.qualityHold),
      }
    : null;
  const { result, photo } = await runAnalysis(input, memoryInput);
  if (!memory || !plantId) return result;
  const filed: AnalyzeResult = { ...result, plantId };
  if (!filed.qualityHold) {
    await store.save(plantId, filed, photo).catch((error: unknown) => {
      console.error(`plant check save ${error instanceof Error ? error.message : "error"}`);
    });
  }
  return filed;
}

async function runAnalysis(
  input: AnalyzeInput,
  memory: MemoryInput,
): Promise<{ result: AnalyzeResult; photo: { bytes: Uint8Array; mime: string } }> {
  const urls = photoUrls(input);
  const decoded = urls.map((url) => {
    try {
      return { url, ...decodeDataUrl(url) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "image_too_large") throw new AnalyzeError("image_too_large");
      throw new AnalyzeError("unsupported_image");
    }
  });
  const first = decoded[0];
  if (!first) throw new AnalyzeError("bad_request");

  const locale = normalizeLocale(input.locale);
  const context = parseFarmerContext(input.context);
  const farmerPlant = parseFarmerPlant(input.plantName);
  if (!farmerPlant) throw new AnalyzeError("missing_plant");
  const size = resolveSize(first.size, clampDeclaredSize(input.width, input.height));
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();

  const photo = { bytes: first.bytes, mime: first.mime };
  const done = (result: AnalyzeResult) => ({ result, photo });

  if (isMockMode()) {
    const mock = buildMockResult({
      scenario: scenarioForPlant(farmerPlant, first.bytes),
      locale,
      width: size.width,
      height: size.height,
      mime: first.mime,
      id,
      createdAt,
      context,
      farmerPlant,
    });
    return done(memory?.hasHistory ? { ...mock, progress: mockProgress(locale) } : mock);
  }

  const apiKey = readApiKey();
  if (!apiKey) throw new AnalyzeError("missing_key");

  // The Hobby function ends at 60s. Leave the last moments for a finished JSON body.
  const deadline = Date.now() + 50_000;
  const segmented = await Promise.all(
    decoded.map(async (photo, frame) => {
      const clarity = photo.mime === "image/jpeg" ? measureJpeg(photo.bytes) : null;
      const blurry = isSoftPhoto(clarity?.sharpness ?? null);
      const pass = blurry
        ? { masks: [] as MaskMark[], sourceSize: null }
        : await segmentBed(photo.url, apiKey, (photo.size?.width ?? size.width) * (photo.size?.height ?? size.height), farmerPlant, 18_000);
      const masks = pass.masks.map((mask) => ({ ...mask, id: `${frame}-${mask.id}`, frame }));
      const verdict = judgeFrame({
        masks,
        sharpness: clarity?.sharpness ?? null,
        skyFraction: clarity?.skyFraction ?? null,
        contrastRange: clarity?.contrastRange ?? null,
        shadowFraction: clarity?.shadowFraction ?? null,
        highlightFraction: clarity?.highlightFraction ?? null,
      });
      return {
        frame,
        url: photo.url,
        size: pass.sourceSize ?? photo.size ?? size,
        mime: photo.mime,
        masks: verdict === "use" ? masks : [],
        verdict,
      };
    }),
  );
  const usable = segmented.filter((photo) => photo.verdict === "use");
  if (usable.length === 0) {
    // Soft frames skip SAM, so a sharp-enough photo of a wall, a face or a floor
    // lands here as "unclear". Ask Muse whether a plant is in frame at all before
    // telling the farmer to hold the phone steady.
    const anySoft = segmented.some((photo) => photo.verdict === "unclear");
    const plantCheck = anySoft
      ? await adviseBed({
          imageUrl: segmented[0]?.url ?? first.url,
          imageUrls: segmented.map((photo) => photo.url),
          apiKey,
          locale,
          counts: emptyConceptCounts(),
          frameCounts: segmented.map(() => emptyConceptCounts()),
          context,
          primaryCrop: null,
          farmerPlant,
          deadline,
          memory: null,
          wantProgress: false,
        })
      : null;
    return done(withheldResult({
      id,
      createdAt,
      locale,
      farmerPlant,
      size,
      mime: first.mime,
      frames: segmented.map((photo) => ({ width: photo.size.width, height: photo.size.height, mime: photo.mime })),
      verdicts: segmented.map((photo) => photo.verdict),
      hold: plantCheck?.plantInFrame === false ? "not_plant" : undefined,
    }));
  }
  const lead = usable[0] ?? segmented[0];
  if (!lead) throw new AnalyzeError("bad_request");
  const masks = usable.flatMap((photo) => photo.masks);
  const image = lead.size;
  const counts = countMasks(masks);
  const focus = chooseCropFocus(areaByCrop(masks));
  const advice = await adviseBed({
    imageUrl: lead.url,
    imageUrls: usable.map((photo) => photo.url),
    apiKey,
    locale,
    counts,
    frameCounts: usable.map((photo) => countMasks(photo.masks)),
    context,
    primaryCrop: focus.primaryCrop,
    farmerPlant,
    deadline,
    memory: memory?.block ?? null,
    wantProgress: memory?.hasHistory ?? false,
  });
  const genericOnly = advice.actions.every((action, index) => action === copy[locale].fallbackActions[index]);
  if (advice.plantInFrame === false || (masks.length === 0 && advice.plantInFrame !== true && (advice.triageSource === "local-fallback" || genericOnly))) {
    return done(withheldResult({
      id,
      createdAt,
      locale,
      farmerPlant,
      size,
      mime: first.mime,
      frames: segmented.map((photo) => ({ width: photo.size.width, height: photo.size.height, mime: photo.mime })),
      verdicts: segmented.map(() => "unclear" as const),
      hold: "not_plant",
    }));
  }
  if (advice.confidenceStated && isUnsureRead(masks.length, advice.confidenceScore)) {
    return done(withheldResult({
      id,
      createdAt,
      locale,
      farmerPlant,
      size,
      mime: first.mime,
      frames: segmented.map((photo) => ({ width: photo.size.width, height: photo.size.height, mime: photo.mime })),
      verdicts: segmented.map((photo) => (photo.verdict === "use" ? "unclear" : photo.verdict)),
    }));
  }
  const skipped = segmented
    .filter((photo) => photo.verdict !== "use")
    .map((photo) => ({ frame: photo.frame + 1, lighting: photo.verdict === "harsh_light" }));
  const qualityBatch = skipped.length > 0 ? { kept: usable.map((photo) => photo.frame + 1), skipped } : null;
  const qualityNote = qualityNoteFor(locale, qualityBatch);

  return done({
    id,
    createdAt,
    locale,
    mode: "live",
    models: {
      sam: "sam-3.1",
      muse: advice.model,
      triageSource: advice.triageSource,
    },
    image: { width: image.width, height: image.height, mime: lead.mime },
    frames: segmented.map((photo) => ({ width: photo.size.width, height: photo.size.height, mime: photo.mime })),
    cropFocus: focus.cropFocus,
    primaryCrop: focus.primaryCrop,
    detectedPlant: advice.detectedPlant,
    farmerPlant,
    contextAsk: advice.contextAsk,
    contextUsed: !contextIsEmpty(context),
    chemicals: advice.chemicals,
    counts,
    masks,
    observations: advice.observations,
    likelyCauses: advice.likelyCauses,
    mitigations: advice.mitigations,
    actions: advice.actions,
    confidence: advice.confidence,
    confidenceScore: advice.confidenceScore,
    disclaimer: advice.disclaimer,
    agronomistCallout: advice.agronomistCallout,
    note: advice.triageSource === "local-fallback" ? "local-fallback" : null,
    qualityHold: null,
    qualityMessage: null,
    qualityNote,
    qualityBatch,
    progress: memory?.hasHistory ? advice.progress : null,
  });
}

function mockProgress(locale: Locale): PlantProgress {
  return {
    growthTrend: "stable",
    flowering: null,
    sinceLastCheck: locale === "sw" ? "Onyesho: mmea unaonekana sawa na ukaguzi uliopita." : "Demo: the plant looks about the same as the last check.",
  };
}

function withheldResult(options: {
  id: string;
  createdAt: string;
  locale: Locale;
  farmerPlant: string;
  size: ImageSize;
  mime: string;
  frames: { width: number; height: number; mime: string }[];
  verdicts: PhotoVerdict[];
  hold?: "too_far" | "unclear" | "mixed" | "not_plant";
}): AnalyzeResult {
  const text = copy[options.locale];
  const qualityHold = options.hold ?? holdFor(options.verdicts);
  const qualityMessage = qualityMessageFor(options.locale, qualityHold, options.verdicts);
  return {
    id: options.id,
    createdAt: options.createdAt,
    locale: options.locale,
    mode: "live",
    models: { sam: "sam-3.1", muse: null, triageSource: "withheld" },
    image: { width: options.size.width, height: options.size.height, mime: options.mime },
    frames: options.frames,
    cropFocus: "unknown",
    primaryCrop: null,
    detectedPlant: options.farmerPlant,
    farmerPlant: options.farmerPlant,
    contextAsk: null,
    contextUsed: false,
    chemicals: null,
    counts: emptyConceptCounts(),
    masks: [],
    observations: [],
    likelyCauses: [],
    mitigations: [],
    actions: ["", "", ""],
    confidence: "low",
    confidenceScore: 0,
    disclaimer: text.disclaimer,
    agronomistCallout: text.agronomistCallout,
    note: null,
    qualityHold,
    qualityMessage,
    qualityVerdicts: options.verdicts,
    qualityNote: null,
  };
}

function photoUrls(input: AnalyzeInput): string[] {
  if (Array.isArray(input.images)) {
    if (input.images.length === 0 || input.images.length > MAX_PHOTOS) throw new AnalyzeError("bad_request");
    if (input.images.some((item) => typeof item !== "string" || !item.trim())) throw new AnalyzeError("bad_request");
    return input.images as string[];
  }
  if (typeof input.image === "string" && input.image.trim()) return [input.image];
  throw new AnalyzeError("bad_request");
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
