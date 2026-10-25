import { adviseChemicals } from "@/lib/agrovet";
import { cleanContextAsk, cleanPlantName, contextIsEmpty, contextPromptBlock, fallbackPlantName } from "@/lib/context";
import { copy, normalizeLocale } from "@/lib/copy";
import { contextText, inferIssue, issueActives, sprayIsUsual, type IssueId } from "@/lib/issues";
import { displayPlantName } from "@/lib/plants";
import { parseFarmerPlant } from "@/lib/plant-name";
import { chatMuseModels, listMetaModels, MUSE_MODELS, MUSE_RESERVE_MODELS, MetaHttpError, postMeta } from "@/lib/server/meta";
import { finalizeTriage } from "@/lib/triage";
import type { ChemicalAdvice, ConceptCounts, CropId, FarmerContext, Locale } from "@/lib/types";

/** What Muse is told about SAM. An empty frame must not read as "no plants". */
export function marksSummary(locale: Locale, counts: ConceptCounts): string {
  const summary = copy[locale].countLine(counts);
  if (Object.values(counts).some((count) => count > 0)) return summary;
  return locale === "sw"
    ? "Idadi ya alama za SAM ni sifuri. Eleza mmea uliotajwa kwenye picha."
    : "SAM mark count is zero. Describe the named plant in the photo.";
}

export type ModelDraft = {
  observations: unknown;
  actions: unknown;
  confidence: unknown;
  confidenceScore: unknown;
  detectedPlant: unknown;
  contextAsk: unknown;
  diseaseIndicated: unknown;
  sprayIndicated: unknown;
  suspect: unknown;
  chemicals: unknown;
  symptom: unknown;
  likelyCauses: unknown;
  mitigations: unknown;
};

export type TriageDraft = {
  observations: string[];
  actions: [string, string, string];
  likelyCauses: string[];
  mitigations: string[];
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  disclaimer: string;
  agronomistCallout: string;
  model: string | null;
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
  context: FarmerContext;
  primaryCrop: CropId | null;
  farmerPlant: string;
  /** Wall clock for every Muse attempt. The Hobby function ends at 60s, SAM included. */
  deadline?: number;
}): Promise<TriageDraft> {
  const deadline = options.deadline ?? Date.now() + 36_000;
  let missing = 0;
  let ran = 0;
  for (let index = 0; index < MUSE_MODELS.length; index += 1) {
    const model = MUSE_MODELS[index];
    if (!model) continue;
    ran += 1;
    const attempt = await tryModel(options, model, deadline, index === 0 ? 12_000 : 1_000);
    if (attempt.draft) return attempt.draft;
    if (attempt.missing) missing += 1;
  }
  // Production returned 404 model_not_found for both Spark 1.3 ids. The photo never reached a model,
  // so an empty-context backup filled the generic checks. Ask the catalog, then a short reserve list.
  if (ran > 0 && missing === ran) {
    for (const model of await alternateMuseModels(options.apiKey, deadline)) {
      const attempt = await tryModel(options, model, deadline, 1_000);
      if (attempt.draft) return attempt.draft;
    }
  }
  return localFallback(options.locale, options.counts, options.context, options.primaryCrop, options.farmerPlant);
}

async function alternateMuseModels(apiKey: string, deadline: number): Promise<string[]> {
  let listed: string[] = [];
  const budget = deadline - Date.now();
  if (budget > 9_000) {
    try {
      listed = await listMetaModels(apiKey, Math.min(8_000, budget - 7_000));
    } catch (error) {
      const reason = error instanceof MetaHttpError ? `${error.status} ${error.reason}` : "error";
      console.error(`muse catalog ${reason}`);
      listed = [];
    }
  }
  const skipped = new Set<string>(MUSE_MODELS);
  const fromCatalog = chatMuseModels(listed).filter((id) => !skipped.has(id));
  const fromReserve = MUSE_RESERVE_MODELS.filter((id) => !skipped.has(id) && !fromCatalog.includes(id));
  return [...fromCatalog, ...fromReserve].slice(0, 4);
}

