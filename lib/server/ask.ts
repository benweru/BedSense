import { copy, normalizeLocale } from "@/lib/copy";
import { decodeDataUrl } from "@/lib/image";
import { catalogChatModels, isMockMode, listMetaModels, MetaHttpError, MUSE_MODELS, postMeta, readApiKey, triageModelIds } from "@/lib/server/meta";
import { chatOutputText } from "@/lib/server/muse";
import { containsDosage } from "@/lib/triage";
import { repairSentence } from "@/lib/translate";
import type { AskTurn, Locale } from "@/lib/types";

export class AskError extends Error {
  readonly code:
    | "bad_request"
    | "unsupported_image"
    | "image_too_large"
    | "missing_key"
    | "muse_unavailable"
    | "rate_limited"
    | "upstream";

  constructor(code: AskError["code"]) {
    super(code);
    this.name = "AskError";
    this.code = code;
  }
}

export const QUESTION_LIMIT = 500;
export const THREAD_LIMIT = 6;
const TURN_LIMIT = 600;
const ANSWER_LIMIT = 900;
/** The tool loop runs at most one photo round: ask for a photo, answer from it, then stop. */
export const MAX_PHOTO_ROUNDS = 1;
/** Demo-mode words that mark a question as needing fresh visual evidence. The live model decides for itself. */
const STALE_HINTS = [
  "spread",
  "worse",
  "worsening",
  "changed",
  "still there",
  "new spots",
  "growing",
  "imeenea",
  "enea",
  "kuzidi",
  "zimeongezeka",
  "bado zipo",
  "mpya",
];
const MOCK_PHOTO_REASON = {
  en: "a close photo of the worst leaf today",
  sw: "picha ya karibu ya jani lililoathirika zaidi leo",
} as const;

/** The slice of a check the Q&A is allowed to talk about. Built client-side from the rendered result. */
export type AskGrounding = {
  plant: string;
  observations: string[];
  likelyCauses: string[];
  mitigations: string[];
  actions: string[];
  suspect: string | null;
  actives: string[];
  needsInfo: boolean;
  followUp: string | null;
};

/** A finished answer, or a tool reply asking the farmer for one fresh photo. Never both. */
export type AskAnswer = {
  answer: string;
  locale: Locale;
  demo: boolean;
  photoRequested: boolean;
  reason: string | null;
};

export async function answerFollowUp(input: {
  locale: unknown;
  question: unknown;
  grounding: unknown;
  thread: unknown;
  photo?: unknown;
}): Promise<AskAnswer> {
  const locale = normalizeLocale(input.locale);
  const question = cleanText(input.question, QUESTION_LIMIT);
  if (!question) throw new AskError("bad_request");
  const grounding = readGrounding(input.grounding);
  if (!grounding) throw new AskError("bad_request");
  const thread = readThread(input.thread);
  const photo = readPhoto(input.photo);

  if (isMockMode()) {
    if (photo) return { answer: localAnswer(locale, grounding, true), locale, demo: true, photoRequested: false, reason: null };
    if (looksStale(question)) {
      const reason = MOCK_PHOTO_REASON[locale];
      return { answer: copy[locale].askPhotoAsk(reason), locale, demo: true, photoRequested: true, reason };
    }
    return { answer: localAnswer(locale, grounding, false), locale, demo: true, photoRequested: false, reason: null };
  }
  const apiKey = readApiKey();
  if (!apiKey) throw new AskError("missing_key");

  let models: string[];
  try {
    let listed = await listMetaModels(apiKey, 8_000);
    // Same rule as triage: a chat-less catalog read is retried once, then the known ids are called.
    if (triageModelIds(listed).length === 0) listed = await listMetaModels(apiKey, 8_000);
    models = catalogChatModels(listed);
  } catch (error) {
    // A rejected catalog read (401/403) is not proof the chat call will fail: try the known ids.
    if (error instanceof MetaHttpError && (error.status === 401 || error.status === 403)) {
      models = [...MUSE_MODELS];
    } else {
      throw askFailure(error);
    }
  }

  let sawLiveModel = false;
  for (const model of models.slice(0, 3)) {
    try {
      const answer = await askModel(model, apiKey, locale, grounding, thread, question, photo);
      // An empty completion is unanswered, not a failure: read the next model, like triage does.
      if (!answer) {
        sawLiveModel = true;
        continue;
      }
      const requested = readPhotoRequest(answer);
      if (!photo && requested) {
        const asked = copy[locale].askPhotoAsk(requested);
        // The reason is model text, so it passes through the same dosage guard as any answer.
        if (containsDosage(asked)) return { answer: copy[locale].askUnavailable, locale, demo: false, photoRequested: false, reason: null };
        return { answer: asked, locale, demo: false, photoRequested: true, reason: requested };
      }
      if (photo && requested) {
        // MAX_PHOTO_ROUNDS is spent: a second request is answered as unavailable, never looped.
        return { answer: copy[locale].askUnavailable, locale, demo: false, photoRequested: false, reason: null };
      }
      return { answer, locale, demo: false, photoRequested: false, reason: null };
    } catch (error) {
      // A rate limit will not clear by burning the next model; report it so the farmer can wait a few seconds.
      if (error instanceof MetaHttpError && error.status === 429) throw new AskError("rate_limited");
      if (
        error instanceof MetaHttpError &&
        (error.status === 404 || error.status === 401 || error.status === 403 || error.reason === "model_not_found")
      ) {
        continue;
      }
      sawLiveModel = true;
    }
  }
  if (!sawLiveModel) throw new AskError("muse_unavailable");
  throw new AskError("upstream");
}

