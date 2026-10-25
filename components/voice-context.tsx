"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { canRecordVoice, startVoiceRecorder } from "@/components/voice-capture";
import { appendToContext } from "@/lib/context";
import { wavBlob } from "@/lib/voice";
import type { Copy } from "@/lib/copy";
import { CONTEXT_FIELDS, type ContextField, type FarmerContext, type Locale } from "@/lib/types";

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
  const [field, setField] = useState<ContextField>("notes");
  const [phase, setPhase] = useState<"idle" | "listening" | "writing">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || phase !== "idle") return;
    event.preventDefault();
    if (!canRecordVoice()) {
      setMessage(text.voiceUnsupported);
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer has nothing to capture. pointerup still ends the note.
    }
    const audio = new AudioContext();
    void audio.resume();
    const recorder = startVoiceRecorder(audio);
    stopRef.current = () => {
      recorder.stop();
      stopRef.current = null;
    };
    setPhase("listening");
    setMessage(null);
    const chosen = field;
    void recorder.result
      .then(async (wav) => {
        setPhase("writing");
        const transcript = await sendTranscript(wav, locale);
        if (!transcript) {
          setMessage(text.voiceEmpty);
          return;
        }
        onChange(appendToContext(contextRef.current, chosen, transcript));
      })
      .catch((error: unknown) => {
        const code = error instanceof Error ? error.message : "";
        if (code === "empty") setMessage(text.voiceEmpty);
        else if (code === "unsupported" || code === "NotAllowedError") setMessage(text.voiceUnsupported);
        else setMessage(messageFor(text, code));
      })
      .finally(() => {
        void audio.close();
        setPhase("idle");
        stopRef.current = null;
      });
  }

  function end() {
    stopRef.current?.();
  }

  const label = phase === "listening" ? text.voiceListening : phase === "writing" ? text.voiceWriting : text.voiceHold;

  return (
    <div className="rounded-2xl bg-sand/70 p-3">
      <p className="text-sm font-semibold">{text.voiceInto}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={text.voiceInto}>
        {CONTEXT_FIELDS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={field === item}
            disabled={disabled || phase !== "idle"}
            onClick={() => setField(item)}
            className={`min-h-11 rounded-full px-3 text-sm font-semibold ${
              field === item ? "bg-soil text-paper" : "bg-white text-ink"
            }`}
          >
            {text.contextFields[item]}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || phase === "writing"}
        onPointerDown={begin}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(event) => event.preventDefault()}
        className="mt-3 min-h-12 w-full rounded-2xl bg-soil px-3 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {label}
      </button>
      {message ? (
        <p className="mt-2 text-sm leading-5 text-beet" role="alert">
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
