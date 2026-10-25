import { adviseChemicals } from "@/lib/agrovet";
import { cleanContextAsk, cleanPlantName, contextIsEmpty, contextPromptBlock, fallbackPlantName } from "@/lib/context";
import { copy, normalizeLocale } from "@/lib/copy";
import { parseFarmerPlant } from "@/lib/plant-name";
import { MUSE_MODELS, postMeta, type MuseModel } from "@/lib/server/meta";
import { finalizeTriage } from "@/lib/triage";
import type { ChemicalAdvice, ConceptCounts, ConceptId, CropId, FarmerContext, Locale } from "@/lib/types";

export type TriageDraft = {
  observations: string[];
  actions: [string, string, string];
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  disclaimer: string;
  agronomistCallout: string;
  model: MuseModel | null;
  triageSource: "muse" | "local-fallback";
  detectedPlant: string;
  contextAsk: string | null;
  chemicals: ChemicalAdvice | null;
};

export async function adviseBed(options: {
  imageUrl: string;
  apiKey: string;
  locale: Locale;
  counts: ConceptCounts;
  failedConcepts: readonly ConceptId[];
  context: FarmerContext;
  primaryCrop: CropId | null;
  farmerPlant: string;
}): Promise<TriageDraft> {
  const summary = copy[options.locale].countLine(options.counts);
  for (const model of MUSE_MODELS) {
    try {
      const payload = await postMeta(
        "/chat/completions",
        {
          model,
          stream: true,
          reasoning_effort: "low",
          max_completion_tokens: 1400,
          messages: [
            { role: "developer", content: developerPrompt(options.locale) },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt(options.locale, summary, options.context, options.farmerPlant) },
                { type: "image_url", image_url: { url: options.imageUrl } },
              ],
            },
          ],
        },
        options.apiKey,
      );
      const text = chatOutputText(payload);
      const parsed = parseModelJson(text);
      const finalized = finalizeTriage({
        locale: options.locale,
        observations: parsed.observations,
        actions: parsed.actions,
        confidence: parsed.confidence,
        confidenceScore: parsed.confidenceScore,
        counts: options.counts,
        failedConcepts: options.failedConcepts,
      });
      return {
        ...finalized,
        model,
        triageSource: "muse",
        detectedPlant:
          cleanPlantName(parsed.detectedPlant) ??
          parseFarmerPlant(options.farmerPlant) ??
          fallbackPlantName(options.locale, options.primaryCrop),
        contextAsk: cleanContextAsk(parsed.contextAsk),
        chemicals: adviseChemicals({
          locale: options.locale,
          diseaseIndicated: parsed.diseaseIndicated,
          suspect: parsed.suspect,
          chemicals: parsed.chemicals,
        }),
      };
    } catch {
      // Try the standard Muse Spark model, then the local backup.
    }
  }
  return localFallback(options.locale, options.counts, options.failedConcepts, options.context, options.primaryCrop, options.farmerPlant);
}

export function localFallback(
  locale: Locale,
  counts: ConceptCounts,
  failedConcepts: readonly ConceptId[],
  context: FarmerContext,
  primaryCrop: CropId | null,
  farmerPlant: string,
): TriageDraft {
  const text = copy[locale];
  const finalized = finalizeTriage({
    locale,
    observations: [],
    actions: text.fallbackActions,
    confidence: "low",
    confidenceScore: 0.33,
    counts,
    failedConcepts,
  });
  return {
    ...finalized,
    model: null,
    triageSource: "local-fallback",
    detectedPlant: parseFarmerPlant(farmerPlant) ?? fallbackPlantName(locale, primaryCrop),
    contextAsk: contextIsEmpty(context) ? text.contextAskDefault : null,
    chemicals: null,
  };
}