async function tryModel(
  options: {
    imageUrl: string;
    apiKey: string;
    locale: Locale;
    counts: ConceptCounts;
    context: FarmerContext;
    primaryCrop: CropId | null;
    farmerPlant: string;
  },
  model: string,
  deadline: number,
  keepMs: number,
): Promise<{ draft: TriageDraft | null; missing: boolean }> {
  for (let tryIndex = 0; tryIndex < 2; tryIndex += 1) {
    const timeoutMs = attemptTimeout(deadline, keepMs);
    if (timeoutMs === null) return { draft: null, missing: false };
    const started = Date.now();
    try {
      return { draft: await completeModel(options, model, timeoutMs), missing: false };
    } catch (error) {
      const elapsed = Date.now() - started;
      const retryable = tryIndex === 0 && isFastRetry(error) && elapsed < 3_000 && attemptTimeout(deadline, keepMs) !== null;
      if (retryable) {
        if (error instanceof MetaHttpError && error.status === 429) await delay(250);
        continue;
      }
      const reason = error instanceof MetaHttpError ? `${error.status} ${error.reason}` : error instanceof Error ? error.message : "error";
      console.error(`muse ${model} ${reason}`);
      const missing = error instanceof MetaHttpError && (error.status === 404 || error.reason === "model_not_found");
      return { draft: null, missing };
    }
  }
  return { draft: null, missing: false };
}

function attemptTimeout(deadline: number, keepMs: number): number | null {
  const remaining = deadline - Date.now() - keepMs;
  if (remaining < 7_000) return null;
  return Math.min(28_000, remaining);
}

