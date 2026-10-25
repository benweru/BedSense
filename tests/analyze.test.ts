import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analyze/route";
import { copy } from "@/lib/copy";
import { analyzeBedPhoto } from "@/lib/server/analyze";
import { buildMockResult } from "@/lib/server/mock";
import { BUTTON_OUTPUT, pngDataUrl } from "@/tests/sam-fixture";

function clearModelKeyChunks() {
  for (let index = 0; index < 6; index += 1) {
    vi.stubEnv(`MODEL_API_KEY_${index}`, "");
  }
}

function clearModelKeyEnv() {
  vi.stubEnv("MODEL_API_KEY", "");
  clearModelKeyChunks();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("analyze pipeline", () => {
  it("runs the demo without calling Meta", async () => {
    vi.stubEnv("MOCK_META", "1");
    const fetchMock = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: pngDataUrl(), locale: "sw" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body.mode).toBe("mock");
    expect(body.locale).toBe("sw");
    expect(body.actions).toHaveLength(3);
    expect(body.masks.length).toBeGreaterThan(0);
    expect(body.disclaimer).toContain("si utambuzi");
    expect(body.agronomistCallout.toLowerCase()).toContain("mtaalamu");
    expect(JSON.stringify(body)).not.toMatch(/\b\d+(?:[.,]\d+)?\s*ml\b/i);
    expect(JSON.stringify(body)).not.toContain("MODEL_API_KEY");
  });

  it("covers onion, beetroot, and chili demo scenes", () => {
    const focuses = [0, 1, 2].map((scenario) =>
      buildMockResult({
        scenario: scenario as 0 | 1 | 2,
        locale: "en",
        width: 900,
        height: 1200,
        mime: "image/jpeg",
        id: `scene-${scenario}`,
        createdAt: "2026-10-25T12:00:00.000Z",
      }),
    );
    expect(focuses[0]?.primaryCrop).toBe("onion");
    expect(focuses[0]?.cropFocus).toBe("onion");
    expect(focuses[0]?.counts.onion).toBeGreaterThan(0);
    expect(focuses[0]?.counts.beetroot).toBe(0);
    expect(focuses[0]?.counts.chili).toBe(0);
    expect(focuses[1]?.cropFocus).toBe("beetroot");
    expect(focuses[1]?.counts.beetroot).toBeGreaterThan(0);
    expect(focuses[1]?.counts.onion).toBe(0);
    expect(focuses[1]?.counts.chili).toBe(0);
    expect(focuses[2]?.cropFocus).toBe("chili");
    expect(focuses[2]?.counts.chili).toBeGreaterThan(0);
    expect(focuses[2]?.counts.onion).toBe(0);
    expect(focuses[2]?.counts.beetroot).toBe(0);
    expect(focuses[0]?.detectedPlant).toBe("Onion");
    expect(focuses[1]?.detectedPlant).toBe("Beetroot");
    expect(focuses[2]?.detectedPlant).toBe("Chili");
    for (const result of focuses) {
      expect(result.actions).toHaveLength(3);
      expect(result.models.sam).toBe("sam-3.1");
      expect(result.contextUsed).toBe(false);
      expect(result.contextAsk).toBeTruthy();
    }
  });

  it("accepts optional context in demo mode and stops asking once it is present", async () => {
    vi.stubEnv("MOCK_META", "1");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image: pngDataUrl(),
          locale: "en",
          context: { stage: "three weeks", notes: "leaves look tired" },
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.contextUsed).toBe(true);
    expect(body.contextAsk).toBeNull();
    expect(body.detectedPlant).toBeTruthy();
    expect(body.actions).toHaveLength(3);
    expect(JSON.stringify(body.observations)).not.toContain("notes you added");
    expect(JSON.stringify(body.observations)).not.toMatch(/segmentation did not return/i);
  });

  it("stays in demo mode when no key is configured", async () => {
    vi.stubEnv("MOCK_META", "");
    clearModelKeyEnv();
    const fetchMock = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzeBedPhoto({ image: pngDataUrl(), locale: "en" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.mode).toBe("mock");
    expect(result.actions).toHaveLength(3);
  });

  it("asks for a key when live mode has none", async () => {
    vi.stubEnv("MOCK_META", "0");
    clearModelKeyEnv();
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: pngDataUrl() }),
      }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("missing_key");
  });

  it("rejects a request without a photo", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: "en" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("segments with SAM and falls back from contributor Muse, stripping doses", async () => {
    vi.stubEnv("MOCK_META", "0");
    const liveKey = "k".repeat(40);
    vi.stubEnv("MODEL_API_KEY", liveKey);
    clearModelKeyChunks();
    const phrases: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${liveKey}`);
      const body = JSON.parse(String(init.body)) as {
        model?: string;
        input?: Array<{ content: Array<{ type: string; text?: string }> }>;
        messages?: Array<{ role?: string; content?: unknown }>;
      };
      if (Array.isArray(body.messages)) {
        const developer = body.messages.find((message) => message.role === "developer");
        expect(String(developer?.content).toLowerCase()).toContain("any farm plant");
        expect(String(developer?.content)).toContain("contextAsk");
        const user = body.messages.find((message) => message.role === "user");
        expect(JSON.stringify(user?.content)).toContain("three weeks");
        expect(JSON.stringify(user?.content)).toContain("Onion");
      }
      if (String(url).endsWith("/responses")) {
        expect(body.model).toBe("sam-3.1");
        const phrase = body.input?.[0]?.content.find((part) => part.type === "input_text")?.text;
        if (phrase) phrases.push(phrase);
        const text = phrase === "onion plant" ? BUTTON_OUTPUT : "";
        const sse = [
          `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}`,
          "",
          `data: ${JSON.stringify({ type: "response.output_text.done", text })}`,
          "",
          `data: ${JSON.stringify({ type: "response.completed" })}`,
          "",
        ].join("\n");
        return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      if (body.model === "muse-spark-1.3-contributor") {
        return new Response(JSON.stringify({ error: { message: "unavailable" } }), { status: 503 });
      }
      expect(body.model).toBe("muse-spark-1.3");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  observations: [
                    "The row looks uneven from this side of the bed.",
                    "Beetroot segmentation did not return, so those marks may be missing.",
                    "The notes you added are part of this check.",
                  ],
                  hypotheses: ["The onion row may be thirsty."],
                  chemicalsHelp: false,
                  issue: "none",
                  actions: [
                    "Feel the soil before watering.",
                    "Spray 20 ml per 20 L of water tonight.",
                    "Show this photo to an agronomist.",
                  ],
                  confidence: "high",
                  confidenceScore: 0.91,
                  detectedPlant: "tomato",
                  contextAsk: "When did you last water?",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeBedPhoto({
      image: pngDataUrl(),
      locale: "en",
      plantName: "onion",
      context: { stage: "three weeks" },
    });
    expect(result.mode).toBe("live");
    expect(result.models.sam).toBe("sam-3.1");
    expect(result.models.muse).toBe("muse-spark-1.3");
    expect(result.models.triageSource).toBe("muse");
    expect(result.masks.length).toBe(2);
    expect(result.counts.onion).toBe(2);
    expect(result.image).toEqual({ width: 320, height: 334, mime: "image/png" });
    expect(result.actions).toHaveLength(3);
    expect(result.confidence).toBe("low");
    expect(JSON.stringify(result)).not.toMatch(/\b20\s*ml\b/i);
    expect(JSON.stringify(result)).not.toContain(liveKey);
    expect(result.disclaimer.toLowerCase()).toContain("not a diagnosis");
    expect(result.agronomistCallout.toLowerCase()).toContain("agronomist");
    expect(result.detectedPlant).toBe("Onion");
    expect(result.contextAsk).toBe("When did you last water?");
    expect(result.contextUsed).toBe(true);
    expect(result.observations.join(" ")).toContain("uneven");
    expect(result.observations.join(" ").toLowerCase()).not.toContain("beetroot");
    expect(result.observations.join(" ")).not.toContain("notes you added");
    expect(result.hypotheses).toContain("The onion row may be thirsty.");
    expect(result.chemicals).toEqual([]);
    expect(phrases).toEqual(expect.arrayContaining(["onion plant", "yellow leaf", "weed"]));
    expect(phrases).not.toContain("beetroot plant");
    expect(phrases).not.toContain("chili pepper plant");
    const models = fetchMock.mock.calls
      .map((call) => JSON.parse(String(call[1]?.body)) as { model?: string })
      .map((body) => body.model);
    expect(models).toContain("sam-3.1");
    expect(models).toContain("muse-spark-1.3-contributor");
    expect(models).toContain("muse-spark-1.3");
  });

  it("triages a named plant when marks are empty and Muse is down", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    clearModelKeyChunks();
    const phrases: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as {
          input?: Array<{ content: Array<{ type: string; text?: string }> }>;
        };
        if (String(url).endsWith("/responses")) {
          const phrase = body.input?.[0]?.content.find((part) => part.type === "input_text")?.text;
          if (phrase) phrases.push(phrase);
          return new Response("data: {\"type\":\"response.completed\"}\n\n", {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        }
        return new Response(JSON.stringify({ error: { message: "unavailable" } }), { status: 503 });
      }),
    );

    const result = await analyzeBedPhoto({
      image: pngDataUrl(),
      locale: "en",
      plantName: "chilly",
      context: { notes: "Yes other chillies are like this. What could be the cause of the curling?" },
    });
    expect(result.mode).toBe("live");
    expect(result.models.triageSource).toBe("local-fallback");
    expect(result.detectedPlant).toBe("Chili");
    expect(result.masks).toEqual([]);
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.chemicals.length).toBeGreaterThan(0);
    expect(result.chemicals.some((offer) => /KES \d+–\d+/.test(offer.kesBand))).toBe(true);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    const visible = [...result.observations, ...result.hypotheses, ...result.actions, ...result.chemicals.map((offer) => `${offer.why} ${offer.shops}`)].join(" ");
    expect(visible.toLowerCase()).not.toContain("beetroot");
    expect(visible.toLowerCase()).not.toContain("onion");
    expect(phrases).not.toContain("beetroot plant");
    expect(phrases).toContain("chili pepper plant");
  });
});
