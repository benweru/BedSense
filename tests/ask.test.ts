import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ask/route";

const grounding = {
  plant: "Tomato",
  observations: ["Raised blisters cover the underside of several tomato leaves."],
  likelyCauses: ["Blister mites or a water mark can raise blisters like these."],
  mitigations: ["Take the worst blistered leaves off the bed."],
  actions: ["Photograph the underside of one blistered leaf.", "Compare old and new growth.", "Show both photos to an agrovet."],
  suspect: null,
  actives: [],
  needsInfo: true,
  followUp: "Add a close photo of the underside of one affected leaf.",
};

function askRequest(body: unknown): Request {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubChat(answer: string) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push(String(url));
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const body = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> };
      const prompt = body.messages.map((message) => message.content).join("\n");
      expect(prompt).toContain("Tomato");
      expect(prompt).toContain("underside");
      expect(prompt.toLowerCase()).toContain("never state a numeric");
      return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("follow-up Q&A endpoint", () => {
  it("answers from the reading without touching the analyze pipeline", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const calls = stubChat("Check the underside first; that separates mites from a water mark.");
    const response = await POST(askRequest({ locale: "en", question: "Should I spray now?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answer).toContain("underside");
    expect(body.demo).toBe(false);
    expect(calls.some((url) => url.includes("analyze"))).toBe(false);
    expect(calls.some((url) => url.includes("responses"))).toBe(false);
  });

  it("reads the next model when the first returns an empty completion", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const tried: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (String(url).endsWith("/models")) {
          return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3-contributor" }, { id: "muse-spark-1.3" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        const body = JSON.parse(String(init.body)) as { model?: string };
        tried.push(body.model ?? "");
        const content = body.model === "muse-spark-1.3-contributor" ? "" : "Check the underside first.";
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const response = await POST(askRequest({ locale: "en", question: "Should I spray?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answer).toContain("underside");
    expect(tried).toEqual(["muse-spark-1.3-contributor", "muse-spark-1.3"]);
  });

  it("never shows a spray rate an answer tries to sneak in", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    stubChat("Mix 20 ml per litre and spray weekly.");
    const response = await POST(askRequest({ locale: "en", question: "How much do I mix?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answer).not.toMatch(/\d+\s*ml/i);
  });

  it("answers locally in demo mode without any network call", async () => {
    vi.stubEnv("MOCK_META", "1");
    const fetchMock = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(askRequest({ locale: "en", question: "What do I do?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.demo).toBe(true);
    expect(body.answer).toContain("underside");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty question and a grounding with no checks", async () => {
    vi.stubEnv("MOCK_META", "1");
    const empty = await POST(askRequest({ locale: "en", question: "  ", grounding, thread: [] }));
    expect(empty.status).toBe(400);
    const noChecks = await POST(
      askRequest({ locale: "en", question: "Why?", grounding: { ...grounding, actions: [] }, thread: [] }),
    );
    expect(noChecks.status).toBe(400);
  });

  it("reports muse_unavailable when the catalog has no chat model and the known ids are missing", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/models")) {
          return new Response(JSON.stringify({ data: [{ id: "sam-3.1" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: { code: "model_not_found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const response = await POST(askRequest({ locale: "en", question: "Why no spray?", grounding, thread: [] }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("muse_unavailable");
  });

  it("reports rate_limited, not a generic failure, when Meta answers 429", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    let chats = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/models")) {
          return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        chats += 1;
        return new Response(JSON.stringify({ error: { code: "rate_limit" } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const response = await POST(askRequest({ locale: "en", question: "Can I spray today?", grounding, thread: [] }));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("rate_limited");
    // One 429 stops the loop instead of burning every model.
    expect(chats).toBe(1);
  });
});