export function developerPrompt(locale: Locale): string {
  const language = locale === "sw" ? "Swahili" : "English";
  return [
    "You are BedSense, a field triage assistant for any vegetable farm bed.",
    "A photo is one bed. The farmer names the plant in free text to assist you. Prefer that name in detectedPlant unless the photo clearly shows a different plant.",
    "The plant may be any farm plant, not a fixed list.",
    "Onion, beetroot, and chili are common crops, each grown on its own bed. They are not a limit on what you can advise.",
    "Onion and beetroot are never on the same bed. Chili is a separate secondary crop on its own bed.",
    "If more than one of onion, beetroot, and chili is in the frame, that is unusual: multi-crop on one photo, not the planting pattern.",
    "Do not invent where the beds are.",
    "observations describe only what stands out for the plants actually in the photo: symptoms, vigor, spacing, damage, soil, or how many of those plants are in the frame.",
    "Do not mention a crop that is not in the photo. Do not say another crop is missing, secondary, or grown on a different bed.",
    "Return exactly three next checks in actions, even when you are unsure. Each check is a practical thing to look at or do next on the bed: look, feel soil moisture, remove the worst leaves from the bed, improve airflow, photograph again, visit an extension officer.",
    "Do not put a spray rate or a product dose in actions.",
    "If you find or strongly suspect a disease or pest, set diseaseIndicated to true, name it briefly in suspect, and recommend one or two chemicals that would help.",
    "Each chemical has activeIngredient (the common name, such as mancozeb), productClass (such as fungicide or insecticide), and useNote (typical use, with no numeric rate).",
    "Do not invent an exact spray rate, mixing rate, millilitres, grams, or litres per area or per tank. Say the rate must follow the product label.",
    "This chemical advice is for the farmer to verify with a local agroveterinary officer before buying or spraying.",
    "If no disease or pest is indicated, set diseaseIndicated to false, suspect to an empty string, and chemicals to an empty array.",
    "If the farmer mentions products already used, treat that as history. Do not turn that history into a new numeric dose.",
    "If one extra fact would make the checks more accurate, put one short question in contextAsk. Otherwise contextAsk is an empty string.",
    "Do not ask the farmer to choose onion, beetroot, or chili from a list. They already named the plant.",
    `Reply in ${language}.`,
    "Return one JSON object only, with this shape:",
    '{"detectedPlant":"plant name","observations":["short field note","short field note"],"actions":["check","check","check"],"confidence":"low|medium|high","confidenceScore":0.5,"contextAsk":"","diseaseIndicated":true,"suspect":"leaf spot","chemicals":[{"activeIngredient":"mancozeb","productClass":"fungicide","useNote":"Protectant for leaf spots. The rate must follow the product label."}]}',
    "observations has 2 or 3 items. actions has exactly 3 items. confidenceScore is from 0 to 1. chemicals has at most 2 items.",
  ].join(" ");
}

export function userPrompt(locale: Locale, summary: string, context: FarmerContext, farmerPlant: string): string {
  const language = normalizeLocale(locale) === "sw" ? "Swahili" : "English";
  return [
    "This is a phone photo of one farm bed.",
    `The farmer names the plant: ${farmerPlant}. Use that name.`,
    "SAM marks below are only what was found in this photo. A crop that is not listed was not marked.",
    `In frame: ${summary}`,
    contextPromptBlock(context),
    "Use the photo, the plant name, those marks, and any context.",
    "observations must describe only the plants in this photo: symptoms, vigor, spacing, damage, soil, or their count. Do not name a crop that is not in the photo.",
    "If a disease or pest looks likely, name chemicals by active ingredient. Do not give a numeric spray rate.",
    `Write the JSON in ${language}.`,
  ].join("\n");
}

export function chatOutputText(payload: { kind: "json"; value: unknown } | { kind: "sse"; events: Record<string, unknown>[] }): string {
  if (payload.kind === "json") return contentFromJson(payload.value);
  let text = "";
  for (const event of payload.events) {
    const choices = event.choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") continue;
    const choice = choices[0] as { delta?: { content?: unknown }; message?: { content?: unknown } };
    if (typeof choice.delta?.content === "string") text += choice.delta.content;
    if (typeof choice.message?.content === "string" && choice.message.content.length >= text.length) {
      text = choice.message.content;
    }
  }
  return text;
}

function contentFromJson(value: unknown): string {
  if (!value || typeof value !== "object" || !("choices" in value)) return "";
  const choices = value.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = "message" in choices[0] ? choices[0].message : undefined;
  if (!message || typeof message !== "object" || !("content" in message)) return "";
  return typeof message.content === "string" ? message.content : "";
}

export function parseModelJson(text: string): {
  observations: unknown;
  actions: unknown;
  confidence: unknown;
  confidenceScore: unknown;
  detectedPlant: unknown;
  contextAsk: unknown;
  diseaseIndicated: unknown;
  suspect: unknown;
  chemicals: unknown;
} {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("no_json");
  const record = parsed as Record<string, unknown>;
  return {
    observations: record.observations,
    actions: record.actions,
    confidence: record.confidence,
    confidenceScore: record.confidenceScore,
    detectedPlant: record.detectedPlant,
    contextAsk: record.contextAsk,
    diseaseIndicated: record.diseaseIndicated,
    suspect: record.suspect,
    chemicals: record.chemicals,
  };
}
