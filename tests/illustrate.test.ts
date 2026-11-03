import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/illustrate/route";
import { referencePrompt } from "@/lib/server/illustrate";

const input = { plant: "Tomato", suspect: "early blight", symptom: "dark ringed spots on the lower leaves" };

function illustrateRequest(body: unknown): Request {
  return new Request("http://localhost/api/illustrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function imageResponse(result: string, status = "completed"): Response {
  return new Response(
    JSON.stringify({
      id: "resp_1",
      status,
      output: [
        { type: "reasoning", id: "rs_1" },
        { type: "image_generation_call", id: "ig_1", status: "completed", result },
      ],
      usage: { input_tokens: 10, output_tokens: 9, total_tokens: 19 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function stubResponses(handler: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init.body)) as Record<string, unknown> });
      return handler(String(url), init);
    }),
  );
  return calls;
}

const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(8, 3)]).toString("base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12, 5)]).toString("base64");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("reference illustration endpoint", () => {
  it("grounds the prompt in the rendered plant, suspect, and symptom", () => {
    const prompt = referencePrompt(input.plant, input.suspect, input.symptom);
    expect(prompt).toContain("Tomato");
    expect(prompt).toContain("early blight");
    expect(prompt).toContain("dark ringed spots");
    expect(prompt).toContain("illustration");
    expect(prompt).toContain("no photograph");
  });

  it("generates through the Responses API and returns a data URL", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const calls = stubResponses(() => imageResponse(PNG));
    const response = await POST(illustrateRequest(input));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.model).toBe("muse-image-1.0");
    expect(body.mime).toBe("image/png");
    expect(body.image).toBe(`data:image/png;base64,${PNG}`);
    expect(body.demo).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.meta.ai/v1/responses");
    const sent = calls[0]?.body as { model: string; input: string };
    expect(sent.model).toBe("muse-image-1.0");
    expect(sent.input).toContain("early blight");
    expect(sent.input).toContain("dark ringed spots");
  });

  it("sniffs the image mime from the bytes", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    stubResponses(() => imageResponse(JPEG));
    const response = await POST(illustrateRequest(input));
    const body = await response.json();
    expect(body.mime).toBe("image/jpeg");
    expect(body.image).toBe(`data:image/jpeg;base64,${JPEG}`);
  });

  it("rejects an ungrounded request without calling the model", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const calls = stubResponses(() => imageResponse(PNG));
    const empty = await POST(illustrateRequest({ plant: "Tomato", suspect: "", symptom: "" }));
    expect(empty.status).toBe(400);
    const noSymptom = await POST(illustrateRequest({ plant: "Tomato", suspect: "early blight" }));
    expect(noSymptom.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("reports missing_key with no key and never throws", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "");
    const calls = stubResponses(() => imageResponse(PNG));
    const response = await POST(illustrateRequest(input));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("missing_key");
    expect(calls).toHaveLength(0);
  });

  it("reports upstream when the response carries no image", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    stubResponses(
      () =>
        new Response(JSON.stringify({ id: "resp_2", status: "completed", output: [{ type: "message" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const response = await POST(illustrateRequest(input));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("upstream");
  });

  it("reports upstream when the turn did not complete", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    stubResponses(() => imageResponse(PNG, "failed"));
    const response = await POST(illustrateRequest(input));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("upstream");
  });

  it("maps rate limits and missing models like every other endpoint", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    stubResponses(
      () =>
        new Response(JSON.stringify({ error: { code: "rate_limit" } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
    );
    const limited = await POST(illustrateRequest(input));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toBe("rate_limited");
  });

  it("rejects an unknown suspect without calling the model", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const calls = stubResponses(() => imageResponse(PNG));
    const response = await POST(illustrateRequest({ ...input, suspect: "purple hairy dragon" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("bad_request");
    expect(calls).toHaveLength(0);
  });

  it("canonicalizes an alias to the known suspect name in the prompt", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const calls = stubResponses(() => imageResponse(PNG));
    const response = await POST(illustrateRequest({ ...input, suspect: "Alternaria solani on the lower leaves" }));
    expect(response.status).toBe(200);
    const sent = calls[0]?.body as { input: string };
    expect(sent.input).toContain("early blight");
    expect(sent.input).not.toContain("Alternaria");
  });

  it("serves static mock art in demo mode with no key and no network", async () => {
    vi.stubEnv("MOCK_META", "1");
    vi.stubEnv("MODEL_API_KEY", "");
    const calls = stubResponses(() => imageResponse(PNG));
    const response = await POST(illustrateRequest(input));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.demo).toBe(true);
    expect(body.model).toBe("mock-reference-art");
    expect(body.mime).toBe("image/svg+xml");
    expect(body.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(String(body.image).split(",")[1], "base64").toString("utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("ellipse");
    expect(calls).toHaveLength(0);
  });

  it("serves distinct art per problem kind", async () => {
    vi.stubEnv("MOCK_META", "1");
    vi.stubEnv("MODEL_API_KEY", "");
    stubResponses(() => imageResponse(PNG));
    const pest = await POST(illustrateRequest({ ...input, suspect: "thrips" }));
    const deficiency = await POST(illustrateRequest({ ...input, suspect: "nitrogen deficiency" }));
    const pestImage = (await pest.json()).image as string;
    const deficiencyImage = (await deficiency.json()).image as string;
    expect(pestImage).not.toBe(deficiencyImage);
    expect(pestImage).toContain("data:image/svg+xml");
    expect(deficiencyImage).toContain("data:image/svg+xml");
  });

  it("holds the guardrail in demo mode too", async () => {
    vi.stubEnv("MOCK_META", "1");
    const response = await POST(illustrateRequest({ ...input, suspect: "purple hairy dragon" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("bad_request");
  });

  it("reports muse_unavailable when the image model is not on the key", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    stubResponses(
      () =>
        new Response(JSON.stringify({ error: { code: "model_not_found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    const response = await POST(illustrateRequest(input));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("muse_unavailable");
  });
});
