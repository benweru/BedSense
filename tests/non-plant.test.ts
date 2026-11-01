import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeJpeg } from "@/lib/blur-lab";
import { copy } from "@/lib/copy";
import { isSoftPhoto, measureJpeg } from "@/lib/photo-quality";
import { analyzeBedPhoto } from "@/lib/server/analyze";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function softJpegUrl(): string {
  // A plain painted wall: smooth, even light, nothing for the sharpness score to find.
  const width = 640;
  const height = 480;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const shade = 150 + Math.round((x / width) * 20);
      data[offset] = shade;
      data[offset + 1] = shade - 10;
      data[offset + 2] = shade - 25;
      data[offset + 3] = 255;
    }
  }
  const bytes = encodeJpeg({ data, width, height });
  expect(isSoftPhoto(measureJpeg(bytes)?.sharpness ?? null)).toBe(true);
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
}

async function softCheck(locale: "en" | "sw", plantInFrame: boolean) {
  vi.stubEnv("MOCK_META", "0");
  vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
  for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
  const reading = {
    plantInFrame,
    detectedPlant: plantInFrame ? "chili" : "",
    observations: plantInFrame ? ["The leaves are hard to make out."] : ["A wooden table with a mug."],
    likelyCauses: [],
    mitigations: [],
    actions: ["Retake the photo.", "Hold steady.", "Fill the frame."],
    confidence: "low",
    confidenceScore: 0.2,
    chemicals: [],
  };
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3-contributor" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reading) } }] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const result = await analyzeBedPhoto({ image: softJpegUrl(), locale, plantName: "chili" });
  return { result, fetchMock };
}

describe("photo with no plant in it", () => {
  it("says no plant was found instead of asking for a steadier photo", async () => {
    const { result } = await softCheck("sw", false);
    expect(result.qualityHold).toBe("not_plant");
    expect(result.qualityMessage).toBe(copy.sw.qualityNotPlant);
    expect(result.qualityMessage).toContain("Hatukuona mmea");
    expect(result.qualityMessage).not.toBe(copy.sw.qualityUnclear);
  });

  it("keeps the blur message for a soft photo of a plant", async () => {
    const { result } = await softCheck("en", true);
    expect(result.qualityHold).toBe("unclear");
    expect(result.qualityMessage).toBe(copy.en.qualityUnclear);
  });

  it("has distinct no-plant copy in both languages", () => {
    expect(copy.en.qualityNotPlant).toMatch(/couldn't find a plant/i);
    expect(copy.sw.qualityNotPlant).toMatch(/Hatukuona mmea/);
    expect(copy.en.qualityNotPlant).not.toBe(copy.en.qualityUnclear);
  });
});