function isFastRetry(error: unknown): boolean {
  if (!(error instanceof MetaHttpError)) return false;
  return error.reason === "timeout" || error.reason === "network" || error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function completeModel(
  options: {
    imageUrl: string;
    apiKey: string;
    locale: Locale;
    counts: ConceptCounts;
    context: FarmerContext;
    primaryCrop: CropId | null;
    farmerPlant: string;
  },
  model: string,
  timeoutMs: number,
): Promise<TriageDraft> {
  const summary = marksSummary(options.locale, options.counts);
  const payload = await postMeta(
    "/chat/completions",
    {
      model,
      stream: true,
      reasoning_effort: "low",
      max_completion_tokens: 8192,
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
    timeoutMs,
  );
  const text = chatOutputText(payload);
  const parsed = readModelDraft(text);
  if (!parsed) throw new Error("no_json");
  const finalized = finalizeTriage({
    locale: options.locale,
    observations: parsed.observations,
    actions: parsed.actions,
    likelyCauses: parsed.likelyCauses,
    mitigations: parsed.mitigations,
    confidence: parsed.confidence,
    confidenceScore: parsed.confidenceScore,
    counts: options.counts,
    plantName: options.farmerPlant,
    context: options.context,
    symptom: parsed.symptom,
    suspect: parsed.suspect,
  });
  return {
    ...finalized,
    model,
    triageSource: "muse",
    detectedPlant: namedPlant(options.locale, parsed.detectedPlant, options.farmerPlant, options.primaryCrop),
    contextAsk: cleanContextAsk(parsed.contextAsk),
    chemicals: chemicalsFromReading({
      locale: options.locale,
      issue: finalized.issue,
      sprayEvidence: finalized.sprayEvidence,
      sprayIndicated: parsed.sprayIndicated,
      diseaseIndicated: parsed.diseaseIndicated,
      suspect: parsed.suspect,
      chemicals: parsed.chemicals,
      fallbackSuspect: finalized.likelyCauses[0] ?? "",
    }),
  };
}

export function localFallback(
  locale: Locale,
  counts: ConceptCounts,
  context: FarmerContext,
  primaryCrop: CropId | null,
  farmerPlant: string,
): TriageDraft {
  const text = copy[locale];
  const issue = inferIssue(contextText(context));
  const finalized = finalizeTriage({
    locale,
    observations: [],
    actions: text.fallbackActions,
    confidence: issue ? "medium" : "low",
    confidenceScore: issue ? 0.56 : 0.33,
    counts,
    plantName: farmerPlant,
    context,
  });
  return {
    ...finalized,
    model: null,
    triageSource: "local-fallback",
    detectedPlant: namedPlant(locale, null, farmerPlant, primaryCrop),
    contextAsk: contextIsEmpty(context) ? text.contextAskDefault : null,
    chemicals: chemicalsFromReading({
      locale,
      issue: finalized.issue,
      sprayEvidence: finalized.sprayEvidence,
      sprayIndicated: null,
      diseaseIndicated: null,
      suspect: "",
      chemicals: [],
      fallbackSuspect: finalized.likelyCauses[0] ?? "",
    }),
  };
}

function namedPlant(locale: Locale, modelName: unknown, farmerPlant: string, primaryCrop: CropId | null): string {
  const fromModel = cleanPlantName(modelName);
  if (fromModel) {
    const folded = displayPlantName(locale, fromModel);
    return folded || fromModel;
  }
  return displayPlantName(locale, farmerPlant) || parseFarmerPlant(farmerPlant) || fallbackPlantName(locale, primaryCrop);
}

function parseFlag(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "yes") return true;
  if (value === false || value === "false" || value === "no") return false;
  return null;
}

function chemicalsFromReading(options: {
  locale: Locale;
  issue: IssueId | null;
  sprayEvidence: string;
  sprayIndicated: unknown;
  diseaseIndicated: unknown;
  suspect: unknown;
  chemicals: unknown;
  fallbackSuspect: string;
}): ChemicalAdvice | null {
  const sprayFlag = parseFlag(options.sprayIndicated);
  if (sprayFlag === false) return null;
  const diseaseFlag = parseFlag(options.diseaseIndicated);
  const usual = sprayIsUsual(options.issue, options.sprayEvidence, sprayFlag);
  const suspect = options.suspect || options.fallbackSuspect;
  const fromModel = adviseChemicals({
    locale: options.locale,
    diseaseIndicated: true,
    suspect,
    chemicals: options.chemicals,
  });
  const hasModel = (fromModel?.products.length ?? 0) > 0;
  const acceptModel = hasModel && (sprayFlag === true || diseaseFlag !== false || usual);
  if (acceptModel) return fromModel;
  if (!usual || !options.issue) return null;
  const actives = issueActives(options.issue);
  if (actives.length === 0) return null;
  return adviseChemicals({
    locale: options.locale,
    diseaseIndicated: true,
    suspect: options.fallbackSuspect || suspect,
    chemicals: actives,
  });
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
    "If SAM returned no marks, still triage from the photo, the plant name, and the farmer's notes. Empty marks are not a reason to skip observations, the three checks, or chemicals when a problem is visible or described.",
    "Do not say that segmentation failed, that marks may be missing, or that no plants were marked.",
    "When the photo or the notes show a concrete symptom (curl, deformity, spots, insects, wilt, or yellowing), fill likelyCauses with 2 short hypotheses and mitigations with 2 or 3 practical steps.",
    "Looped, hooked, or corkscrew fruit or leaves are a deformity even when SAM returned nothing.",
    "Mitigations are cultural practice, monitoring, sanitation, or irrigation. They are not spray rates, and they are not the same sentences as actions.",
    "Return exactly three next checks in actions. Each check must be about the symptom you saw on the named plant.",
    "Do not use a generic trio (feel the soil, lift the worst leaves, photograph again in two days) when a concrete symptom is visible. Those three are only for a bed with no symptom.",
    "Do not put a spray rate or a product dose in actions, likelyCauses, or mitigations.",
    "Set sprayIndicated to true only when a labeled spray is the usual next step, such as spreading spots or insects already seen on the plant.",
    "Set sprayIndicated to false when the next step is to look, change water, or remove damaged growth. Curl or twisted fruit alone is not a spray.",
    "If sprayIndicated is true, set diseaseIndicated to true, name the problem briefly in suspect, and recommend one or two chemicals.",
    "Each chemical has activeIngredient (the common name, such as mancozeb), productClass (such as fungicide or insecticide), and useNote (typical use, with no numeric rate).",
    "Do not invent an exact spray rate, mixing rate, millilitres, grams, or litres per area or per tank. Say the rate must follow the product label.",
    "This chemical advice is for the farmer to verify with a local agroveterinary officer before buying or spraying.",
    "If sprayIndicated is false, set diseaseIndicated to false, suspect to an empty string, and chemicals to an empty array. Still return likelyCauses and mitigations when a symptom is visible.",
    "If the farmer mentions products already used, treat that as history. Do not turn that history into a new numeric dose.",
    "If one extra fact would make the checks more accurate, put one short question in contextAsk. Otherwise contextAsk is an empty string.",
    "Do not ask the farmer to choose onion, beetroot, or chili from a list. They already named the plant.",
    `Reply in ${language}.`,
    "Return one JSON object only, with this shape:",
    '{"detectedPlant":"plant name","symptom":"spots","observations":["short field note","short field note"],"likelyCauses":["hypothesis","hypothesis"],"mitigations":["cultural step","cultural step"],"actions":["symptom check","symptom check","symptom check"],"confidence":"low|medium|high","confidenceScore":0.5,"contextAsk":"","sprayIndicated":true,"diseaseIndicated":true,"suspect":"leaf spot","chemicals":[{"activeIngredient":"mancozeb","productClass":"fungicide","useNote":"Protectant for leaf spots. The rate must follow the product label."}]}',
    "symptom is curl, deformity, spots, wilt, yellowing, insects, or an empty string.",
    "observations has 2 or 3 items. likelyCauses and mitigations are empty only when no symptom is visible. actions has exactly 3 items. confidenceScore is from 0 to 1. chemicals has at most 2 items.",
  ].join(" ");
}

