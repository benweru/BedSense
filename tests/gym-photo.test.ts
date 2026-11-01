import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BLUR_LEVELS, blurImage, decodeJpeg, encodeJpeg } from "@/lib/blur-lab";
import { copy } from "@/lib/copy";
import { isSoftPhoto, measureJpeg } from "@/lib/photo-quality";
import { analyzeBedPhoto } from "@/lib/server/analyze";
import { readModelDraft } from "@/lib/server/muse";

// Ben's report on PR #26: a gym machine panel, a water bottle and a ceiling, uploaded as "chili".
const GYM = readFileSync(path.join("fixtures", "non-plant", "gym.jpg"));

// What Muse sends when it follows the prompt for a photo with no plant: the flag, and empty lists.
const NO_PLANT_REPLY = JSON.stringify({
  plantInFrame: false,
  detectedPlant: "",
  symptom: "",
  observations: [],
  likelyCauses: [],
  mitigations: [],
  actions: [],
  confidence: "low",
  confidenceScore: 0.1,
  contextAsk: "",
  chemicals: [],
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function check(bytes: Uint8Array, locale: "en" | "sw" = "en") {
  vi.stubEnv("MOCK_META", "0");
  vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
  for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      calls.push(body.includes('"sam-3.1"') ? "sam" : String(url).endsWith("/models") ? "models" : "muse");
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3-contributor" }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (body.includes('"sam-3.1"')) {
        // SAM finds nothing on a gym machine.
        return new Response(["data: {\"type\":\"response.completed\"}", "", ""].join("\n"), { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: NO_PLANT_REPLY } }] }), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
  const result = await analyzeBedPhoto({ image: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`, locale, plantName: "chili" });
  return { result, calls };
}

describe("gym photo with no plant", () => {
  it("reads Muse's empty no-plant reply as a verdict, not a failed read", () => {
    expect(readModelDraft(NO_PLANT_REPLY)?.plantInFrame).toBe(false);
    expect(readModelDraft('{"plantInFrame": false, "observations": [')?.plantInFrame).toBe(false);
  });

  it("says no plant found on the photo as uploaded", async () => {
    const { result } = await check(GYM);
    expect(result.qualityHold).toBe("not_plant");
    expect(result.qualityMessage).toBe(copy.en.qualityNotPlant);
  });

  it("asks Muse before blaming blur when the upload comes out soft", async () => {
    const soft = encodeJpeg(blurImage(decodeJpeg(GYM), BLUR_LEVELS[2]!));
    expect(isSoftPhoto(measureJpeg(soft)?.sharpness ?? null)).toBe(true);
    const { result, calls } = await check(soft, "sw");
    expect(calls).toContain("muse");
    expect(calls).not.toContain("sam");
    expect(result.qualityHold).toBe("not_plant");
    expect(result.qualityMessage).toBe(copy.sw.qualityNotPlant);
    expect(result.qualityMessage).not.toBe(copy.sw.qualityUnclear);
  });
});
