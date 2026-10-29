import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import jpeg from "jpeg-js";
import { POST } from "@/app/api/analyze/route";
import { copy } from "@/lib/copy";
import { isExtremeLight, judgeFrame, measureJpeg } from "@/lib/photo-quality";
import { BUTTON_OUTPUT, pngDataUrl } from "@/tests/sam-fixture";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("photo quality gate", () => {
  it("keeps a close photo SAM missed, and holds a wide sky or a soft frame", () => {
    expect(judgeFrame({ masks: [], sharpness: 0.4, skyFraction: 0.01 })).toBe("use");
    expect(judgeFrame({ masks: [], sharpness: 0.32, skyFraction: 0.22 })).toBe("too_far");
    expect(judgeFrame({ masks: [{ confidence: 0.2, areaFraction: 0.004 }], sharpness: 0.05, skyFraction: 0.01 })).toBe("unclear");
    expect(judgeFrame({ masks: [{ confidence: 0.7, areaFraction: 0.04 }], sharpness: 0.05, skyFraction: 0.2 })).toBe("use");
    expect(judgeFrame({ masks: [], sharpness: null, skyFraction: null })).toBe("use");
  });

  it("measures the distant chili bed as a wide sky and a blurred frame as soft", () => {
    const distant = measureJpeg(readFileSync("fixtures/chili/IMG_8975.jpg"));
    const close = measureJpeg(readFileSync("fixtures/chili/IMG_8968.jpg"));
    expect(distant?.skyFraction ?? 0).toBeGreaterThan(0.08);
    expect(close?.skyFraction ?? 1).toBeLessThan(0.08);
    const soft = measureJpeg(smoothJpeg());
    expect(soft?.sharpness ?? 1).toBeLessThan(0.12);
  });

  it("does not diagnose a distant bed when SAM finds nothing", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
    const chats: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "muse-spark-1.3-contributor" }] });
      if (String(url).endsWith("/responses")) return Response.json({ output_text: "" });
      chats.push(String(url));
      return Response.json({ choices: [{ message: { content: "{}" } }] });
    }));
    const bytes = readFileSync("fixtures/chili/IMG_8975.jpg");
    const response = await POST(jsonRequest({ image: dataUrl(bytes), plantName: "chili" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.qualityHold).toBe("too_far");
    expect(body.qualityMessage).toBe(copy.en.qualityTooFar);
    expect(body.likelyCauses).toEqual([]);
    expect(body.observations).toEqual([]);
    expect(body.models.muse).toBeNull();
    expect(body.models.triageSource).toBe("withheld");
    expect(body.note).toBeNull();
    expect(chats).toEqual([]);
    expect(JSON.stringify(body.actions)).not.toContain(copy.en.fallbackActions[0]);
  });

  it("keeps the clear angles and names the one that was too far", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const near = pngDataUrl();
    const far = dataUrl(readFileSync("fixtures/chili/IMG_8975.jpg"));
    const { body, museImages } = await runBatch([near, near, far], [far]);
    expect(body.qualityHold).toBeNull();
    expect(body.qualityNote).toBe(copy.en.qualityBatch([1, 2], [{ frame: 3, lighting: false }]));
    expect(body.qualityNote).toContain("only used the 2 good images (1 and 2)");
    expect(body.likelyCauses.length).toBeGreaterThan(1);
    expect(body.models.triageSource).toBe("muse");
    expect(museImages).toEqual([[near, near]]);
    expect(JSON.stringify(museImages)).not.toContain("IMG_8975");
  });

  it("runs on the two good photos and names the photo dropped for lighting", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const near = pngDataUrl();
    const dark = dataUrl(crushedJpeg());
    const { body, museImages } = await runBatch([near, dark, near], [dark]);
    expect(body.qualityHold).toBeNull();
    expect(body.qualityNote).toBe(
      "This check only used the 2 good images (1 and 3). Image 2 was left out because the lighting is not good enough. Please upload it again with better lighting.",
    );
    expect(museImages).toEqual([[near, near]]);
  });

  it("does not call Muse for a crushed-contrast photo with no strong mark", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
    const chats: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "muse-spark-1.3-contributor" }] });
      if (String(url).endsWith("/responses")) return Response.json({ output_text: "" });
      chats.push(String(url));
      return Response.json({ choices: [{ message: { content: "{}" } }] });
    }));
    const response = await POST(jsonRequest({ image: dataUrl(crushedJpeg()), plantName: "chili" }));
    const body = await response.json();
    expect(body.qualityHold).toBe("harsh_light");
    expect(body.qualityMessage).toBe("Lighting in the image is not good enough. Please upload an image with better lighting.");
    expect(body.likelyCauses).toEqual([]);
    expect(body.models.muse).toBeNull();
    expect(chats).toEqual([]);
  });

  it("names which photos have poor lighting when none can be used", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "muse-spark-1.3-contributor" }] });
      return Response.json({ output_text: "" });
    }));
    const dark = dataUrl(crushedJpeg());
    const response = await POST(jsonRequest({ images: [dark, dark], plantName: "chili" }));
    const body = await response.json();
    expect(body.qualityHold).toBe("harsh_light");
    expect(body.qualityMessage).toBe("Lighting in images 1 and 2 is not good enough. Please upload images with better lighting.");
  });
});