async function askModel(
  model: string,
  apiKey: string,
  locale: Locale,
  grounding: AskGrounding,
  thread: AskTurn[],
  question: string,
  photo: string | null,
): Promise<string> {
  const payload = await postMeta(
    "/chat/completions",
    {
      model,
      stream: true,
      // Reasoning tokens come out of this budget; the grounded prompt needs triage-sized headroom or the completion is empty.
      max_completion_tokens: 2400,
      messages: [
        { role: "developer", content: askPrompt(locale, grounding, photo !== null) },
        ...thread.map((turn) => ({ role: turn.role === "farmer" ? "user" : "assistant", content: turn.text })),
        photo
          ? {
              role: "user",
              content: [
                { type: "text", text: question },
                { type: "image_url", image_url: { url: photo } },
              ],
            }
          : { role: "user", content: question },
      ],
    },
    apiKey,
    25_000,
  );
  const raw = chatOutputText(payload).replace(/\s+/g, " ").trim().slice(0, ANSWER_LIMIT);
  if (!raw) return "";
  // A rate in an answer is dropped whole, never shown. The farmer still gets the label rule from the check.
  if (containsDosage(raw)) return copy[locale].askUnavailable;
  return repairSentence(locale, raw) || raw;
}

function askPrompt(locale: Locale, grounding: AskGrounding, hasPhoto: boolean): string {
  const lines = [
    "You are BedSense, answering a farmer's follow-up question about one plant check that is already finished.",
    hasPhoto
      ? "Answer from the new photo and the reading below. Do not request another photo; answer with what you can see."
      : "You cannot see any photo. If the question needs fresh visual evidence to answer well, reply with exactly {\"request_photo\": \"<what to photograph, one short phrase>\"} and nothing else. Questions about spreading, worsening, or what the plant looks like now need a new photo.",
    "Answer only about this check and this plant. Do not give a new diagnosis beyond the reading below. If the question needs a fact the reading does not have, say what is missing and point to the three next checks or a new check.",
    "Never state a numeric spray or fertilizer rate, dilution, or amount per litre. Rates follow the product label.",
    "Keep the answer short, plain, and practical: at most four short sentences. No lists unless the farmer asks for steps.",
    locale === "sw" ? "Answer in Kiswahili." : "Answer in English.",
    "",
    `Plant: ${grounding.plant || "unknown"}`,
    `What stood out: ${grounding.observations.join(" ") || "not recorded"}`,
    `Likely causes: ${grounding.likelyCauses.join(" ") || "none named"}`,
    `Mitigation steps already given: ${grounding.mitigations.join(" ") || "none"}`,
    `Three next checks: ${grounding.actions.join(" | ")}`,
    grounding.suspect ? `Suspected problem: ${grounding.suspect}. Products named: ${grounding.actives.join(", ") || "none"}.` : "No chemical was named in this check.",
    grounding.needsInfo
      ? "This check could not separate the likely causes, so no chemical was named. Steer answers toward the missing evidence below instead of inventing a treatment."
      : "",
    grounding.followUp ? `Follow-up the farmer was asked: ${grounding.followUp}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Demo/no-key answer: restate the part of the reading the farmer can act on. Never invents advice. */
function localAnswer(locale: Locale, grounding: AskGrounding, fromPhoto: boolean): string {
  const text = copy[locale];
  if (grounding.needsInfo && !fromPhoto) return text.followUpNeedsInfo;
  const step = grounding.mitigations[0] ?? grounding.actions[0] ?? "";
  if (locale === "sw") {
    const source = fromPhoto ? "Kutoka picha mpya na ukaguzi huu" : "Kutoka ukaguzi huu";
    return step
      ? `${source}: ${step} Kwa zaidi, mwonyeshe agrovet picha na ukaguzi huu.`
      : "Ukaguzi huu haukutaja hatua. Mwonyeshe agrovet picha na ukaguzi huu.";
  }
  const source = fromPhoto ? "From the new photo and this check" : "From this check";
  return step
    ? `${source}: ${step} For more, show an agrovet the photo and this check.`
    : "This check named no step. Show an agrovet the photo and this check.";
}

/** True when a demo-mode question reads like it needs fresh visual evidence. */
function looksStale(question: string): boolean {
  const lowered = question.toLowerCase();
  return STALE_HINTS.some((hint) => lowered.includes(hint));
}

/** The tool reply is valid only as the whole completion: exactly {"request_photo": "<reason>"}. */
function readPhotoRequest(answer: string): string | null {
  const trimmed = answer.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object") return null;
    const reason = cleanText((parsed as Record<string, unknown>).request_photo, 160);
    return reason || null;
  } catch {
    return null;
  }
}

/** The in-flight photo only: validated like a check photo, never stored in the thread. */
function readPhoto(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new AskError("unsupported_image");
  try {
    decodeDataUrl(value);
  } catch (error) {
    throw new AskError(error instanceof Error && error.message === "image_too_large" ? "image_too_large" : "unsupported_image");
  }
  return value;
}

function readGrounding(value: unknown): AskGrounding | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const actions = cleanList(raw.actions, 3);
  if (actions.length === 0) return null;
  return {
    plant: cleanText(raw.plant, 120),
    observations: cleanList(raw.observations, 4),
    likelyCauses: cleanList(raw.likelyCauses, 4),
    mitigations: cleanList(raw.mitigations, 5),
    actions,
    suspect: cleanText(raw.suspect, 160) || null,
    actives: cleanList(raw.actives, 4),
    needsInfo: raw.needsInfo === true,
    followUp: cleanText(raw.followUp, TURN_LIMIT) || null,
  };
}

function readThread(value: unknown): AskTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: AskTurn[] = [];
  for (const item of value.slice(-THREAD_LIMIT)) {
    if (!item || typeof item !== "object") continue;
    const turn = item as Record<string, unknown>;
    const text = cleanText(turn.text, TURN_LIMIT);
    if (!text) continue;
    turns.push({ role: turn.role === "farmer" ? "farmer" : turn.role === "system" ? "system" : "bedsense", text });
  }
  return turns;
}

function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, TURN_LIMIT)).filter(Boolean).slice(0, max);
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function askFailure(error: unknown): AskError {
  if (error instanceof AskError) return error;
  if (error instanceof MetaHttpError) {
    if (error.status === 429) return new AskError("rate_limited");
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.reason === "model_not_found") {
      return new AskError("muse_unavailable");
    }
  }
  return new AskError("upstream");
}
