import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/transcribe/route";
import { appendToContext, emptyFarmerContext } from "@/lib/context";
import { transcribeContextAudio } from "@/lib/server/transcribe";
import { inspectWav, languageBiasFor, pcm16Wav, VOICE_MODEL, wavBlob } from "@/lib/voice";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MOCK_META;
  delete process.env.MODEL_API_KEY;
});

describe("voice notes", () => {
  it("encodes mono 16 kHz PCM and rejects other WAV shapes", () => {
    const samples = new Float32Array(16000);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.sin(index / 20) * 0.4;
    const wav = pcm16Wav(samples, 48_000, 16_000);
    const info = inspectWav(wav);
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.info.sampleRate).toBe(16000);
      expect(info.info.durationMs).toBeGreaterThan(300);
      expect(info.info.durationMs).toBeLessThan(400);
    }

    const stereo = wav.slice();
    stereo[22] = 2;
    expect(inspectWav(stereo)).toEqual({ ok: false, reason: "unsupported_audio" });

    const slow = wav.slice();
    slow[24] = 0x40;
    slow[25] = 0x1f;
    slow[26] = 0;
    slow[27] = 0;
    expect(inspectWav(slow)).toEqual({ ok: false, reason: "unsupported_audio" });
    expect(languageBiasFor("en")).toEqual(["English"]);
    expect(languageBiasFor("sw")).toEqual(["Swahili", "English"]);
  });

  it("appends a transcript into the context field Muse already reads", () => {
    const context = appendToContext(emptyFarmerContext(), "weather", "  dry for three days ");
    expect(context.weather).toBe("dry for three days");
    expect(context.notes).toBe("");
    const again = appendToContext(context, "weather", "watered yesterday");
    expect(again.weather).toBe("dry for three days watered yesterday");
    expect(appendToContext(context, "stage", "").stage).toBe("");
  });

  it("returns a demo sentence without calling Meta when mock mode is on", async () => {
    process.env.MOCK_META = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await transcribeContextAudio(tone(), "sw");
    expect(result.locale).toBe("sw");
    expect(result.transcript).toContain("miezi");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads PUSH_TO_TALK WAV and retries English when a Swahili bias is rejected", async () => {
    process.env.MOCK_META = "0";
    process.env.MODEL_API_KEY = "k".repeat(40);
    const calls: { bias: string; encoding: string; mode: string; model: string; riff: boolean }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const form = init.body as FormData;
        const request = JSON.parse(await (form.get("request") as Blob).text()) as {
          model: string;
          audioEncoding: string;
          mode: string;
          languageBias: string[];
        };
        const audio = new Uint8Array(await (form.get("audio") as Blob).arrayBuffer());
        calls.push({
          bias: request.languageBias.join(","),
          encoding: request.audioEncoding,
          mode: request.mode,
          model: request.model,
          riff: audio[0] === 0x52 && audio[1] === 0x49,
        });
        if (calls.length === 1) return new Response(JSON.stringify({ error: { code: "invalid_request" } }), { status: 400 });
        return Response.json({ transcript: "Nimemwagilia jana.", audioDurationMs: 900, turns: [] });
      }),
    );

    const result = await transcribeContextAudio(tone(), "sw");
    expect(result.transcript).toBe("Nimemwagilia jana.");
    expect(calls).toEqual([
      { bias: "Swahili,English", encoding: "WAV", mode: "PUSH_TO_TALK", model: VOICE_MODEL, riff: true },
      { bias: "English", encoding: "WAV", mode: "PUSH_TO_TALK", model: VOICE_MODEL, riff: true },
    ]);
    const auth = (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(auth.Authorization).toBe(`Bearer ${"k".repeat(40)}`);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe("https://api.meta.ai/v1/asr/transcribe");
  });

  it("says voice is unavailable when the model id is missing", async () => {
    process.env.MOCK_META = "0";
    process.env.MODEL_API_KEY = "k".repeat(40);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "model_not_found" } }), { status: 404 })),
    );
    await expect(transcribeContextAudio(tone(), "en")).rejects.toMatchObject({ code: "voice_unavailable" });
  });

  it("serves the transcript from the route and rejects a note that is not WAV", async () => {
    process.env.MOCK_META = "1";
    const form = new FormData();
    form.set("locale", "en");
    form.set("audio", new File([wavBlob(tone())], "note.wav", { type: "audio/wav" }));
    const response = await POST(new Request("http://localhost/api/transcribe", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { transcript: string };
    expect(body.transcript).toContain("watered yesterday");

    const bad = new FormData();
    bad.set("audio", new File([wavBlob(Uint8Array.from([1, 2, 3, 4]), "audio/webm")], "note.webm", { type: "audio/webm" }));
    const rejected = await POST(new Request("http://localhost/api/transcribe", { method: "POST", body: bad }));
    expect(rejected.status).toBe(415);
    const error = (await rejected.json()) as { error: string };
    expect(error.error).toBe("unsupported_audio");
    expect(error).not.toHaveProperty("actions");
  });
});

function tone(): Uint8Array {
  const samples = new Float32Array(8_000);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.sin(index / 12) * 0.2;
  return pcm16Wav(samples, 16_000, 16_000);
}
