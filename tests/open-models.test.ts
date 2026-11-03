import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as openModelsGET } from "@/app/api/open-models/route";
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
    vi.stubEnv("MOCK_META", "0");
    const calls = stubFetch(() => jsonResponse({}));
    await expect(completeOpenModels([{ role: "user", content: "hi" }])).rejects.toMatchObject({
      name: "OpenModelsError",
      code: "missing_key",
    });
    expect(calls).toHaveLength(0);
  });

  it("posts chat completions with Bearer auth and returns the text", async () => {
    vi.stubEnv("MOCK_META", "0");
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
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    stubFetch(() => jsonResponse({ error: { code: "unauthorized" } }, 401));
    await expect(completeOpenModels([{ role: "user", content: "hi" }])).rejects.toMatchObject({ code: "unavailable" });
  });

  it("maps rate limits distinctly from other upstream failures", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    stubFetch(() => jsonResponse({ error: { code: "rate_limit" } }, 429));
    await expect(completeOpenModels([{ role: "user", content: "hi" }])).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("maps server errors and dropped connections to upstream", async () => {
    vi.stubEnv("MOCK_META", "0");
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

  it("answers keyless with no network in mock mode", async () => {
    vi.stubEnv("MOCK_META", "1");
    vi.stubEnv("OPEN_MODELS_API_KEY", "");
    const calls = stubFetch(() => jsonResponse({}));
    const text = await completeOpenModels([{ role: "user", content: "Can I spray?" }]);
    expect(text).toContain("Mock open-model answer");
    expect(calls).toHaveLength(0);
  });
});

describe("open-model verification probe", () => {
  function probeFetch(handler: (url: string, init: RequestInit) => Response) {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push(String(url));
        return handler(String(url), init);
      }),
    );
    return calls;
  }

  it("resolves the path in mock mode with no key and no network", async () => {
    vi.stubEnv("MOCK_META", "1");
    vi.stubEnv("OPEN_MODELS_API_KEY", "");
    const calls = probeFetch(() => jsonResponse({}));
    const response = await openModelsGET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.mock).toBe(true);
    expect(body.model).toBe("meta-models/muse-spark-open-1026");
    expect(body.base).toBe("https://inference.baseten.co/v1");
    expect(typeof body.latencyMs).toBe("number");
    expect(calls).toHaveLength(0);
  });

  it("reports missing_key live with no open key and never throws", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    vi.stubEnv("OPEN_MODELS_API_KEY", "");
    const calls = probeFetch(() => jsonResponse({}));
    const response = await openModelsGET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("missing_key");
    expect(body.configured).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("probes the partner endpoint live and fingerprints the key", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key-1234567890");
    const calls = probeFetch(() => jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    const response = await openModelsGET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.mock).toBe(false);
    expect(body.configured).toBe(true);
    expect(body.key).toEqual({ length: 19, prefix: "open", suffix: "7890" });
    expect(JSON.stringify(body)).not.toContain("open-key-1234567890");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("https://inference.baseten.co/v1/chat/completions");
  });

  it("reports the mapped reason when the partner endpoint fails", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    vi.stubEnv("OPEN_MODELS_API_KEY", "open-key");
    probeFetch(() => jsonResponse({ error: { code: "bad_gateway" } }, 502));
    const response = await openModelsGET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("upstream");
  });

  it("honors endpoint and model overrides in the probe", async () => {
    vi.stubEnv("MOCK_META", "1");
    vi.stubEnv("OPEN_MODELS_BASE_URL", "https://proxy.example/v1");
    vi.stubEnv("OPEN_MODELS_MODEL", "meta-models/muse-glimmer-x");
    probeFetch(() => jsonResponse({}));
    const response = await openModelsGET();
    const body = await response.json();
    expect(body.base).toBe("https://proxy.example/v1");
    expect(body.model).toBe("meta-models/muse-glimmer-x");
  });
});
