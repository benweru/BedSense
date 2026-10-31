"use client";

import { useEffect, useRef, useState } from "react";
import { Waveform } from "@/components/premium";
import { canRecordVoice, startVoiceRecorder } from "@/components/voice-capture";
import { appendToContext, emptyFarmerContext } from "@/lib/context";
import { wavBlob } from "@/lib/voice";
import type { Copy } from "@/lib/copy";
import type { FarmerContext, Locale } from "@/lib/types";
import { UI } from "@/lib/ui-copy";

const BARS = 18;
const HOLD_MS = 350;

/** Hold-to-record with a tap-to-talk fallback. Keyboard click still toggles. */
function useHoldGesture(toggle: () => void, listening: () => boolean) {
  const pressAt = useRef(0);
  return {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      pressAt.current = Date.now();
      toggle();
    },
    onPointerUp: () => {
      if (listening() && pressAt.current && Date.now() - pressAt.current > HOLD_MS) toggle();
      pressAt.current = 0;
    },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) toggle();
    },
  };
}

function useLevels() {
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const push = (level: number) => setLevels((current) => [...current.slice(1), level]);
  const clear = () => setLevels(Array(BARS).fill(0));
  return { levels, push, clear };
}

export function VoiceContext({
  text,
  locale,
  context,
  onChange,
  disabled,
}: {
  text: Copy;
  locale: Locale;
  context: FarmerContext;
  onChange: (next: FarmerContext) => void;
  disabled: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "listening" | "writing">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef(phase);
  const contextRef = useRef(context);
  const wave = useLevels();
  useEffect(() => {
    contextRef.current = context;
  }, [context]);
  useEffect(() => {
    if (disabled && phaseRef.current === "listening") stopRef.current?.();
  }, [disabled]);
  useEffect(() => () => stopRef.current?.(), []);

  function setVoicePhase(next: "idle" | "listening" | "writing") {
    phaseRef.current = next;
    setPhase(next);
  }

  function toggle() {
    if (disabled || phaseRef.current === "writing") return;
    if (phaseRef.current === "listening") {
      stopRef.current?.();
      return;
    }
    if (!canRecordVoice()) {
      setMessage(text.voiceUnsupported);
      return;
    }
    const audio = new AudioContext();
    void audio.resume();
    const recorder = startVoiceRecorder(audio, wave.push);
    stopRef.current = () => {
      recorder.stop();
      stopRef.current = null;
    };
    wave.clear();
    setVoicePhase("listening");
    setMessage(null);
    void recorder.result
      .then(async (wav) => {
        setVoicePhase("writing");
        const transcript = await sendTranscript(wav, locale);
        if (!transcript) {
          setMessage(text.voiceEmpty);
          return;
        }
        const note = appendToContext({ ...emptyFarmerContext(), notes: contextRef.current.notes }, "notes", transcript);
        onChange(note);
      })
      .catch((error: unknown) => {
        const code = error instanceof Error ? error.message : "";
        if (code === "empty") setMessage(text.voiceEmpty);
        else if (code === "unsupported" || code === "NotAllowedError") setMessage(text.voiceUnsupported);
        else setMessage(messageFor(text, code));
      })
      .finally(() => {
        void audio.close();
        setVoicePhase("idle");
        stopRef.current = null;
      });
  }

  const words = UI[locale];
  const gesture = useHoldGesture(toggle, () => phaseRef.current === "listening");
  const label = phase === "listening" ? words.releaseToFinish : phase === "writing" ? text.voiceWriting : text.voiceHold;
  const announcement = phase === "listening" ? text.voiceListening : phase === "writing" ? text.voiceWriting : "";

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <button
        type="button"
        disabled={disabled || phase === "writing"}
        aria-pressed={phase === "listening"}
        aria-label={phase === "idle" ? `${text.voiceHold}. ${words.holdToTalk}` : label}
        {...gesture}
        onContextMenu={(event) => event.preventDefault()}
        className={`press flex min-h-14 w-full touch-none items-center justify-center gap-3 rounded-full px-4 text-base font-semibold select-none disabled:opacity-60 ${
          phase === "listening" ? "bg-[#8ee6b0] text-ink shadow-[0_0_0_6px_rgba(31,157,85,0.25)]" : "bg-soil text-paper"
        }`}
      >
        {phase === "listening" ? <Waveform levels={wave.levels} /> : <MicIcon />}
        <span>{label}</span>
      </button>
      {phase === "idle" ? <p className="mt-2 text-center text-sm text-mute">{words.holdToTalk}</p> : null}
      {message ? (
        <p className="mt-2 text-base leading-6 text-beet" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Tap to talk, then append the transcript to a single note. */
export function VoiceNote({
  locale,
  disabled,
  label,
  listeningLabel,
  onTranscript,
}: {
  locale: Locale;
  disabled: boolean;
  label: string;
  listeningLabel: string;
  onTranscript: (text: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "listening" | "writing">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef(phase);
  const wave = useLevels();
  function setVoicePhase(next: "idle" | "listening" | "writing") {
    phaseRef.current = next;
    setPhase(next);
  }

  useEffect(() => () => stopRef.current?.(), []);

  function toggle() {
    if (disabled || phaseRef.current === "writing") return;
    if (phaseRef.current === "listening") {
      stopRef.current?.();
      return;
    }
    if (!canRecordVoice()) {
      setMessage(locale === "sw" ? "Kivinjari hiki hakiwezi kutumia maikrofoni." : "This browser cannot use the microphone.");
      return;
    }
    const audio = new AudioContext();
    void audio.resume();
    const recorder = startVoiceRecorder(audio, wave.push);
    stopRef.current = () => {
      recorder.stop();
      stopRef.current = null;
    };
    wave.clear();
    setVoicePhase("listening");
    setMessage(null);
    void recorder.result
      .then(async (wav) => {
        setVoicePhase("writing");
        const transcript = await sendTranscript(wav, locale);
        if (transcript) onTranscript(transcript);
        else setMessage(locale === "sw" ? "Hakuna maneno yaliyosikika." : "No words came through.");
      })
      .catch(() => setMessage(locale === "sw" ? "Ujumbe wa sauti haukufika." : "The voice note did not come through."))
      .finally(() => {
        void audio.close();
        setVoicePhase("idle");
        stopRef.current = null;
      });
  }

  const gesture = useHoldGesture(toggle, () => phaseRef.current === "listening");

  return (
    <div>
      <button
        type="button"
        disabled={disabled || phase === "writing"}
        aria-pressed={phase === "listening"}
        {...gesture}
        onContextMenu={(event) => event.preventDefault()}
        className={`press inline-flex min-h-12 touch-none items-center gap-2 rounded-full px-4 text-sm font-semibold select-none disabled:opacity-60 ${phase === "listening" ? "bg-[#8ee6b0] text-ink" : "bg-soil text-paper"}`}
      >
        {phase === "listening" ? <Waveform levels={wave.levels.slice(-10)} /> : <MicIcon />}
        {phase === "listening" ? listeningLabel : phase === "writing" ? "…" : label}
      </button>
      {message ? (
        <p className="mt-2 text-sm text-beet" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" strokeLinecap="round" />
    </svg>
  );
}

async function sendTranscript(wav: Uint8Array, locale: Locale): Promise<string> {
  const form = new FormData();
  form.set("locale", locale);
  form.set("audio", wavBlob(wav), "context.wav");
  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  const body = (await response.json()) as { transcript?: string; error?: string };
  if (!response.ok) throw new Error(body.error ?? "upstream");
  return (body.transcript ?? "").trim();
}

function messageFor(text: Copy, code: string): string {
  if (code === "voice_unavailable" || code === "missing_key") return text.voiceUnavailable;
  return text.voiceFailed;
}
