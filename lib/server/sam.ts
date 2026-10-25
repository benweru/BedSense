import { decodeMaskToRaster, parseImageStream, recordsOfKind, type ResponsesEvent } from "@meta-sam/parser";
import { conceptById } from "@/lib/concepts";
import { areaFractionFromRaster, downsampleRaster } from "@/lib/grid";
import { preferSpecificCrops } from "@/lib/plant-marks";
import { probesForPlant } from "@/lib/plants";
import { postMeta, SAM_MODEL, textFromPayload, type MetaPayload } from "@/lib/server/meta";
import type { ConceptId, MaskMark } from "@/lib/types";

const PER_CONCEPT_CAP = 8;

export type SegmentPass = {
  masks: MaskMark[];
  failed: ConceptId[];
  sourceSize: { width: number; height: number } | null;
};

/** SAM prompts for this photo: the named plant, yellow leaf, and weed. */
export function promptsForBed(farmerPlant: string): { id: ConceptId; phrase: string; extra: boolean }[] {
  return probesForPlant(farmerPlant).map((probe) => ({
    id: probe.id,
    phrase: probe.phrase,
    extra: probe.id === "plant",
  }));
}

export async function segmentBed(
  imageUrl: string,
  apiKey: string,
  imageAreaHint: number,
  farmerPlant: string,
): Promise<SegmentPass> {
  const jobs = promptsForBed(farmerPlant);
  const passes = await Promise.all(
    jobs.map(async (job) => {
      try {
        const payload = await postMeta(
          "/responses",
          {
            model: SAM_MODEL,
            stream: true,
            metadata: {
              mask_encoding: "one_bit",
              include_confidence: "true",
            },
            input: [
              {
                type: "message",
                role: "user",
                content: [
                  { type: "input_text", text: job.phrase },
                  { type: "input_image", image_url: imageUrl },
                ],
              },
            ],
          },
          apiKey,
        );
        const text = samOutputText(payload);
        const parsed = await masksFromOutputText(job.id, text, imageAreaHint);
        return {
          conceptId: job.id,
          masks: parsed.masks.map((mask) => ({ ...mask, phrase: job.phrase })),
          sourceSize: parsed.sourceSize,
          failed: false as const,
        };
      } catch {
        return {
          conceptId: job.id,
          masks: [] as MaskMark[],
          sourceSize: null,
          failed: true as const,
        };
      }
    }),
  );

  return {
    masks: preferSpecificCrops(passes.flatMap((pass) => pass.masks)),
    failed: passes.filter((pass) => pass.failed).map((pass) => pass.conceptId),
    sourceSize: passes.find((pass) => pass.sourceSize)?.sourceSize ?? null,
  };
}

export async function masksFromOutputText(
  conceptId: ConceptId,
  text: string,
  imageArea: number,
): Promise<{ masks: MaskMark[]; sourceSize: { width: number; height: number } | null }> {
  const sourceSize = sourceSizeFromRaw(text);
  if (!text.trim()) return { masks: [], sourceSize };
  const area = sourceSize ? sourceSize.width * sourceSize.height : imageArea;
  const result = await parseImageStream(eventsFromText(text)).finalResult;
  const concept = conceptById(conceptId);
  const masks: MaskMark[] = [];

  for (const record of recordsOfKind(result.records, "mask")) {
    const boxWidth = record.bounds.right - record.bounds.left;
    const boxHeight = record.bounds.bottom - record.bounds.top;
    if (boxWidth <= 0 || boxHeight <= 0) continue;
    let raster: Uint8Array;
    try {
      raster = decodeMaskToRaster(record.mask);
    } catch {
      continue;
    }
    const grid = downsampleRaster(raster, record.mask.width, record.mask.height);
    masks.push({
      id: `${concept.id}-${record.objectId}-${masks.length}`,
      conceptId: concept.id,
      phrase: concept.phrase,
      kind: concept.kind,
      crop: concept.crop,
      objectId: record.objectId,
      confidence: typeof record.confidence === "number" ? record.confidence : null,
      box: {
        x: record.bounds.left,
        y: record.bounds.top,
        width: boxWidth,
        height: boxHeight,
      },
      grid,
      areaFraction: areaFractionFromRaster(raster, boxWidth * boxHeight, Math.max(area, 1)),
    });
  }

  masks.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1) || b.areaFraction - a.areaFraction);
  return { masks: masks.slice(0, PER_CONCEPT_CAP), sourceSize };
}

export function sourceSizeFromRaw(raw: string): { width: number; height: number } | null {
  const match = /;w=(\d+);h=(\d+)/.exec(raw);
  if (!match?.[1] || !match[2]) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

export function samOutputText(payload: MetaPayload): string {
  return textFromPayload(payload, (events, json) => {
    if (json) return outputTextFromJson(json);
    return outputTextFromEvents(events);
  });
}

function outputTextFromEvents(events: Record<string, unknown>[]): string {
  let delta = "";
  let done = "";
  for (const event of events) {
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      delta += event.delta;
    }
    if (event.type === "response.output_text.done" && typeof event.text === "string") {
      done = event.text;
    }
    if (event.type === "response.content_part.done") {
      const part = event.part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        done = part.text;
      }
    }
  }
  return done.length >= delta.length ? done : delta;
}

function outputTextFromJson(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  const chunks: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object" || !("content" in item)) continue;
    const content = item.content;
    if (typeof content === "string") chunks.push(content);
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("");
}

async function* eventsFromText(text: string): AsyncIterable<ResponsesEvent> {
  const lane = { item_id: "message-1", output_index: 0, content_index: 0 } as const;
  yield { type: "response.output_text.delta", delta: text, ...lane };
  yield { type: "response.output_text.done", text, ...lane };
  yield { type: "response.completed" };
}