async function runBatch(images: string[], blank: string[]) {
    const museImages: string[][] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "muse-spark-1.3-contributor" }] });
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        input?: { content: { type: string; image_url?: string }[] }[];
        messages?: { content?: { type?: string; image_url?: { url?: string } }[] }[];
      };
      if (String(url).endsWith("/responses")) {
        const image = body.input?.[0]?.content.find((part) => part.type === "input_image")?.image_url ?? "";
        const text = blank.includes(image) ? "" : BUTTON_OUTPUT;
        return Response.json({ output_text: text });
      }
      const content = body.messages?.[1]?.content ?? body.messages?.find((message) => Array.isArray(message.content))?.content ?? [];
      museImages.push(content.filter((part) => part.type === "image_url").map((part) => part.image_url?.url ?? ""));
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              detectedPlant: "chili",
              symptom: "spots",
              observations: ["A few leaves on the near plant look pale."],
              likelyCauses: ["Leaf spots can follow wet leaves.", "A nutrient gap can pale the same leaves."],
              mitigations: ["Water the soil, not the leaves.", "Watch the pale leaves for three days."],
              actions: ["Check the underside of a pale leaf.", "Compare it with a dark green leaf.", "Show both if the pale area spreads."],
              confidence: "medium",
              confidenceScore: 0.6,
              contextAsk: "",
              sprayIndicated: false,
              diseaseIndicated: false,
              suspect: "",
              chemicals: [],
            }),
          },
        }],
      });
    }));
    const response = await POST(jsonRequest({ images, plantName: "chili" }));
    expect(response.status).toBe(200);
    return { body: await response.json(), museImages };
}

describe("photo light gate", () => {
  it("holds crushed light when marks are weak, and still checks hard sun when a mark is strong", () => {
    const hardSun = measureJpeg(readFileSync("fixtures/chili/IMG_8965.jpg"));
    expect(hardSun).not.toBeNull();
    expect(isExtremeLight({ masks: [], ...hardSun!, sharpness: hardSun!.sharpness, skyFraction: hardSun!.skyFraction })).toBe(false);
    expect(judgeFrame({ masks: [{ confidence: 0.72, areaFraction: 0.04 }], ...hardSun! })).toBe("use");
    expect(judgeFrame({ masks: [], sharpness: 0.4, skyFraction: 0.01, contrastRange: 0.1, shadowFraction: 0.02, highlightFraction: 0.01 })).toBe("harsh_light");
    expect(judgeFrame({ masks: [{ confidence: 0.15, areaFraction: 0.003 }], sharpness: 0.4, skyFraction: 0.01, contrastRange: 0.3, shadowFraction: 0.05, highlightFraction: 0.02 })).toBe("harsh_light");
    expect(judgeFrame({ masks: [{ confidence: 0.8, areaFraction: 0.05 }], sharpness: 0.4, skyFraction: 0.01, contrastRange: 0.1, shadowFraction: 0.4, highlightFraction: 0.2 })).toBe("use");
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dataUrl(bytes: Uint8Array): string {
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
}

function crushedJpeg(): Uint8Array {
  const width = 64;
  const height = 80;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const band = (x + y) % 2 === 0 ? 96 : 112;
      data[index] = band;
      data[index + 1] = band + 8;
      data[index + 2] = band - 10;
      data[index + 3] = 255;
    }
  }
  return jpeg.encode({ data, width, height }, 90).data;
}

function smoothJpeg(): Uint8Array {
  const width = 48;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 40 + y;
      data[index + 1] = 90;
      data[index + 2] = 40;
      data[index + 3] = 255;
    }
  }
  return jpeg.encode({ data, width, height }, 80).data;
}
