import { pcm16Wav } from "@/lib/voice";

const MAX_MS = 45_000;

export function canRecordVoice(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof AudioContext !== "undefined";
}

/** Start a voice note from a tap so the AudioContext is allowed to start. Call stop() on the next tap. */
export function startVoiceRecorder(audio: AudioContext): { stop: () => void; result: Promise<Uint8Array> } {
  let endCapture = () => {};
  const result = capture(audio, (end) => {
    endCapture = end;
  });
  return {
    stop: () => endCapture(),
    result,
  };
}

async function capture(audio: AudioContext, bindStop: (end: () => void) => void): Promise<Uint8Array> {
  if (typeof audio.createScriptProcessor !== "function") throw new Error("unsupported");
  let release = () => {};
  let stopped = false;
  bindStop(() => {
    stopped = true;
    release();
  });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  if (stopped) {
    for (const track of stream.getTracks()) track.stop();
    throw new Error("empty");
  }
  const source = audio.createMediaStreamSource(stream);
  const processor = audio.createScriptProcessor(4096, 1, 1);
  const gain = audio.createGain();
  gain.gain.value = 0;
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(gain);
  gain.connect(audio.destination);

  let timer = 0;
  try {
    await new Promise<void>((resolve) => {
      release = () => resolve();
      if (stopped) resolve();
      timer = window.setTimeout(resolve, MAX_MS);
    });
  } finally {
    window.clearTimeout(timer);
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    gain.disconnect();
    for (const track of stream.getTracks()) track.stop();
  }

  const rate = audio.sampleRate || 48_000;
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (length < rate / 10) throw new Error("empty");
  const mono = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    mono.set(chunk, offset);
    offset += chunk.length;
  }
  return pcm16Wav(mono, rate, 16_000);
}
