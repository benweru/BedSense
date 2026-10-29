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
        body: JSON.stringify({ image: pngDataUrl(), locale: "sw", plantName: "pilipili" }),
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
    expect(body.agronomistCallout.toLowerCase()).toContain("agroveterinary");
    expect(body.farmerPlant).toBe("pilipili");
    expect(body.chemicals.suspect.toLowerCase()).toContain("thrips");
    expect(body.chemicals.lookup).toBe("catalog");
    expect(body.chemicals.products.length).toBeGreaterThan(0);
    const prose = JSON.stringify({
      actions: body.actions,
      observations: body.observations,
      notes: body.chemicals.products.map((product: { useNote: string }) => product.useNote),
    });
    expect(prose).not.toMatch(/\b\d+(?:[.,]\d+)?\s*ml\b/i);
    const offers = body.chemicals.products[0].offers;
    expect(offers.map((offer: { quality: string }) => offer.quality)).toEqual(["economy", "mid", "premium"]);
    expect(offers[0].priceMinKes).toBeLessThan(offers[0].priceMaxKes);
    expect(offers[0].shopName.length).toBeGreaterThan(0);
    expect(offers[0].place.length).toBeGreaterThan(0);
    expect(String(body.chemicals.priceNote)).toContain("KES");
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
      expect(result.farmerPlant).toBe("");
      expect(result.chemicals?.products.length).toBeGreaterThan(0);
      expect(result.chemicals?.lookup).toBe("catalog");
      for (const product of result.chemicals?.products ?? []) {
        expect(product.offers.map((offer) => offer.quality)).toEqual(["economy", "mid", "premium"]);
        for (const offer of product.offers) {
          expect(offer.priceMinKes).toBeLessThanOrEqual(offer.priceMaxKes);
          expect(offer.shopName.length).toBeGreaterThan(0);
        }
      }
    }
    expect(focuses[0]?.chemicals?.suspect.toLowerCase()).toContain("purple blotch");
    expect(focuses[0]?.chemicals?.products.some((product) => product.activeIngredient === "Mancozeb")).toBe(true);
    expect(focuses[2]?.chemicals?.products.some((product) => product.activeIngredient === "Lambda-cyhalothrin")).toBe(true);
    expect(focuses[0]?.observations.join(" ").toLowerCase()).not.toMatch(/beetroot|\bbeets?\b|chili|pilipili/);
    expect(focuses[1]?.observations.join(" ").toLowerCase()).not.toMatch(/\bonions?\b|kitunguu|chili|pilipili/);
    expect(focuses[2]?.observations.join(" ").toLowerCase()).not.toMatch(/\bonions?\b|kitunguu|beetroot|\bbeets?\b/);
    expect(focuses[0]?.observations[0]).toMatch(/onion \d+/);
    expect(focuses[0]?.observations[0]).not.toMatch(/beetroot 0|chili 0/);

    const swahili = [0, 1, 2].map((scenario) =>
      buildMockResult({
        scenario: scenario as 0 | 1 | 2,
        locale: "sw",
        width: 900,
        height: 1200,
        mime: "image/jpeg",
        id: `sw-${scenario}`,
        createdAt: "2026-10-25T12:00:00.000Z",
      }).observations.join(" "),
    );
    expect(swahili[0]?.toLowerCase()).not.toMatch(/beetroot|\bbeets?\b|pilipili|chili/);
    expect(swahili[1]?.toLowerCase()).not.toMatch(/\bonions?\b|kitunguu|pilipili|chili/);
    expect(swahili[2]?.toLowerCase()).not.toMatch(/\bonions?\b|kitunguu|beetroot|\bbeets?\b/);
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
          plantName: "onion",
          context: { stage: "three weeks", notes: "leaves look tired" },
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.contextUsed).toBe(true);
    expect(body.contextAsk).toBeNull();
    expect(body.detectedPlant).toBe("Onion");
    expect(body.farmerPlant).toBe("onion");
    expect(body.actions).toHaveLength(3);
    expect(JSON.stringify(body.observations)).not.toContain("notes you added");
  });

  it("stays in demo mode when no key is configured", async () => {
    vi.stubEnv("MOCK_META", "");
    clearModelKeyEnv();
    const fetchMock = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: "chili" });
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
        body: JSON.stringify({ image: pngDataUrl(), plantName: "onion" }),
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
    const body = await response.json();
    expect(body.error).toBe("bad_request");
  });

  it("asks for the plant name before it reads the photo", async () => {
    vi.stubEnv("MOCK_META", "1");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: pngDataUrl(), plantName: "  " }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("missing_plant");
  });

  it("segments with SAM and falls back from contributor Muse, stripping doses", async () => {
    vi.stubEnv("MOCK_META", "0");
    const liveKey = "k".repeat(40);
    vi.stubEnv("MODEL_API_KEY", liveKey);
    clearModelKeyChunks();
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (String(url).endsWith("/models")) {
        return new Response(
          JSON.stringify({ data: [{ id: "muse-spark-1.3-contributor" }, { id: "muse-spark-1.3" }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
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
        expect(String(developer?.content).toLowerCase()).toContain("activeingredient");
        expect(String(developer?.content).toLowerCase()).not.toContain("do not prescribe");
        const user = body.messages.find((message) => message.role === "user");
        expect(JSON.stringify(user?.content)).toContain("three weeks");
        expect(JSON.stringify(user?.content)).toContain("tomato");
      }
      if (String(url).endsWith("/responses")) {
        expect(body.model).toBe("sam-3.1");
        const phrase = body.input?.[0]?.content.find((part) => part.type === "input_text")?.text;
        const text = phrase === "tomato plant" ? BUTTON_OUTPUT : "";
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
                  observations: ["The row looks uneven from this side of the bed."],
                  actions: [
                    "Feel the soil before watering.",
                    "Spray 20 ml per 20 L of water tonight.",
                    "Show this photo to an agronomist.",
                  ],
                  confidence: "high",
                  confidenceScore: 0.91,
                  detectedPlant: "tomato",
                  contextAsk: "When did you last water?",
                  diseaseIndicated: true,
                  suspect: "early blight",
                  chemicals: [
                    {
                      activeIngredient: "mancozeb",
                      productClass: "fungicide",
                      useNote: "Mix 20 ml per litre and spray tonight.",
                    },
                  ],
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
      plantName: "tomato",
      context: { stage: "three weeks" },
    });
    expect(result.mode).toBe("live");
    expect(result.models.sam).toBe("sam-3.1");
    expect(result.models.muse).toBe("muse-spark-1.3");
    expect(result.models.triageSource).toBe("muse");
    expect(result.masks.length).toBe(2);
    expect(result.counts.plant).toBe(2);
    expect(result.counts.onion).toBe(0);
    expect(result.counts.beetroot).toBe(0);
    expect(result.counts.chili).toBe(0);
    expect(result.image).toEqual({ width: 320, height: 334, mime: "image/png" });
    expect(result.actions).toHaveLength(3);
    expect(result.confidence).toBe("low");
    expect(JSON.stringify(result)).not.toMatch(/\b20\s*ml\b/i);
    expect(JSON.stringify(result)).not.toContain(liveKey);
    expect(result.disclaimer.toLowerCase()).toContain("not a diagnosis");
    expect(result.agronomistCallout.toLowerCase()).toContain("agroveterinary");
    expect(result.detectedPlant).toBe("Tomato");
    expect(result.contextAsk).toBe("When did you last water?");
    expect(result.contextUsed).toBe(true);
    expect(result.observations.join(" ")).toContain("uneven");
    expect(result.observations.join(" ")).not.toContain("notes you added");
    expect(result.observations.join(" ")).not.toMatch(/segmentation did not return/i);
    expect(result.farmerPlant).toBe("tomato");
    expect(result.chemicals?.suspect).toBe("early blight");
    expect(result.chemicals?.lookup).toBe("catalog");
    expect(result.chemicals?.products[0]?.activeIngredient).toBe("Mancozeb");
    expect(result.chemicals?.products[0]?.useNote.toLowerCase()).not.toMatch(/\d+\s*ml/);
    expect(result.chemicals?.products[0]?.useNote.toLowerCase()).toContain("product label");
    expect(result.chemicals?.products[0]?.offers).toHaveLength(3);
    expect(result.chemicals?.verifyNote.toLowerCase()).toContain("agroveterinary");
    const phrases = fetchMock.mock.calls.flatMap((call) => {
      if (!call[1]?.body) return [];
      const payload = JSON.parse(String(call[1].body)) as {
        input?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      };
      return (payload.input ?? []).flatMap((item) => item.content ?? []).flatMap((part) => (part.text ? [part.text] : []));
    });
    expect(phrases).toEqual(expect.arrayContaining(["tomato plant", "yellow leaf", "weed"]));
    expect(phrases).toHaveLength(3);
    expect(phrases).not.toContain("onion plant");
    expect(phrases).not.toContain("beetroot plant");
    expect(phrases).not.toContain("chili pepper plant");
    const models = fetchMock.mock.calls.flatMap((call) => {
      if (!call[1]?.body) return [];
      const body = JSON.parse(String(call[1].body)) as { model?: string };
      return body.model ? [body.model] : [];
    });
    expect(models).toContain("sam-3.1");
    expect(models).toContain("muse-spark-1.3-contributor");
    expect(models).toContain("muse-spark-1.3");
  });

  it("keeps curled-fruit causes when Muse omits chemicals and echoes the generic checks", async () => {
    const result = await liveReading({
      plantName: "chilly",
      muse: {
        detectedPlant: "chilly",
        observations: [
          "Two green chilly fruits held in hand, glossy green with no visible spots or rot",
          "Both fruits severely curled and coiled into twisted loops, showing malformed growth",
        ],
        actions: [...copy.en.fallbackActions],
        diseaseIndicated: false,
        suspect: "",
        chemicals: [],
      },
    });
    expect(result.models.triageSource).toBe("muse");
    expect(result.masks).toEqual([]);
    expect(result.detectedPlant).toBe("Chili");
    expect(result.observations.join(" ")).toContain("Chili");
    expect(result.observations.join(" ")).not.toMatch(/\bchilly\b/i);
    expect(result.observations.join(" ").toLowerCase()).not.toMatch(/\bonions?\b|beetroot/);
    expect(result.likelyCauses.length).toBeGreaterThan(1);
    expect(result.mitigations.length).toBeGreaterThan(1);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.actions.join(" ").toLowerCase()).toMatch(/chili|mite|thrip/);
    expect(result.chemicals).toBeNull();
  });

  it("fills tomato spot causes and catalog shops when Muse forgets chemicals", async () => {
    const result = await liveReading({
      plantName: "tomato",
      muse: {
        detectedPlant: "tomato",
        observations: ["Dark spots on the lower leaves, and the newer leaves are still clean."],
        actions: ["Look at the spots again tomorrow."],
        diseaseIndicated: false,
        chemicals: [],
      },
    });
    expect(result.detectedPlant).toBe("Tomato");
    expect(result.likelyCauses.join(" ").toLowerCase()).toContain("tomato");
    expect(result.mitigations.length).toBeGreaterThan(1);
    expect(result.actions).toHaveLength(3);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.chemicals?.products.some((product) => product.activeIngredient === "Mancozeb")).toBe(true);
    expect(result.chemicals?.products[0]?.offers.length).toBeGreaterThan(0);
    expect(result.chemicals?.priceNote).toContain("KES");
    const visible = JSON.stringify({
      observations: result.observations,
      causes: result.likelyCauses,
      mitigations: result.mitigations,
      actions: result.actions,
    }).toLowerCase();
    expect(visible).not.toMatch(/onion|beetroot|chili|pilipili/);
  });

  it("salvages a prose reply that describes the symptom instead of falling back to generic checks", async () => {
    const result = await liveReading({
      plantName: "chili",
      museText: "Both fruits are severely curled and twisted along the stem. The skin is still glossy.",
    });
    expect(result.models.triageSource).toBe("muse");
    expect(result.note).toBeNull();
    expect(result.likelyCauses.length).toBeGreaterThan(0);
    expect(result.mitigations.length).toBeGreaterThan(0);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.detectedPlant).toBe("Chili");
  });

  it("holds the reading when SAM marked nothing and Muse says it is unsure", async () => {
    const reading = {
      detectedPlant: "chili",
      symptom: "curl",
      observations: ["The leaves are hard to make out.", "Some fruit may be curled."],
      likelyCauses: ["Sucking pests can curl fruit."],
      mitigations: ["Check under the leaves."],
      actions: ["Look under a leaf.", "Compare two fruits.", "Retake the photo."],
      confidence: "low",
      chemicals: [],
    };
    const unsure = await liveReading({ plantName: "chili", muse: { ...reading, confidenceScore: 0.35 } });
    expect(unsure.models.triageSource).toBe("withheld");
    expect(unsure.qualityHold).toBe("unclear");
    expect(unsure.likelyCauses).toEqual([]);
    const sure = await liveReading({ plantName: "chili", muse: { ...reading, confidence: "medium", confidenceScore: 0.7 } });
    expect(sure.models.triageSource).toBe("muse");
  });

  it("uses symptom notes when both Muse models fail, and does not invent a spray for curl alone", async () => {
    vi.stubEnv("MOCK_META", "0");
    const liveKey = "k".repeat(40);
    vi.stubEnv("MODEL_API_KEY", liveKey);
    clearModelKeyChunks();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3-contributor" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (String(url).endsWith("/responses")) {
        return new Response('data: {"type":"response.completed"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "down" } }), { status: 503 });
    }));
    const result = await analyzeBedPhoto({
      image: pngDataUrl(),
      locale: "en",
      plantName: "tomato",
      context: { notes: "the leaves are curling" },
    });
    expect(result.models.triageSource).toBe("local-fallback");
    expect(result.likelyCauses.join(" ").toLowerCase()).toContain("tomato");
    expect(result.mitigations.length).toBeGreaterThan(1);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.chemicals).toBeNull();
  });

  it("returns muse_unavailable instead of the generic checks when the catalog has no chat model", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    clearModelKeyChunks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/responses")) {
          return new Response('data: {"type":"response.completed"}\n\n', {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        }
        return new Response(JSON.stringify({ data: [{ id: "sam-3.1" }, { id: "muse-image-1.0" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: pngDataUrl(), locale: "en", plantName: "chili" }),
      }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("muse_unavailable");
    expect(body.message).toContain("Meta Model API");
    expect(JSON.stringify(body)).not.toContain(copy.en.fallbackActions[0]);
  });
});

async function liveReading(options: {
  plantName: string;
  muse?: Record<string, unknown>;
  museText?: string;
}) {
  vi.stubEnv("MOCK_META", "0");
  const liveKey = "k".repeat(40);
  vi.stubEnv("MODEL_API_KEY", liveKey);
  clearModelKeyChunks();
  const content = options.museText ?? JSON.stringify(options.muse);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3-contributor" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(url).endsWith("/responses")) {
      const sse = ["data: {\"type\":\"response.completed\"}", "", ""].join("\n");
      return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }));
  return analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: options.plantName });
}
