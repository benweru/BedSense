import type { Locale } from "@/lib/types";

export const VOICE_MODEL = "muse-voice-transcribe-1.0";
export const VOICE_KEYWORDS = ["chili", "pilipili", "onion", "kitunguu", "beetroot", "wilt", "curl"] as const;

const MAX_WAV_BYTES = 32 * 1024 * 1024;
const MAX_DURATION_MS = 10 * 60 * 1000;

export type WavInfo = {
  sampleRate: 16000 | 24000;
  durationMs: number;
  dataBytes: number;
};

export type WavProblem = "unsupported_audio" | "audio_too_large" | "audio_too_long";

/** Languages sent as languageBias. Kiswahili is not in Meta's published voice list, so English stays beside it. */
export function languageBiasFor(locale: Locale): string[] {
  return locale === "sw" ? ["Swahili", "English"] : ["English"];
}

export function wavBlob(bytes: Uint8Array, type = "audio/wav"): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], { type });
}

export function pcm16Wav(samples: Float32Array, inputRate: number, outputRate: 16000 | 24000 = 16000): Uint8Array {
  const mono = inputRate === outputRate ? samples : resampleMono(samples, inputRate, outputRate);
  const pcm = new Int16Array(mono.length);
  for (let index = 0; index < mono.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, mono[index] ?? 0));
    pcm[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return encodePcm16Wav(pcm, outputRate);
}

export function inspectWav(bytes: Uint8Array): { ok: true; info: WavInfo } | { ok: false; reason: WavProblem } {
  if (bytes.length > MAX_WAV_BYTES) return { ok: false, reason: "audio_too_large" };
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WAVE") {
    return { ok: false, reason: "unsupported_audio" };
  }
  let format: { audioFormat: number; channels: number; sampleRate: number; bits: number } | null = null;
  let dataBytes = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, offset + 4);
    const size = readU32(bytes, offset + 4);
    const start = offset + 8;
    if (size < 0 || start + size > bytes.length) return { ok: false, reason: "unsupported_audio" };
    if (id === "fmt " && size >= 16) {
      format = {
        audioFormat: readU16(bytes, start),
        channels: readU16(bytes, start + 2),
        sampleRate: readU32(bytes, start + 4),
        bits: readU16(bytes, start + 14),
      };
    } else if (id === "data") {
      dataBytes = size;
    }
    offset = start + size + (size % 2);
  }
  if (!format || format.audioFormat !== 1 || format.channels !== 1 || format.bits !== 16) {
    return { ok: false, reason: "unsupported_audio" };
  }
  if (format.sampleRate !== 16000 && format.sampleRate !== 24000) return { ok: false, reason: "unsupported_audio" };
  if (dataBytes < 2) return { ok: false, reason: "unsupported_audio" };
  const durationMs = Math.round((dataBytes / 2 / format.sampleRate) * 1000);
  if (durationMs > MAX_DURATION_MS) return { ok: false, reason: "audio_too_long" };
  return { ok: true, info: { sampleRate: format.sampleRate, durationMs, dataBytes } };
}

function resampleMono(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate <= 0 || input.length === 0) return new Float32Array();
  const length = Math.max(1, Math.round((input.length * outputRate) / inputRate));
  const output = new Float32Array(length);
  const step = inputRate / outputRate;
  for (let index = 0; index < length; index += 1) {
    const position = index * step;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const mix = position - left;
    const a = input[left] ?? 0;
    const b = input[right] ?? a;
    output[index] = a + (b - a) * mix;
  }
  return output;
}

function encodePcm16Wav(pcm: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = pcm.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, dataBytes, true);
  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(44 + index * 2, pcm[index] ?? 0, true);
  }
  return bytes;
}

function writeAscii(bytes: Uint8Array, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let text = "";
  for (let index = start; index < end; index += 1) text += String.fromCharCode(bytes[index] ?? 0);
  return text;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}
