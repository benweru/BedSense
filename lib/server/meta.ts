export const META_BASE = "https://api.meta.ai/v1";
export const SAM_MODEL = "sam-3.1" as const;
export const MUSE_MODELS = ["muse-spark-1.3-contributor", "muse-spark-1.3"] as const;
/** Used only after the preferred ids return model_not_found and the catalog does not name a chat model. */
export const MUSE_RESERVE_MODELS = ["muse-spark-1.2-contributor", "muse-spark-1.2", "muse-spark-1.1", "muse-wonder-1.0"] as const;
export type MuseModel = (typeof MUSE_MODELS)[number];

const CHAT_MUSE = /^muse-(?:spark|wonder)-\d/;

/** Chat models only. SAM, image, and voice ids stay off the triage call. */
export function chatMuseModels(ids: readonly string[]): string[] {
  const sorted = ids.filter((id) => CHAT_MUSE.test(id)).sort((a, b) => museRank(a) - museRank(b));
  const unique: string[] = [];
  for (const id of sorted) {
    if (!unique.includes(id)) unique.push(id);
  }
  return unique;
}

function museRank(id: string): number {
  if (id.startsWith("muse-spark") && id.includes("contributor")) return 0;
  if (id.startsWith("muse-spark")) return 1;
  if (id.startsWith("muse-wonder")) return 2;
  return 9;
}

export function isMockMode(): boolean {
  const value = process.env.MOCK_META?.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return !readApiKey();
}

const COMPLETE_KEY_MIN_LENGTH = 40;
const KEY_PARTS = 6;

// A host can truncate one long MODEL_API_KEY. Forty characters counts as
// complete; otherwise join MODEL_API_KEY_0 through MODEL_API_KEY_5.
export function readApiKey(): string | null {
  const direct = process.env.MODEL_API_KEY?.trim() ?? "";
  if (direct.length >= COMPLETE_KEY_MIN_LENGTH) return direct;
  return readChunkedApiKey();
}

function readChunkedApiKey(): string | null {
  let joined = "";
  for (let index = 0; index < KEY_PARTS; index += 1) {
    joined += process.env[`MODEL_API_KEY_${index}`]?.trim() ?? "";
  }
  return joined ? joined : null;
}

export type MetaPayload =
  | { kind: "json"; value: unknown }
  | { kind: "sse"; events: Record<string, unknown>[] };

/** A Meta call failed before a usable body was parsed. `status` is 0 for a timeout or a dropped connection. */
export class MetaHttpError extends Error {
  readonly status: number;
  readonly reason: string;

  constructor(status: number, reason: string) {
    super(reason);
    this.name = "MetaHttpError";
    this.status = status;
    this.reason = reason;
  }
}

export async function postMeta(
  path: string,
  body: unknown,
  apiKey: string,
  timeoutMs = 25_000,
): Promise<MetaPayload> {
  let response: Response;
  try {
    response = await fetch(`${META_BASE}${path}`, {
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

/** Models this key can call. A 404 on a hardcoded id is not the whole catalog. */
export async function listMetaModels(apiKey: string, timeoutMs = 8_000): Promise<string[]> {
  let response: Response;
  try {
    response = await fetch(`${META_BASE}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new MetaHttpError(0, timedOut ? "timeout" : "network");
  }
  const raw = await response.text();
  if (!response.ok) throw new MetaHttpError(response.status, errorReason(response.status, raw));
  try {
    const parsed = JSON.parse(raw) as { data?: unknown };
    if (!Array.isArray(parsed.data)) return [];
    return parsed.data.flatMap((item) => {
      if (item && typeof item === "object" && "id" in item && typeof (item as { id: unknown }).id === "string") {
        return [(item as { id: string }).id];
      }
      return [];
    });
  } catch {
    throw new MetaHttpError(response.status, "bad_json");
  }
}

export function parseSse(raw: string): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  // HTTP streams use CRLF. Splitting only on LF glues every data line into one invalid JSON value.
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (const block of normalized.split(/\n\n/)) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === "object") events.push(parsed as Record<string, unknown>);
    } catch {
      // Ignore keep-alives and partial trailing frames.
    }
  }
  return events;
}

function errorReason(status: number, raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: unknown; type?: unknown } };
    const code = parsed.error?.code ?? parsed.error?.type;
    if (typeof code === "string" && /^[a-z0-9_.-]{1,64}$/i.test(code)) return code;
  } catch {
    // The status is enough when the body is not the error envelope.
  }
  return `http_${status}`;
}

export function textFromPayload(payload: MetaPayload, pick: (events: Record<string, unknown>[], json: unknown) => string): string {
  if (payload.kind === "json") return pick([], payload.value);
  return pick(payload.events, null);
}
