import { useEffect, useState } from "react";
import type { Copy } from "@/lib/copy";
import { matchResearch } from "@/lib/research";

export type ReferencePhase = { kind: "empty" } | { kind: "loading" } | { kind: "error" } | { kind: "ready"; image: string };

/**
 * The "what to look for" section: a generated reference illustration for the
 * named suspect. Fetches on mount and on retry; renders nothing without a
 * suspect and symptom to ground the prompt.
 */
export function ReferenceCard({
  plant,
  suspect,
  symptom,
  text,
}: {
  plant: string;
  suspect: string | null;
  symptom: string | null;
  text: Copy;
}) {
  const grounded = Boolean(suspect && symptom && matchResearch(suspect));
  const [phase, setPhase] = useState<ReferencePhase>(() => (grounded ? { kind: "loading" } : { kind: "empty" }));
  const [attempt, setAttempt] = useState(0);
  function retry() {
    setPhase({ kind: "loading" });
    setAttempt((value) => value + 1);
  }
  useEffect(() => {
    if (!suspect || !symptom || !matchResearch(suspect)) return;
    let live = true;
    (async () => {
      try {
        const response = await fetch("/api/illustrate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plant, suspect, symptom }),
        });
        const body = (await response.json()) as { image?: unknown };
        if (!live) return;
        setPhase(
          response.ok && typeof body.image === "string" && body.image ? { kind: "ready", image: body.image } : { kind: "error" },
        );
      } catch {
        if (live) setPhase({ kind: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, [plant, suspect, symptom, attempt]);
  if (!suspect || !symptom || !matchResearch(suspect)) return null;
  return <ReferenceLook text={text} suspect={suspect} phase={phase} onRetry={retry} />;
}

/** Presentational states. The not-your-plant label stays visible in every non-empty state. */
export function ReferenceLook({
  text,
  suspect,
  phase,
  onRetry,
}: {
  text: Copy;
  suspect: string;
  phase: ReferencePhase;
  onRetry: () => void;
}) {
  if (phase.kind === "empty") return null;
  return (
    <section id="reference-look" style={{ animationDelay: "320ms" }} className="rise">
      <h3 className="font-semibold text-2xl leading-[1.04] tracking-[-0.01em] text-paper sm:text-3xl">{text.refTitle}</h3>
      <p className="mt-2 text-base font-semibold leading-6 text-paper">{text.refNotPlant}</p>
      {phase.kind === "loading" ? (
        <div className="mt-4 rounded-xl border border-ink/20 bg-card p-5 sm:p-6" aria-busy="true" aria-label={text.refDrawing}>
          <div className="skeleton h-48 w-full" />
          <p className="mt-3 text-base leading-6 text-mute">{text.refDrawing}</p>
        </div>
      ) : null}
      {phase.kind === "error" ? (
        <div className="mt-4 rounded-xl border border-ink/20 bg-card p-5 sm:p-6">
          <p className="text-base leading-6 text-mute" role="alert">
            {text.refFailed}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="press mt-3 min-h-12 rounded-[10px] border border-ink/20 px-5 text-base font-semibold text-paper"
          >
            {text.refRetry}
          </button>
        </div>
      ) : null}
      {phase.kind === "ready" ? (
        <figure className="mt-4 rounded-xl border border-ink/20 bg-card p-5 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={phase.image} alt={text.refAlt(suspect)} className="w-full rounded-lg border border-ink/10" />
          <figcaption className="mt-3 text-base leading-6 text-mute">{text.refCaption(suspect)}</figcaption>
        </figure>
      ) : null}
    </section>
  );
}
