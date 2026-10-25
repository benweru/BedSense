import { normalizeLocale } from "@/lib/copy";
import { isMockMode, META_BASE, MetaHttpError, readApiKey } from "@/lib/server/meta";
import { inspectWav, languageBiasFor, VOICE_KEYWORDS, VOICE_MODEL, wavBlob } from "@/lib/voice";
import type { Locale } from "@/lib/types";

export class VoiceError extends Error {
  readonly code: "bad_request" | "unsupported_audio" | "audio_too_large" | "audio_too_long" | "missing_key" | "voice_unavailable" | "upstream";

  constructor(code: VoiceError["code"]) {
    super(code);
    this.name = "VoiceError";
    this.code = code;
  }
}

const MOCK_TRANSCRIPT: Record<Locale, string> = {
  en: "Two-month seedlings. I watered yesterday.",
  sw: "Miche ya miezi miwili. Nilimwagilia jana.",
};

/** One-shot Muse Voice upload. The transcript is written into a context field the check already sends. */
export async function transcribeContextAudio(bytes: Uint8Array, localeInput: unknown): Promise<{ transcript: string; locale: Locale }> {
  const locale = normalizeLocale(localeInput);
  const wav = inspectWav(bytes);
  if (!wav.ok) throw new VoiceError(wav.reason);
  if (isMockMode()) return { transcript: MOCK_TRANSCRIPT[locale], locale };

  const apiKey = readApiKey();
  if (!apiKey) throw new VoiceError("missing_key");

  const bias = languageBiasFor(locale);
  try {
    return { transcript: await postTranscribe(bytes, bias, apiKey), locale };
  } catch (error) {
    if (locale === "sw" && error instanceof MetaHttpError && error.status === 400) {
      try {
        return { transcript: await postTranscribe(bytes, ["English"], apiKey), locale };
      } catch (retryError) {
        throw voiceFailure(retryError);
      }
    }
    throw voiceFailure(error);
  }
}

async function postTranscribe(bytes: Uint8Array, languageBias: readonly string[], apiKey: string): Promise<string> {
  const form = new FormData();
  const request = {
    model: VOICE_MODEL,
    audioEncoding: "WAV",
    mode: "PUSH_TO_TALK",
    languageBias,
    keywords: [...VOICE_KEYWORDS],
  };
  form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
  form.append("audio", wavBlob(bytes), "context.wav");

  let response: Response;
  try {
    response = await fetch(`${META_BASE}/asr/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: form,
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new MetaHttpError(0, timedOut ? "timeout" : "network");
  }

  const raw = await response.text();
  if (!response.ok) throw new MetaHttpError(response.status, errorReason(response.status, raw));
  try {
    const parsed = JSON.parse(raw) as { transcript?: unknown };
    return typeof parsed.transcript === "string" ? parsed.transcript.replace(/\s+/g, " ").trim() : "";
  } catch {
    throw new MetaHttpError(response.status, "bad_json");
  }
}

function voiceFailure(error: unknown): VoiceError {
  if (error instanceof VoiceError) return error;
  if (error instanceof MetaHttpError) {
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.reason === "model_not_found") {
      return new VoiceError("voice_unavailable");
    }
    if (error.status === 413) return new VoiceError("audio_too_large");
    if (error.status === 400) return new VoiceError("unsupported_audio");
  }
  return new VoiceError("upstream");
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