export function userPrompt(locale: Locale, summary: string, context: FarmerContext, farmerPlant: string): string {
  const language = normalizeLocale(locale) === "sw" ? "Swahili" : "English";
  return [
    "This is a phone photo of one farm bed.",
    `The farmer names the plant: ${farmerPlant}. Use that name.`,
    "SAM marks below are only what was found in this photo. A crop that is not listed was not marked.",
    "If no marks were returned, still read the photo, the plant name, and the notes. Empty marks are not a reason to skip likely causes, mitigation, or the three checks.",
    `In frame: ${summary}`,
    contextPromptBlock(context),
    "Use the photo, the plant name, those marks, and any context.",
    "observations must describe only the plants in this photo: symptoms, vigor, spacing, damage, soil, or their count. Do not name a crop that is not in the photo.",
    "If a symptom is visible, likelyCauses and mitigations are required even when SAM returned nothing. Looped, hooked, or corkscrew growth is a symptom.",
    "Make the three actions specific to that symptom. Do not answer with a generic soil, leaf-removal, and re-photo list.",
    "Set sprayIndicated and name chemicals by active ingredient only when a spray is the usual next step. Do not give a numeric spray rate.",
    `Write the JSON in ${language}.`,
  ].join("\n");
}

export function chatOutputText(payload: { kind: "json"; value: unknown } | { kind: "sse"; events: Record<string, unknown>[] }): string {
  if (payload.kind === "json") return contentFromJson(payload.value);
  let text = "";
  let reasoning = "";
  for (const event of payload.events) {
    const choices = event.choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") continue;
    const choice = choices[0] as {
      delta?: { content?: unknown; reasoning_content?: unknown };
      message?: { content?: unknown; reasoning_content?: unknown };
    };
    const delta = textOfContent(choice.delta?.content);
    if (delta) text += delta;
    const message = textOfContent(choice.message?.content);
    if (message.length >= text.length) text = message;
    reasoning += textOfContent(choice.delta?.reasoning_content);
    const messageReasoning = textOfContent(choice.message?.reasoning_content);
    if (messageReasoning.length >= reasoning.length) reasoning = messageReasoning;
  }
  if (text.trim()) return text;
  return reasoning.includes("{") ? reasoning : "";
}

