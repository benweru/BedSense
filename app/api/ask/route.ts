import { answerFollowUp, AskError } from "@/lib/server/ask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MESSAGES = {
  bad_request: "Send a question about this check.",
  unsupported_image: "Use a JPEG, PNG, or WebP photo.",
  image_too_large: "That photo is too large. Try a closer shot or a smaller file.",
  missing_key: "Set MODEL_API_KEY on the server, or set MOCK_META=1 to run the demo.",
  muse_unavailable: "Muse is not available for questions with this key.",
  rate_limited: "Too many questions at once. Wait a few seconds, then ask again.",
  upstream: "That question did not go through. Try again.",
} as const;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("bad_request");
  }
  if (!body || typeof body !== "object") return jsonError("bad_request");
  const input = body as Record<string, unknown>;
  try {
    const result = await answerFollowUp({
      locale: input.locale,
      question: input.question,
      grounding: input.grounding,
      thread: input.thread,
      photo: input.photo,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AskError) return jsonError(error.code);
    return jsonError("upstream");
  }
}

function jsonError(code: AskError["code"]): Response {
  const status =
    code === "bad_request"
      ? 400
      : code === "unsupported_image"
        ? 415
        : code === "image_too_large"
          ? 413
          : code === "rate_limited"
            ? 429
            : code === "missing_key" || code === "muse_unavailable"
              ? 503
              : 502;
  return Response.json({ error: code, message: MESSAGES[code] }, { status });
}
