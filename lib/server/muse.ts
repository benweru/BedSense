import { copy, normalizeLocale } from "@/lib/copy";
import { MUSE_MODELS, postMeta, type MuseModel } from "@/lib/server/meta";
import { finalizeTriage } from "@/lib/triage";
import type { ConceptCounts, ConceptId, Locale } from "@/lib/types";

export type TriageDraft = {
  observations: string[];
  actions: [string, string, string];
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  disclaimer: string;
  agronomistCallout: string;
  model: MuseModel | null;
  triageSource: "muse" | "local-fallback";
};

export async function adviseBed(options: {
  imageUrl: string;
  apiKey: string;
  locale: Locale;
  counts: ConceptCounts;
  failedConcepts: readonly ConceptId[];
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
          max_completion_tokens: 900,
          messages: [
            { role: "developer", content: developerPrompt(options.locale) },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt(options.locale, summary) },
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
      return { ...finalized, model, triageSource: "muse" };
    } catch {
      // Try the standard Muse Spark model, then the local backup.
    }
  }
  return localFallback(options.locale, options.counts, options.failedConcepts);
}

export function localFallback(
  locale: Locale,
  counts: ConceptCounts,
  failedConcepts: readonly ConceptId[],
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
  return { ...finalized, model: null, triageSource: "local-fallback" };
}

export function developerPrompt(locale: Locale): string {
  const language = locale === "sw" ? "Swahili" : "English";
  return [
    "You are BedSense, a field triage assistant for smallholder vegetable beds in Kenya.",
    "Onion is the primary crop. Beetroot and chili are secondary.",
    "You do not diagnose disease and you do not prescribe pesticides.",
    "Never give a spray dose, a mixing rate, millilitres, grams, or litres per area or per tank.",
    "If a treatment would need a product, tell the farmer to ask an agronomist instead.",
    "Actions must be things a farmer can do today without buying chemicals: look, feel soil moisture, remove the worst leaves from the bed, improve airflow, photograph again, visit an extension officer.",
    `Reply in ${language}.`,
    "Return one JSON object only, with this shape:",
    '{"observations":["short field note","short field note"],"actions":["check","check","check"],"confidence":"low|medium|high","confidenceScore":0.5}',
    "observations has 2 or 3 items. actions has exactly 3 items. confidenceScore is from 0 to 1.",
  ].join(" ");
}

function userPrompt(locale: Locale, summary: string): string {
  const language = normalizeLocale(locale) === "sw" ? "Swahili" : "English";
  return [
    "This is a phone photo of one farm bed.",
    `Segmentation counts: ${summary}`,
    "Use the photo and those counts.",
    "Say what is worth checking. Do not state a disease as a fact.",
    `Write the JSON in ${language}.`,
  ].join(" ");
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
  };
}
