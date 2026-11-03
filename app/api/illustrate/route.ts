import { illustrateReference, IllustrateError } from "@/lib/server/illustrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MESSAGES = {
  bad_request: "Send a suspected problem and a visible symptom for the reference illustration.",
  missing_key: "Set MODEL_API_KEY on the server, or set MOCK_META=1 to run the demo.",
  muse_unavailable: "Muse Image is not available for illustrations with this key.",
  rate_limited: "Too many illustrations at once. Wait a few seconds, then try again.",
  upstream: "That illustration did not generate. Try again.",
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
    const result = await illustrateReference({
      plant: input.plant,
      suspect: input.suspect,
      symptom: input.symptom,
    });
    return Response.json({ ...result, demo: false });
  } catch (error) {
    if (error instanceof IllustrateError) return jsonError(error.code);
    return jsonError("upstream");
  }
}

function jsonError(code: IllustrateError["code"]): Response {
  const status =
    code === "bad_request" ? 400 : code === "rate_limited" ? 429 : code === "missing_key" || code === "muse_unavailable" ? 503 : 502;
  return Response.json({ error: code, message: MESSAGES[code] }, { status });
}
