import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyConceptCounts } from "@/lib/concepts";
import { emptyFarmerContext } from "@/lib/context";
import { copy } from "@/lib/copy";
import { chatMuseModels, parseSse, postMeta } from "@/lib/server/meta";
import { adviseBed, chatOutputText, marksSummary, readModelDraft } from "@/lib/server/muse";

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

describe("Muse model choice", () => {
  it("keeps chat models and drops SAM, image, and voice", () => {
    expect(
      chatMuseModels([
        "sam-3.1",
        "muse-image-1.0",
        "muse-wonder-1.0",
        "muse-spark-1.2",
        "muse-spark-1.2-contributor",
        "muse-voice-transcribe-1.0",
        "muse-spark-1.2-contributor",
      ]),
    ).toEqual(["muse-spark-1.2-contributor", "muse-spark-1.2", "muse-wonder-1.0"]);
    expect(marksSummary("en", emptyConceptCounts())).toBe("SAM mark count is zero. Describe the named plant in the photo.");
    expect(marksSummary("en", emptyConceptCounts())).not.toContain("No plants were marked");
    expect(marksSummary("sw", emptyConceptCounts())).toContain("sifuri");
    expect(marksSummary("en", { ...emptyConceptCounts(), chili: 2 })).toContain("chili 2");
  });
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

  it("reads another chat model when both Spark 1.3 ids are missing, including a curled chili with no SAM marks", async () => {
    const models: string[] = [];
    const looped = {
      detectedPlant: "chili",
      symptom: "",
      observations: ["Two chili fruits in the hand are looped into tight rings."],
      likelyCauses: [],
      mitigations: [],
      actions: [...copy.en.fallbackActions],
      confidence: "low",
      confidenceScore: 0.4,
      contextAsk: "",
      sprayIndicated: false,
      diseaseIndicated: false,
      suspect: "",
      chemicals: [],
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (init.method === "GET" || String(url).endsWith("/models")) {
          return jsonResponse({
            data: [
              { id: "sam-3.1" },
              { id: "muse-image-1.0" },
              { id: "muse-voice-transcribe-1.0" },
              { id: "muse-spark-1.3-contributor" },
              { id: "muse-spark-1.2" },
              { id: "muse-spark-1.2-contributor" },
              { id: "muse-wonder-1.0" },
            ],
          });
        }
        const body = JSON.parse(String(init.body)) as { model?: string; messages?: unknown };
        models.push(body.model ?? "");
        if (body.model === "muse-spark-1.2-contributor") {
          const prompt = JSON.stringify(body.messages);
          expect(prompt).not.toContain("No plants were marked");
          expect(prompt).toContain("SAM mark count is zero");
          expect(prompt.toLowerCase()).toContain("looped");
          return jsonResponse({ choices: [{ message: { content: JSON.stringify(looped) } }] });
        }
        return jsonResponse({ error: { code: "model_not_found" } }, 404);
      }),
    );
    const result = await adviseBed(bedOptions());
    expect(models).toEqual(["muse-spark-1.3-contributor", "muse-spark-1.3", "muse-spark-1.2-contributor"]);
    expect(result.triageSource).toBe("muse");
    expect(result.model).toBe("muse-spark-1.2-contributor");
    expect(result.likelyCauses.length).toBeGreaterThan(1);
    expect(result.mitigations.length).toBeGreaterThan(1);
    expect(result.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(result.actions.join(" ").toLowerCase()).toMatch(/chili|twist|pest/);
    expect(result.chemicals).toBeNull();
  });

  it("uses the reserve list when the catalog cannot be read, and prefers a catalog wonder model over that list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reserveModels: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (String(url).endsWith("/models")) return jsonResponse({ error: { code: "server_error" } }, 500);
        const body = JSON.parse(String(init.body)) as { model?: string };
        reserveModels.push(body.model ?? "");
        if (body.model === "muse-spark-1.2-contributor") {
          return jsonResponse({ choices: [{ message: { content: JSON.stringify(triage) } }] });
        }
        return jsonResponse({ error: { code: "model_not_found" } }, 404);
      }),
    );
    const reserved = await adviseBed(bedOptions());
    expect(reserveModels).toEqual(["muse-spark-1.3-contributor", "muse-spark-1.3", "muse-spark-1.2-contributor"]);
    expect(reserved.triageSource).toBe("muse");
    expect(reserved.model).toBe("muse-spark-1.2-contributor");
    expect(reserved.actions).not.toEqual([...copy.en.fallbackActions]);

    const wonderModels: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (String(url).endsWith("/models")) return jsonResponse({ data: [{ id: "muse-wonder-1.0" }, { id: "sam-3.1" }] });
        const body = JSON.parse(String(init.body)) as { model?: string };
        wonderModels.push(body.model ?? "");
        if (body.model === "muse-wonder-1.0") {
          return jsonResponse({ choices: [{ message: { content: JSON.stringify(triage) } }] });
        }
        return jsonResponse({ error: { code: "model_not_found" } }, 404);
      }),
    );
    const wondered = await adviseBed(bedOptions());
    expect(wonderModels).toEqual(["muse-spark-1.3-contributor", "muse-spark-1.3", "muse-wonder-1.0"]);
    expect(wondered.model).toBe("muse-wonder-1.0");
    expect(wondered.likelyCauses.length).toBeGreaterThan(1);
    expect(wondered.actions).not.toEqual([...copy.en.fallbackActions]);
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
