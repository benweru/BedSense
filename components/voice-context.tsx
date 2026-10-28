"use client";

import { useEffect, useRef, useState } from "react";
import { canRecordVoice, startVoiceRecorder } from "@/components/voice-capture";
import { appendToContext, emptyFarmerContext } from "@/lib/context";
import { wavBlob } from "@/lib/voice";
import type { Copy } from "@/lib/copy";
import type { FarmerContext, Locale } from "@/lib/types";

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
    const recorder = startVoiceRecorder(audio);
    stopRef.current = () => {
      recorder.stop();
      stopRef.current = null;
    };
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

  const label = phase === "listening" ? text.voiceFinish : phase === "writing" ? text.voiceWriting : text.voiceHold;
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
        onClick={toggle}
        onContextMenu={(event) => event.preventDefault()}
        className={`min-h-14 w-full touch-manipulation rounded-2xl px-4 text-base font-semibold select-none disabled:opacity-60 ${
          phase === "listening" ? "bg-[#f6b23a] text-ink shadow-[inset_0_0_0_2px_#c56a00]" : "bg-soil text-paper"
        }`}
      >
        {label}
      </button>
      {message ? (
        <p className="mt-2 text-base leading-6 text-beet" role="alert">
          {message}
        </p>
      ) : null}
    </div>
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
