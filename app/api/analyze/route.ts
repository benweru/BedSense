import { normalizeLocale } from "@/lib/copy";
import { analyzeBedPhoto } from "@/lib/server/analyze";
import { AnalyzeError, type Locale } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby stops the function at 60s. SAM is capped and Muse keeps a deadline inside that clock.
export const maxDuration = 60;

const MESSAGES: Record<AnalyzeError["code"], Record<Locale, string>> = {
  bad_request: {
    en: "Send a photo as a data URL.",
    sw: "Tuma picha kama data URL.",
  },
  unsupported_image: {
    en: "Use a JPEG, PNG, or WebP photo.",
    sw: "Tumia picha ya JPEG, PNG, au WebP.",
  },
  image_too_large: {
    en: "That photo is too large. Try a closer shot or a smaller file.",
    sw: "Picha hii ni kubwa sana. Jaribu picha nyingine au faili ndogo zaidi.",
  },
  missing_key: {
    en: "Set MODEL_API_KEY on the server, or set MOCK_META=1 to run the demo.",
    sw: "Weka MODEL_API_KEY kwenye seva, au weka MOCK_META=1 ili kuendesha onyesho.",
  },
  missing_plant: {
    en: "Name the plant in the photo.",
    sw: "Taja mmea ulio kwenye picha.",
  },
  muse_unavailable: {
    en: "Muse Spark is not available for this key. In the Meta Model API dashboard, enable a Muse Spark or Muse Wonder chat model, then run the check again.",
    sw: "Muse Spark haipatikani kwa ufunguo huu. Kwenye dashibodi ya Meta Model API, washa modeli ya Muse Spark au Muse Wonder, kisha jaribu kukagua tena.",
  },
  upstream: {
    en: "The model call did not finish. Try the photo again.",
    sw: "Modeli haikujibu. Jaribu tena na picha.",
  },
};

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("bad_request", "en");
  }
  if (!body || typeof body !== "object") return jsonError("bad_request", "en");
  const locale = normalizeLocale((body as { locale?: unknown }).locale);

  try {
    const result = await analyzeBedPhoto(body);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AnalyzeError) return jsonError(error.code, locale);
    return jsonError("upstream", locale);
  }
}

function jsonError(code: AnalyzeError["code"], locale: Locale): Response {
  const status =
    code === "bad_request" || code === "missing_plant"
      ? 400
      : code === "unsupported_image"
        ? 415
        : code === "image_too_large"
          ? 413
          : code === "missing_key" || code === "muse_unavailable"
            ? 503
            : 502;
  return Response.json({ error: code, message: MESSAGES[code][locale] }, { status });
}
