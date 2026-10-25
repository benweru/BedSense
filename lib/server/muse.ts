import { cleanContextAsk, cleanPlantName, contextIsEmpty, contextPromptBlock, fallbackPlantName } from "@/lib/context";
import { copy, normalizeLocale } from "@/lib/copy";
import { contextText, inferIssue } from "@/lib/issues";
import { displayPlantName } from "@/lib/plants";
import { MUSE_MODELS, postMeta, type MuseModel } from "@/lib/server/meta";
import { finalizeTriage } from "@/lib/triage";
import type { ChemicalOffer, ConceptCounts, CropId, FarmerContext, Locale } from "@/lib/types";

export type TriageDraft = {
  observations: string[];
  actions: [string, string, string];
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  hypotheses: string[];
  chemicals: ChemicalOffer[];
  disclaimer: string;
  agronomistCallout: string;
  model: MuseModel | null;
  triageSource: "muse" | "local-fallback";
  detectedPlant: string;
  contextAsk: string | null;
};

export async function adviseBed(options: {
  imageUrl: string;
  apiKey: string;
  locale: Locale;
  counts: ConceptCounts;
  context: FarmerContext;
  primaryCrop: CropId | null;
  plantName: string;
}): Promise<TriageDraft> {
  const summary = copy[options.locale].countLine(options.counts) || "none";
  const named = displayPlantName(options.locale, options.plantName);
  for (const model of MUSE_MODELS) {
    try {
      const payload = await postMeta(
        "/chat/completions",
        {
          model,
          stream: true,
          reasoning_effort: "low",
          max_completion_tokens: 900,
          messages: [
            { role: "developer", content: developerPrompt(options.locale) },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt(options.locale, summary, options.context, options.plantName) },
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
        hypotheses: parsed.hypotheses,
        confidence: parsed.confidence,
        confidenceScore: parsed.confidenceScore,
        counts: options.counts,
        plantName: named || options.plantName,
        context: options.context,
        chemicalsHelp: parsed.chemicalsHelp,
        issue: parsed.issue,
      });
      const fromModel = cleanPlantName(parsed.detectedPlant);
      return {
        ...finalized,
        model,
        triageSource: "muse",
        detectedPlant: named || (fromModel ? displayPlantName(options.locale, fromModel) : "") || fallbackPlantName(options.locale, options.primaryCrop),
        contextAsk: cleanContextAsk(parsed.contextAsk),
      };
    } catch {
      // Try the standard Muse Spark model, then the local backup.
    }
  }
  return localFallback(options.locale, options.counts, options.context, options.primaryCrop, options.plantName);
}

export function localFallback(
  locale: Locale,
  counts: ConceptCounts,
  context: FarmerContext,
  primaryCrop: CropId | null,
  plantName: string,
): TriageDraft {
  const text = copy[locale];
  const display = displayPlantName(locale, plantName) || fallbackPlantName(locale, primaryCrop);
  const issue = inferIssue(contextText(context));
  const finalized = finalizeTriage({
    locale,
    observations: [],
    actions: text.fallbackActions,
    confidence: issue ? "medium" : "low",
    confidenceScore: issue ? 0.56 : 0.33,
    counts,
    plantName: display,
    context,
    issue: issue ?? "none",
  });
  return {
    ...finalized,
    model: null,
    triageSource: "local-fallback",
    detectedPlant: display,
    contextAsk: contextIsEmpty(context) ? text.contextAskDefault : null,
  };
}

export function developerPrompt(locale: Locale): string {
  const language = locale === "sw" ? "Swahili" : "English";
  return [
    "You are BedSense, a field triage assistant for any vegetable farm bed.",
    "The farmer names the plant. That name is the subject. It may be any farm plant, not a fixed list.",
    "A photo may be a whole bed or a close-up of a leaf or fruit, including a plant held in the hand.",
    "BedSense works well with onion, and is often used for beetroot and chili. Those are common crops, each grown on its own bed. They are not a limit on what you can advise.",
    "Onion and beetroot are never on the same bed. Chili is a separate bed as well.",
    "If more than one of onion, beetroot, and chili is marked in the frame, that is unusual: multi-crop on one photo, not the planting pattern.",
    "Do not invent where the beds are.",
    "Do not mention a crop the farmer did not name unless the segmentation counts for that crop are above zero.",
    "Empty or failed segmentation is common on close-ups. Still read the photo, the plant name, and the context.",
    "Offer likely causes as hypotheses when the photo or the context shows curling, spots, wilting, yellowing, insects, or deformed growth. Do not state a lab confirmation.",
    "Never give a spray dose, a mixing rate, millilitres, grams, or litres per area or per tank.",
    "If the farmer mentions products already used, treat that as history. Do not recommend a new dose.",
    "When a shop product would help, set chemicalsHelp to true and set issue to the symptom. Do not invent shops or prices.",
    "When water, nutrition, or a wilt that a spray will not fix is the better explanation, set chemicalsHelp to false.",
    "Return exactly three next checks in actions. Make them specific to this plant and what you see.",
    "If one extra fact would make those checks more accurate, put one short question in contextAsk. Otherwise contextAsk is an empty string.",
    "Do not ask the farmer to choose onion, beetroot, or chili from a list.",
    `Reply in ${language}.`,
    "Return one JSON object only, with this shape:",
    '{"detectedPlant":"plant name","observations":["short field note","short field note"],"hypotheses":["likely cause","likely cause"],"actions":["check","check","check"],"confidence":"low|medium|high","confidenceScore":0.5,"contextAsk":"","chemicalsHelp":false,"issue":"curl|deformity|spots|wilt|yellowing|insects|none"}',
    "observations has 2 or 3 items. hypotheses has 1 to 3 items, or is empty when nothing looks wrong. actions has exactly 3 items. confidenceScore is from 0 to 1.",
  ].join(" ");
}

export function userPrompt(locale: Locale, summary: string, context: FarmerContext, plantName = ""): string {
  const language = normalizeLocale(locale) === "sw" ? "Swahili" : "English";
  const named = displayPlantName(locale, plantName);
  return [
    named
      ? `The farmer named the plant: ${named}. That is the crop in this photo. It may be any farm plant.`
      : "The farmer did not name the plant. Name the plant you see. It may be any farm plant.",
    "Onion, beetroot, and chili are grown on different beds. More than one of them in this frame is unusual, not the planting pattern. Do not mention a crop that is not the named plant unless the segmentation counts show it above zero.",
    "SAM marks may be empty on a close-up, a hand-held photo, or a fruit-only shot. Empty marks are not a reason to skip triage.",
    `Segmentation counts: ${summary}`,
    contextPromptBlock(context),
    "Use the photo first, then the plant name, then the context. If you see curling, spots, wilting, yellowing, insects, or deformed fruit, say so in observations and hypotheses.",
    "observations are short notes about this frame only. Do not mention segmentation failures or crops that are absent.",
    "Never give a dose, a mixing rate, or millilitres, grams, or litres.",
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
  hypotheses: unknown;
  chemicalsHelp: unknown;
  issue: unknown;
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
    hypotheses: record.hypotheses,
    chemicalsHelp: record.chemicalsHelp,
    issue: record.issue,
  };
}
