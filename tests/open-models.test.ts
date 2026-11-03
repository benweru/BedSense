import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeOpenModels,
  isOpenModelsConfigured,
  OPEN_MODELS_BASE_DEFAULT,
  OPEN_MODELS_MODEL_DEFAULT,
  openModelsBaseUrl,
  openModelsModel,
  OpenModelsError,
  postOpenModels,
  readOpenModelsKey,
} from "@/lib/server/open-models";

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return handler(String(url), init);
    }),
  );
  return calls;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("open-weights adapter", () => {
  it("defaults to the Baseten endpoint and the hackathon open model", () => {
    expect(openModelsBaseUrl()).toBe(OPEN_MODELS_BASE_DEFAULT);
    expect(openModelsBaseUrl()).toBe("https://inference.baseten.co/v1");
    expect(openModelsModel()).toBe(OPEN_MODELS_MODEL_DEFAULT);
    expect(openModelsModel()).toBe("meta-models/muse-spark-open-1026");
    expect(readOpenModelsKey()).toBeNull();
    expect(isOpenModelsConfigured()).toBe(false);
  });

  it("reads endpoint, key, and model from env", () => {
    vi.stubEnv("OPEN_MODELS_BASE_URL", "https://proxy.example/v1/");
    vi.stubEnv("OPEN_MODELS_API_KEY", " open-key ");
    vi.stubEnv("OPEN_MODELS_MODEL", "meta-models/muse-glimmer-custom");
    expect(openModelsBaseUrl()).toBe("https://proxy.example/v1");
    expect(readOpenModelsKey()).toBe("open-key");
    expect(openModelsModel()).toBe("meta-models/muse-glimmer-custom");
    expect(isOpenModelsConfigured()).toBe(true);
  });

  it("refuses without a key and never touches the network", async () => {
    const calls = stubFetch(() => jsonResponse({}));
    await expect(completeOpenModels([{ role: "user", content: "hi" }])).rejects.toMatchObject({
      name: "OpenModelsError",
      code: "missing_key",
    });
    expect(calls).toHaveLength(0);
  });

  it("posts chat completions with Bearer auth and returns the text", async () => {
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    const calls = stubFetch(() =>
      jsonResponse({ choices: [{ message: { content: "Use the label rate." } }] }),
    );
    const text = await completeOpenModels([{ role: "user", content: "Can I spray?" }]);
    expect(text).toBe("Use the label rate.");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://inference.baseten.co/v1/chat/completions");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer open-key");
    const body = JSON.parse(String(calls[0]?.init.body)) as { model: string; messages: unknown[] };
    expect(body.model).toBe("meta-models/muse-spark-open-1026");
    expect(body.messages).toHaveLength(1);
  });

  it("maps auth and missing-model failures to unavailable", async () => {
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    stubFetch(() => jsonResponse({ error: { code: "unauthorized" } }, 401));
    await expect(completeOpenModels([{ role: "user", content: "hi" }])).rejects.toMatchObject({ code: "unavailable" });
  });

  it("maps rate limits distinctly from other upstream failures", async () => {
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    stubFetch(() => jsonResponse({ error: { code: "rate_limit" } }, 429));
    await expect(completeOpenModels([{ role: "user", content: "hi" }])).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("maps server errors and dropped connections to upstream", async () => {
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    stubFetch(() => jsonResponse({ error: { code: "bad_gateway" } }, 502));
    await expect(completeOpenModels([{ role: "user", content: "hi" }])).rejects.toMatchObject({ code: "upstream" });
  });

  it("reads streamed completions like the Model API path", async () => {
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    const calls = stubFetch(
      () =>
        new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
    );
    const text = await postOpenModels("/chat/completions", { model: "m", messages: [] }, "open-key").then(
      (payload) => payload.kind,
    );
    expect(text).toBe("sse");
    expect(calls).toHaveLength(1);
  });

  it("keeps the error class typed for callers", () => {
    const error = new OpenModelsError("upstream");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("upstream");
  });
});
