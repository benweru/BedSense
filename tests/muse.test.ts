import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyConceptCounts } from "@/lib/concepts";
import { emptyFarmerContext } from "@/lib/context";
import { copy } from "@/lib/copy";
import { parseSse, postMeta } from "@/lib/server/meta";
import { adviseBed, chatOutputText, readModelDraft } from "@/lib/server/muse";

const triage = {
  detectedPlant: "chili",
  symptom: "curl",
  observations: [
    "Two green chili fruits are coiled into loops in the hand.",
    "The skin is glossy and there are no leaf spots.",
  ],
  likelyCauses: ["Sucking pests can curl young chili fruit.", "A sharp change in water can twist fruit the same way."],
  mitigations: ["Take the worst coiled fruit off the bed.", "Water on an even rhythm while fruit is forming."],
  actions: [
    "Check the underside of a new chili leaf for mites.",
    "Compare a coiled fruit with a straight one on the same plant.",
    "If the next flush is coiled too, show both photos to an agrovet.",
  ],
  confidence: "medium",
  confidenceScore: 0.62,
  contextAsk: "",
  sprayIndicated: false,
  diseaseIndicated: false,
  suspect: "",
  chemicals: [],
};

function sseBody(content: string, lineBreak: "\n" | "\r\n"): string {
  const halves = [content.slice(0, 24), content.slice(24)];
  const frames = halves.map((delta) => `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}`);
  frames.push("data: [DONE]");
  return `${frames.join(`${lineBreak}${lineBreak}`)}${lineBreak}${lineBreak}`;
}

function jsonResponse(body: unknown, status = 200, contentType = "application/json"): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function bedOptions() {
  return {
    imageUrl: "data:image/jpeg;base64,aaaa",
    apiKey: "k".repeat(40),
    locale: "en" as const,
    counts: emptyConceptCounts(),
    context: emptyFarmerContext(),
    primaryCrop: "chili" as const,
    farmerPlant: "chili",
    deadline: Date.now() + 60_000,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Muse stream parsing", () => {
  it("keeps a CRLF event stream as separate frames", () => {
    const raw = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "ab" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "cd" } }] })}`,
      "data: [DONE]",
    ].join("\r\n\r\n");
    const events = parseSse(raw);
    expect(events).toHaveLength(2);
    expect(chatOutputText({ kind: "sse", events })).toBe("abcd");
  });

  it("reads a streamed triage JSON when the body is CRLF and labeled application/json", async () => {
    const raw = sseBody(JSON.stringify(triage), "\r\n");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(raw, { status: 200, headers: { "content-type": "application/json" } })),
    );
    const payload = await postMeta("/chat/completions", { model: "muse-spark-1.3" }, "k".repeat(40), 5_000);
    const text = chatOutputText(payload);
    const draft = readModelDraft(text);
    expect(draft?.likelyCauses).toEqual(triage.likelyCauses);
    expect(draft?.actions).toEqual(triage.actions);
    expect(draft?.mitigations).toEqual(triage.mitigations);
  });

  it("names the upstream status without throwing away the code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: { code: "invalid_api_key", message: "Unauthorized" } }, 401)),
    );
    await expect(postMeta("/chat/completions", {}, "k".repeat(40), 5_000)).rejects.toMatchObject({
      name: "MetaHttpError",
      status: 401,
      reason: "invalid_api_key",
    });
  });
});

describe("adviseBed", () => {
  it("accepts a CRLF Muse stream as a real answer, with causes and symptom checks", async () => {
    const raw = sseBody(JSON.stringify(triage), "\r\n");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model?: string; max_completion_tokens?: number; stream?: boolean };
      expect(body.model).toBe("muse-spark-1.3-contributor");
      expect(body.stream).toBe(true);
      expect(body.max_completion_tokens).toBeGreaterThan(2400);
      return new Response(raw, { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await adviseBed(bedOptions());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.triageSource).toBe("muse");
    expect(result.model).toBe("muse-spark-1.3-contributor");
    expect(result.detectedPlant).toBe("Chili");
    expect(result.likelyCauses.join(" ")).toContain("Sucking pests");
    expect(result.mitigations.length).toBeGreaterThan(1);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.actions.join(" ").toLowerCase()).toMatch(/chili|mite/);
    expect(result.chemicals).toBeNull();
  });

  it("retries a fast rate limit on the same model before using the backup", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) return jsonResponse({ error: { code: "rate_limit_exceeded" } }, 429);
        return jsonResponse({ choices: [{ message: { content: JSON.stringify(triage) } }] });
      }),
    );
    const result = await adviseBed(bedOptions());
    expect(calls).toBe(2);
    expect(result.triageSource).toBe("muse");
    expect(result.model).toBe("muse-spark-1.3-contributor");
    expect(result.likelyCauses.length).toBeGreaterThan(1);
  });

  it("uses the standard model when the contributor call is rejected", async () => {
    const models: string[] = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { model?: string };
        models.push(body.model ?? "");
        if (body.model === "muse-spark-1.3-contributor") {
          return jsonResponse({ error: { code: "model_not_found" } }, 404);
        }
        return jsonResponse({ choices: [{ message: { content: JSON.stringify(triage) } }] });
      }),
    );
    const result = await adviseBed(bedOptions());
    expect(models).toEqual(["muse-spark-1.3-contributor", "muse-spark-1.3"]);
    expect(result.triageSource).toBe("muse");
    expect(result.model).toBe("muse-spark-1.3");
    expect(result.likelyCauses.join(" ")).toContain("Sucking pests");
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
  });

  it("treats an empty completion as unanswered and reads the next model", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { model?: string };
        if (body.model === "muse-spark-1.3-contributor") {
          return jsonResponse({ choices: [{ message: { content: "" } }] });
        }
        return jsonResponse({ choices: [{ message: { content: JSON.stringify(triage) } }] });
      }),
    );
    const result = await adviseBed(bedOptions());
    expect(result.triageSource).toBe("muse");
    expect(result.model).toBe("muse-spark-1.3");
    expect(result.likelyCauses.join(" ")).toContain("Sucking pests");
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
  });

  it("uses the on-phone backup only after both models fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: "server_error" } }, 503)));
    const result = await adviseBed({
      ...bedOptions(),
      context: { ...emptyFarmerContext(), notes: "fruits are curled into loops" },
    });
    expect(result.triageSource).toBe("local-fallback");
    expect(result.model).toBeNull();
    expect(result.likelyCauses.length).toBeGreaterThan(0);
    expect(result.mitigations.length).toBeGreaterThan(1);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.chemicals).toBeNull();
  });

  it("does not call Muse when the function deadline has already passed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await adviseBed({ ...bedOptions(), deadline: Date.now() - 1_000 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.triageSource).toBe("local-fallback");
    expect(result.actions).toEqual([...copy.en.fallbackActions]);
  });

  it("salvages a cut-off JSON object instead of treating Muse as unanswered", async () => {
    const partial = '{"detectedPlant":"chili","symptom":"curl","observations":["The chili fruits are curled into tight loops."],"likelyCauses":["Mites curl young chili fruit."]';
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ choices: [{ message: { content: partial } }] })),
    );
    const result = await adviseBed(bedOptions());
    expect(result.triageSource).toBe("muse");
    expect(result.likelyCauses.join(" ")).toMatch(/mite/i);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
  });
});
