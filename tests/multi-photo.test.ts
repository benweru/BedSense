import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analyze/route";
import { copy } from "@/lib/copy";
import { framesSummary } from "@/lib/server/muse";
import { emptyConceptCounts } from "@/lib/concepts";
import { BUTTON_OUTPUT, pngDataUrl } from "@/tests/sam-fixture";

const DIAGNOSIS = {
  detectedPlant: "chili",
  symptom: "curl",
  observations: ["One chili fruit is looped in the first angle.", "The second angle shows the same loop from the side."],
  likelyCauses: ["Sucking pests can curl young chili fruit.", "Uneven water can twist the same fruit."],
  mitigations: ["Take the worst fruit off the bed.", "Keep the water even."],
  actions: ["Check a new leaf for mites.", "Compare the loop in both angles.", "Photograph again if the next flush loops."],
  confidence: "medium",
  confidenceScore: 0.62,
  contextAsk: "",
  sprayIndicated: false,
  diseaseIndicated: false,
  suspect: "",
  chemicals: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("multi-photo triage", () => {
  it("runs SAM on each angle and sends every photo in one Muse call", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = pngDataUrl();
    const second = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const imageCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).endsWith("/models")) {
          return Response.json({ data: [{ id: "muse-spark-1.3-contributor" }] });
        }
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          model?: string;
          input?: { content: { type: string; text?: string; image_url?: string }[] }[];
          messages?: { content?: { type?: string; image_url?: { url?: string }; text?: string }[] }[];
        };
        if (String(url).endsWith("/responses")) {
          const phrase = body.input?.[0]?.content.find((part) => part.type === "input_text")?.text ?? "";
          const image = body.input?.[0]?.content.find((part) => part.type === "input_image")?.image_url ?? "";
          imageCalls.push(`${image === second ? "second" : "first"}:${phrase}`);
          const text = image === first && phrase === "chili pepper plant" ? BUTTON_OUTPUT : "";
          return Response.json({ output_text: text });
        }
        const content = body.messages?.find((message) => Array.isArray(message.content))?.content ?? [];
        const images = content.filter((part) => part.type === "image_url").map((part) => part.image_url?.url);
        expect(images).toEqual([first, second]);
        expect(content.find((part) => part.type === "text")?.text).toContain("2 phone photos of one farm bed");
        expect(content.find((part) => part.type === "text")?.text).toContain("Frame 1:");
        expect(content.find((part) => part.type === "text")?.text).toContain("Frame 2:");
        return Response.json({ choices: [{ message: { content: JSON.stringify(DIAGNOSIS) } }] });
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: [first, second], plantName: "chili", locale: "en" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.models.triageSource).toBe("muse");
    expect(body.models.muse).toBe("muse-spark-1.3-contributor");
    expect(body.note).toBeNull();
    expect(body.likelyCauses.length).toBeGreaterThan(1);
    expect(body.actions).not.toEqual([...copy.en.fallbackActions]);
    expect(body.frames).toHaveLength(2);
    expect(body.masks.every((mask: { frame: number }) => mask.frame === 0)).toBe(true);
    expect(body.masks.length).toBeGreaterThan(0);
    expect(imageCalls.filter((call) => call.startsWith("first:")).length).toBe(3);
    expect(imageCalls.filter((call) => call.startsWith("second:")).length).toBe(3);
  });

  it("rejects a fourth photo instead of dropping one in silence", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "k".repeat(40));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const image = pngDataUrl();
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: [image, image, image, image], plantName: "chili" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a single frame summary in the old one-photo shape", () => {
    const counts = emptyConceptCounts();
    expect(framesSummary("en", [counts])).toContain("SAM mark count is zero");
    expect(framesSummary("en", [counts, counts])).toContain("Frame 2:");
  });
});
