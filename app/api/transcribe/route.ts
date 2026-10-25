import { transcribeContextAudio, VoiceError } from "@/lib/server/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MESSAGES = {
  bad_request: "Send a voice note as audio.",
  unsupported_audio: "Record a short voice note and try again.",
  audio_too_large: "That voice note is too large. Hold the button for a shorter note.",
  audio_too_long: "That voice note is too long. Hold the button for under a minute.",
  missing_key: "Set MODEL_API_KEY on the server, or set MOCK_META=1 to run the demo.",
  voice_unavailable:
    "Muse Voice is not available for this key. In the Meta Model API dashboard, enable Muse Voice Transcribe, then try the note again.",
  upstream: "The voice note did not transcribe. Try again.",
} as const;

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("bad_request");
  }
  const audio = form.get("audio");
  if (!(audio instanceof File)) return jsonError("bad_request");

  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const result = await transcribeContextAudio(bytes, form.get("locale"));
    return Response.json(result);
  } catch (error) {
    if (error instanceof VoiceError) return jsonError(error.code);
    return jsonError("upstream");
  }
}

function jsonError(code: VoiceError["code"]): Response {
  const status =
    code === "bad_request"
      ? 400
      : code === "unsupported_audio" || code === "audio_too_long"
        ? 415
        : code === "audio_too_large"
          ? 413
          : code === "missing_key" || code === "voice_unavailable"
            ? 503
            : 502;
  return Response.json({ error: code, message: MESSAGES[code] }, { status });
}
