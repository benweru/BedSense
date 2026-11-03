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

describe("follow-up photo re-check tool", () => {
  const photo = `data:image/png;base64,${Buffer.alloc(16, 7).toString("base64")}`;

  function stubToolLoop(answer: string, seen: Array<Record<string, unknown>>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (String(url).endsWith("/models")) {
          return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        seen.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  }

  it("asks for one photo in demo mode when the question needs fresh evidence", async () => {
    vi.stubEnv("MOCK_META", "1");
    const response = await POST(askRequest({ locale: "en", question: "Is it spreading to the new leaves?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.demo).toBe(true);
    expect(body.photoRequested).toBe(true);
    expect(body.reason).toContain("worst leaf");
    expect(body.answer).toContain(body.reason);
  });

  it("asks in Kiswahili when the reading is Swahili", async () => {
    vi.stubEnv("MOCK_META", "1");
    const response = await POST(askRequest({ locale: "sw", question: "Je, imeenea kwenye majani mapya?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.photoRequested).toBe(true);
    expect(body.answer).toContain("Ninahitaji kuangalia upya");
  });

  it("answers from the reading in demo mode when no fresh evidence is needed", async () => {
    vi.stubEnv("MOCK_META", "1");
    const response = await POST(askRequest({ locale: "en", question: "Can I use ash instead of a spray?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.photoRequested).toBe(false);
    expect(body.reason).toBeNull();
  });

  it("answers from the new photo once it arrives in demo mode", async () => {
    vi.stubEnv("MOCK_META", "1");
    const response = await POST(
      askRequest({ locale: "en", question: "Is it spreading to the new leaves?", grounding, thread: [], photo }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.photoRequested).toBe(false);
    expect(body.answer).toContain("new photo");
  });

  it("turns a live request_photo reply into a photo ask with the model reason", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const seen: Array<Record<string, unknown>> = [];
    stubToolLoop('{"request_photo": "a close photo of the worst leaf"}', seen);
    const response = await POST(askRequest({ locale: "en", question: "Is it spreading?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.photoRequested).toBe(true);
    expect(body.reason).toBe("a close photo of the worst leaf");
    expect(body.answer).toContain("a close photo of the worst leaf");
    expect(seen).toHaveLength(1);
    const developer = (seen[0]?.messages as Array<{ content: string }>)[0]?.content ?? "";
    expect(developer).toContain("request_photo");
  });

  it("sends the fresh photo to the model as a vision message on the second round", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const seen: Array<Record<string, unknown>> = [];
    stubToolLoop("The new photo shows the blisters only on old growth.", seen);
    const response = await POST(askRequest({ locale: "en", question: "Is it spreading?", grounding, thread: [], photo }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.photoRequested).toBe(false);
    expect(body.answer).toContain("old growth");
    const messages = seen[0]?.messages as Array<{ content: unknown }>;
    const last = messages[messages.length - 1]?.content as Array<Record<string, unknown>>;
    expect(Array.isArray(last)).toBe(true);
    expect(last.some((part) => part.type === "image_url")).toBe(true);
    const developer = (messages[0]?.content as string) ?? "";
    expect(developer).toContain("Do not request another photo");
  });

  it("stops after one photo round instead of looping on a second request", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const seen: Array<Record<string, unknown>> = [];
    stubToolLoop('{"request_photo": "one more angle"}', seen);
    const response = await POST(askRequest({ locale: "en", question: "Is it spreading?", grounding, thread: [], photo }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.photoRequested).toBe(false);
    expect(seen).toHaveLength(1);
    expect(body.answer).toContain("agrovet");
  });

  it("rejects a bad re-check photo without calling the model", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const seen: Array<Record<string, unknown>> = [];
    stubToolLoop("unused", seen);
    const response = await POST(askRequest({ locale: "en", question: "Is it spreading?", grounding, thread: [], photo: "not-a-photo" }));
    expect(response.status).toBe(415);
    const body = await response.json();
    expect(body.error).toBe("unsupported_image");
    expect(seen).toHaveLength(0);
  });

  it("keeps system decision turns in the thread instead of dropping them", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const seen: Array<Record<string, unknown>> = [];
    stubToolLoop("The reading still stands.", seen);
    const thread = [
      { role: "farmer", text: "Is it spreading?" },
      { role: "system", text: "Evidence stale → asked for a fresh photo (a close photo)." },
    ];
    const response = await POST(askRequest({ locale: "en", question: "What now?", grounding, thread }));
    expect(response.status).toBe(200);
    const messages = seen[0]?.messages as Array<{ role: string; content: string }>;
    expect(messages.some((message) => message.content.includes("Evidence stale"))).toBe(true);
  });

  it("rejects an oversized re-check photo", async () => {
    vi.stubEnv("MOCK_META", "1");
    const big = `data:image/jpeg;base64,${Buffer.alloc(7_500_001, 7).toString("base64")}`;
    const response = await POST(askRequest({ locale: "en", question: "Is it spreading?", grounding, thread: [], photo: big }));
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error).toBe("image_too_large");
  });
});
