import { copy, normalizeLocale } from "@/lib/copy";
import { isMockMode, listMetaModels, MetaHttpError, postMeta, readApiKey, triageModelIds } from "@/lib/server/meta";
import { chatOutputText } from "@/lib/server/muse";
import { containsDosage } from "@/lib/triage";
import { repairSentence } from "@/lib/translate";
import type { AskTurn, Locale } from "@/lib/types";

export class AskError extends Error {
  readonly code: "bad_request" | "missing_key" | "muse_unavailable" | "upstream";

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

export async function answerFollowUp(input: {
  locale: unknown;
  question: unknown;
  grounding: unknown;
  thread: unknown;
}): Promise<{ answer: string; locale: Locale; demo: boolean }> {
  const locale = normalizeLocale(input.locale);
  const question = cleanText(input.question, QUESTION_LIMIT);
  if (!question) throw new AskError("bad_request");
  const grounding = readGrounding(input.grounding);
  if (!grounding) throw new AskError("bad_request");
  const thread = readThread(input.thread);

  if (isMockMode()) return { answer: localAnswer(locale, grounding), locale, demo: true };
  const apiKey = readApiKey();
  if (!apiKey) throw new AskError("missing_key");

  let models: string[];
  try {
    models = triageModelIds(await listMetaModels(apiKey, 8_000));
  } catch (error) {
    throw askFailure(error);
  }
  if (models.length === 0) throw new AskError("muse_unavailable");

  let sawLiveModel = false;
  for (const model of models.slice(0, 3)) {
    try {
      const answer = await askModel(model, apiKey, locale, grounding, thread, question);
      // An empty completion is unanswered, not a failure: read the next model, like triage does.
      if (answer) return { answer, locale, demo: false };
      sawLiveModel = true;
    } catch (error) {
      if (error instanceof MetaHttpError && (error.status === 404 || error.reason === "model_not_found")) continue;
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
): Promise<string> {
  const payload = await postMeta(
    "/chat/completions",
    {
      model,
      stream: true,
      // Reasoning tokens come out of this budget; the grounded prompt needs triage-sized headroom or the completion is empty.
      max_completion_tokens: 2400,
      messages: [
        { role: "developer", content: askPrompt(locale, grounding) },
        ...thread.map((turn) => ({ role: turn.role === "farmer" ? "user" : "assistant", content: turn.text })),
        { role: "user", content: question },
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

function askPrompt(locale: Locale, grounding: AskGrounding): string {
  const lines = [
    "You are BedSense, answering a farmer's follow-up question about one plant check that is already finished.",
    "Answer only about this check and this plant. You cannot see any photo and you must not ask for or promise a new scan.",
    "Do not give a new diagnosis beyond the reading below. If the question needs a new photo or a fact the reading does not have, say what is missing and point to the three next checks or a new check.",
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
function localAnswer(locale: Locale, grounding: AskGrounding): string {
  const text = copy[locale];
  if (grounding.needsInfo) return text.followUpNeedsInfo;
  const step = grounding.mitigations[0] ?? grounding.actions[0] ?? "";
  if (locale === "sw") {
    return step
      ? `Kutoka ukaguzi huu: ${step} Kwa zaidi, mwonyeshe agrovet picha na ukaguzi huu.`
      : "Ukaguzi huu haukutaja hatua. Mwonyeshe agrovet picha na ukaguzi huu.";
  }
  return step
    ? `From this check: ${step} For more, show an agrovet the photo and this check.`
    : "This check named no step. Show an agrovet the photo and this check.";
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
    turns.push({ role: turn.role === "farmer" ? "farmer" : "bedsense", text });
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
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.reason === "model_not_found") {
      return new AskError("muse_unavailable");
    }
  }
  return new AskError("upstream");
}
