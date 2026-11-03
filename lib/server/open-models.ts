import {
  errorReason,
  MetaHttpError,
  type MetaPayload,
  parseSse,
} from "@/lib/server/meta";
import { chatOutputText } from "@/lib/server/muse";

/**
 * Meta open-weights chat through a partner endpoint (Baseten by default).
 * Same shape as the Model API path: Bearer auth, OpenAI chat completions,
 * AbortSignal timeouts, and MetaHttpError reasons. Nothing here reads a key
 * at import time; unconfigured callers get a typed missing_key instead.
 */
export const OPEN_MODELS_BASE_DEFAULT = "https://inference.baseten.co/v1";
export const OPEN_MODELS_MODEL_DEFAULT = "meta-models/muse-spark-open-1026";

export class OpenModelsError extends Error {
  readonly code: "missing_key" | "unavailable" | "rate_limited" | "upstream";

  constructor(code: OpenModelsError["code"]) {
    super(code);
    this.name = "OpenModelsError";
    this.code = code;
  }
}

export function openModelsBaseUrl(): string {
  const override = process.env.OPEN_MODELS_BASE_URL?.trim().replace(/\/+$/, "");
  return override || OPEN_MODELS_BASE_DEFAULT;
}

export function openModelsModel(): string {
  return process.env.OPEN_MODELS_MODEL?.trim() || OPEN_MODELS_MODEL_DEFAULT;
}

export function readOpenModelsKey(): string | null {
  const key = process.env.OPEN_MODELS_API_KEY?.trim() ?? "";
  return key ? key : null;
}

export function isOpenModelsConfigured(): boolean {
  return readOpenModelsKey() !== null;
}

export type OpenModelsMessage = {
  role: "developer" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

/** One chat completion from the open-weights model. Throws OpenModelsError on every failure. */
export async function completeOpenModels(
  messages: readonly OpenModelsMessage[],
  options?: { maxTokens?: number; timeoutMs?: number },
): Promise<string> {
  const apiKey = readOpenModelsKey();
  if (!apiKey) throw new OpenModelsError("missing_key");
  try {
    const payload = await postOpenModels(
      "/chat/completions",
      {
        model: openModelsModel(),
        stream: true,
        max_completion_tokens: options?.maxTokens ?? 2400,
        messages,
      },
      apiKey,
      options?.timeoutMs ?? 25_000,
    );
    return chatOutputText(payload);
  } catch (error) {
    throw openModelsFailure(error);
  }
}

/** Raw POST to the partner endpoint. Mirrors postMeta: same timeouts, same MetaHttpError reasons. */
export async function postOpenModels(
  path: string,
  body: unknown,
  apiKey: string,
  timeoutMs = 25_000,
): Promise<MetaPayload> {
  let response: Response;
  try {
    response = await fetch(`${openModelsBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new MetaHttpError(0, timedOut ? "timeout" : "network");
  }

  const raw = await response.text();
  if (!response.ok) {
    throw new MetaHttpError(response.status, errorReason(response.status, raw));
  }

  const contentType = response.headers.get("content-type") ?? "";
  const trimmed = raw.trim();
  if (contentType.includes("text/event-stream") || trimmed.startsWith("data:")) {
    return { kind: "sse", events: parseSse(raw) };
  }
  if (contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { kind: "json", value: JSON.parse(trimmed) as unknown };
    } catch {
      if (raw.includes("data:")) return { kind: "sse", events: parseSse(raw) };
      throw new MetaHttpError(response.status, "bad_json");
    }
  }
  return { kind: "sse", events: parseSse(raw) };
}

function openModelsFailure(error: unknown): OpenModelsError {
  if (error instanceof OpenModelsError) return error;
  if (error instanceof MetaHttpError) {
    if (error.status === 429) return new OpenModelsError("rate_limited");
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.reason === "model_not_found") {
      return new OpenModelsError("unavailable");
    }
  }
  return new OpenModelsError("upstream");
}
