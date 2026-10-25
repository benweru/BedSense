import { analyzeBedPhoto } from "@/lib/server/analyze";
import { AnalyzeError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby stops the function at 60s. SAM is capped and Muse keeps a deadline inside that clock.
export const maxDuration = 60;

const MESSAGES = {
  bad_request: "Send a photo as a data URL.",
  unsupported_image: "Use a JPEG, PNG, or WebP photo.",
  image_too_large: "That photo is too large. Try a closer shot or a smaller file.",
  missing_key: "Set MODEL_API_KEY on the server, or set MOCK_META=1 to run the demo.",
  missing_plant: "Name the plant in the photo.",
  upstream: "The model call did not finish. Try the photo again.",
} as const;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("bad_request");
  }
  if (!body || typeof body !== "object") return jsonError("bad_request");

  try {
    const result = await analyzeBedPhoto(body);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AnalyzeError) return jsonError(error.code);
    return jsonError("upstream");
  }
}

function jsonError(code: AnalyzeError["code"]): Response {
  const status =
    code === "bad_request" || code === "missing_plant"
      ? 400
      : code === "unsupported_image"
        ? 415
        : code === "image_too_large"
          ? 413
          : code === "missing_key"
            ? 503
            : 502;
  return Response.json({ error: code, message: MESSAGES[code] }, { status });
}