function contentFromJson(value: unknown): string {
  if (!value || typeof value !== "object" || !("choices" in value)) return "";
  const choices = value.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = "message" in choices[0] ? choices[0].message : undefined;
  if (!message || typeof message !== "object") return "";
  const record = message as { content?: unknown; reasoning_content?: unknown };
  const content = textOfContent(record.content);
  if (content.trim()) return content;
  const reasoning = textOfContent(record.reasoning_content);
  return reasoning.includes("{") ? reasoning : "";
}

function textOfContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
      return "";
    })
    .join("");
}

const DRAFT_KEYS = ["observations", "actions", "likelyCauses", "mitigations"] as const;

/** JSON when Muse finished it, a closed array when the rest was cut off, or symptom prose. */
export function readModelDraft(text: string): ModelDraft | null {
  const fromJson = draftFromJson(text);
  if (fromJson && draftHasReading(fromJson)) return fromJson;
  const partial = draftFromPartial(text);
  if (partial && draftHasReading(partial)) return partial;
  const sentences = proseSentences(text);
  if (!inferIssue(sentences.join(" "))) return null;
  return emptyDraft({ observations: sentences.slice(0, 3) });
}

function draftHasReading(draft: ModelDraft): boolean {
  return [draft.observations, draft.actions, draft.likelyCauses, draft.mitigations, draft.suspect, draft.symptom].some(
    (value) => (Array.isArray(value) && value.length > 0) || (typeof value === "string" && value.trim().length > 0),
  );
}

function draftFromJson(text: string): ModelDraft | null {
  const fenced = text.replace(/```(?:json)?/gi, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(fenced.slice(start, end + 1)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return draftFromRecord(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

function draftFromPartial(text: string): ModelDraft | null {
  const found: Partial<Record<(typeof DRAFT_KEYS)[number], string[]>> = {};
  for (const key of DRAFT_KEYS) {
    const values = pullStringArray(text, key);
    if (values && values.length > 0) found[key] = values;
  }
  if (Object.keys(found).length === 0) return null;
  return emptyDraft(found);
}

function pullStringArray(source: string, key: string): string[] | null {
  const match = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`).exec(source);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(`[${match[1]}]`) as unknown;
    if (!Array.isArray(parsed)) return null;
    const values = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return values.length > 0 ? values : null;
  } catch {
    return null;
  }
}

function proseSentences(text: string): string[] {
  const stripped = text.replace(/```(?:json)?/gi, " ").replace(/\s+/g, " ").trim();
  if (!stripped || stripped.startsWith("{")) return [];
  return stripped
    .split(/(?<=[.!?)])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24 && !sentence.startsWith("{"));
}

function draftFromRecord(record: Record<string, unknown>): ModelDraft {
  return {
    observations: record.observations,
    actions: record.actions,
    confidence: record.confidence,
    confidenceScore: record.confidenceScore,
    detectedPlant: record.detectedPlant,
    contextAsk: record.contextAsk,
    diseaseIndicated: record.diseaseIndicated,
    sprayIndicated: record.sprayIndicated,
    suspect: record.suspect,
    chemicals: record.chemicals,
    symptom: record.symptom,
    likelyCauses: record.likelyCauses,
    mitigations: record.mitigations,
  };
}

function emptyDraft(partial: Partial<ModelDraft>): ModelDraft {
  return {
    observations: partial.observations ?? [],
    actions: partial.actions ?? [],
    confidence: partial.confidence ?? "low",
    confidenceScore: partial.confidenceScore ?? 0.45,
    detectedPlant: partial.detectedPlant ?? "",
    contextAsk: partial.contextAsk ?? "",
    diseaseIndicated: partial.diseaseIndicated ?? null,
    sprayIndicated: partial.sprayIndicated ?? null,
    suspect: partial.suspect ?? "",
    chemicals: partial.chemicals ?? [],
    symptom: partial.symptom ?? "",
    likelyCauses: partial.likelyCauses ?? [],
    mitigations: partial.mitigations ?? [],
  };
}
