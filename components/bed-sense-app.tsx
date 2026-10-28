"use client";

import { useEffect, useRef, useState } from "react";
import { MaskCanvas } from "@/components/mask-canvas";
import { VoiceContext } from "@/components/voice-context";
import { CONCEPTS } from "@/lib/concepts";
import { NOTES_LIMIT, contextIsEmpty, emptyFarmerContext } from "@/lib/context";
import { copy, type Copy } from "@/lib/copy";
import { HISTORY_LIMIT, rememberCheck } from "@/lib/history";
import { parseFarmerPlant } from "@/lib/plant-name";
import { clearHistoryStore, useHistory, useLocale, writeHistory, writeLocale } from "@/lib/phone-store";
import {
  QUALITY_BANDS,
  type AnalyzeResult,
  type ChemicalAdvice,
  type FarmerContext,
  type HistoryEntry,
  type Locale,
  type ShopOffer,
} from "@/lib/types";

type PreparedPhoto = {
  dataUrl: string;
  width: number;
  height: number;
};

type Phase = "idle" | "preparing" | "analyzing" | "ready" | "error";

export function BedSenseApp() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const plantRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const history = useHistory();
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [frame, setFrame] = useState(0);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<FarmerContext>(emptyFarmerContext);
  const [contextOpen, setContextOpen] = useState(false);
  const [plantName, setPlantName] = useState("");
  const [plantError, setPlantError] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const text = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "sw" ? "sw" : "en";
  }, [locale]);

  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = window.setTimeout(() => setProgressStep(2), 4000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function chooseLocale(next: Locale) {
    writeLocale(next);
  }

  async function onFiles(list: FileList | undefined, mode: "replace" | "append") {
    const incoming = [...(list ?? [])];
    if (incoming.length === 0) return;
    const room = mode === "append" ? Math.max(0, 3 - photos.length) : 3;
    if (room === 0) {
      setError(text.photoLimit);
      return;
    }
    const chosen = incoming.slice(0, room);
    const overflow = incoming.length > room;
    setProgressStep(0);
    setPhase("preparing");
    setError(overflow ? text.photoLimit : null);
    setResult(null);
    try {
      const made: PreparedPhoto[] = [];
      for (const file of chosen) made.push(await preparePhoto(file));
      const next = mode === "append" ? [...photos, ...made].slice(0, 3) : made;
      const shown = mode === "append" ? photos.length : 0;
      setPhotos(next);
      setFrame(shown);
      setPreview(next[shown]?.dataUrl ?? next[0]?.dataUrl ?? null);
      if (!parseFarmerPlant(plantName)) {
        setPlantError(true);
        setPhase("idle");
        plantRef.current?.focus();
        return;
      }
      setPlantError(false);
      if (mode === "replace" && next.length === 1) await runCheck(next);
      else setPhase("idle");
    } catch {
      setPhase("error");
      setError(text.errorFormat);
    }
  }

  async function submitPrepared() {
    if (photos.length === 0) return;
    if (!parseFarmerPlant(plantName)) {
      setPlantError(true);
      plantRef.current?.focus();
      return;
    }
    setPlantError(false);
    await runCheck(photos);
  }

  async function runCheck(batch: PreparedPhoto[]) {
    const named = parseFarmerPlant(plantName);
    if (!named) {
      setPlantError(true);
      setPhase("idle");
      plantRef.current?.focus();
      return;
    }
    setProgressStep(1);
    setPhase("analyzing");
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image: batch[0]?.dataUrl,
          images: batch.map((photo) => photo.dataUrl),
          locale,
          width: batch[0]?.width,
          height: batch[0]?.height,
          context: { ...emptyFarmerContext(), notes: context.notes },
          plantName: named,
        }),
      });
      const body = (await response.json()) as AnalyzeResult & { error?: string };
      if (!response.ok) {
        if (body.error === "missing_plant") {
          setPlantError(true);
          setPhase("idle");
          setError(text.plantNameMissing);
          plantRef.current?.focus();
          return;
        }
        setPhase("error");
        setError(
          body.error === "unsupported_image" || body.error === "image_too_large"
            ? text.errorFormat
            : body.error === "muse_unavailable"
              ? text.museUnavailable
              : text.errorGeneric,
        );
        return;
      }
      setResult(body);
      if (body.contextAsk) {
        setContextOpen(true);
        window.requestAnimationFrame(() => {
          document.getElementById("home-context")?.scrollIntoView({ block: "nearest" });
        });
      }
      setPreview(batch[frame]?.dataUrl ?? batch[0]?.dataUrl ?? null);
      setPhase("ready");
      const thumbnail = await makeThumbnail(batch[0]?.dataUrl ?? "");
      const entry: HistoryEntry = {
        id: body.id,
        createdAt: body.createdAt,
        thumbnail,
        result: body,
      };
      writeHistory(rememberCheck(history, entry));
    } catch {
      setPhase("error");
      setError(text.errorGeneric);
    }
  }

  function restore(entry: HistoryEntry) {
    setResult(entry.result);
    if (entry.result.farmerPlant) setPlantName(entry.result.farmerPlant);
    if (entry.result.contextAsk) setContextOpen(true);
    setPreview(entry.thumbnail);
    setPhotos([]);
    setFrame(0);
    setError(null);
    setPhase("ready");
  }

  function clearHistory() {
    clearHistoryStore();
  }

  function reset() {
    setPhase("idle");
    setPreview(null);
    setPhotos([]);
    setFrame(0);
    setResult(null);
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  const busy = phase === "preparing" || phase === "analyzing";

  return (
    <main className={`mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-5 sm:px-6 sm:pt-8 lg:max-w-6xl lg:px-8 ${photos.length > 0 && !busy ? "pb-32" : "pb-12"}`}>
      <header className="flex items-start justify-between gap-4">
        <p className="max-w-[13rem] text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-leaf sm:max-w-xl sm:text-[0.8rem]">{text.kicker}</p>
        <div role="group" aria-label={text.language} className="flex shrink-0 rounded-full bg-sand p-1">
          {(["en", "sw"] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={locale === code}
              onClick={() => chooseLocale(code)}
              className={`min-h-11 min-w-11 rounded-full px-3.5 text-sm font-semibold ${
                locale === code ? "bg-soil text-paper" : "text-ink"
              }`}
            >
              {code === "en" ? "EN" : "SW"}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5 sm:mt-6">
        <h1 className="font-serif text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">{text.title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink/80 sm:text-lg">{text.lede}</p>
      </div>

      <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="min-w-0 space-y-5">
      <div id="home-plant-name">
        <label htmlFor="plant-name" className="block text-base font-semibold">
          {text.plantNameLabel}
        </label>
        <input
          ref={plantRef}
          id="plant-name"
          name="plantName"
          value={plantName}
          required
          autoComplete="off"
          placeholder={text.plantNamePlaceholder}
          aria-invalid={plantError || undefined}
          aria-describedby="plant-name-hint"
          onChange={(event) => {
            setPlantName(event.target.value);
            if (parseFarmerPlant(event.target.value)) setPlantError(false);
          }}
          className="mt-2 min-h-14 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base"
        />
        <p id="plant-name-hint" className="mt-2 text-sm leading-6 text-ink/70 sm:text-base">
          {text.plantNameHint}
        </p>
        {plantError ? (
          <p className="mt-2 text-base leading-6 text-beet" role="alert">
            {text.plantNameMissing}
          </p>
        ) : null}
      </div>

      <ContextForm
        text={text}
        locale={locale}
        context={context}
        onChange={setContext}
        disabled={busy}
        open={contextOpen}
        onOpenChange={setContextOpen}
        canUpdate={Boolean(result) && photos.length > 0}
        onUpdate={() => {
          if (photos.length > 0) void runCheck(photos);
        }}
        ask={result?.contextAsk ?? null}
      />

      <section className="rounded-[1.6rem] border border-ink/10 bg-white/70 p-4 shadow-[0_10px_30px_rgba(36,48,36,0.05)] sm:p-5">
        {preview ? (
          <MaskCanvas
            src={photos[frame]?.dataUrl ?? preview}
            alt={text.title}
            result={result}
            frame={photos.length > 0 ? frame : 0}
            width={photos[frame]?.width}
            height={photos[frame]?.height}
          />
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-leaf/40 bg-sand/60 px-6 py-10 text-center">
            <p className="font-serif text-3xl leading-tight">{text.capture}</p>
            <p className="mt-3 max-w-xs text-base leading-6 text-ink/75">{text.hint}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="min-h-14 rounded-2xl bg-soil px-3 text-base font-semibold leading-tight text-paper disabled:opacity-60"
          >
            {text.capture}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
            className="min-h-14 rounded-2xl bg-sand px-3 text-base font-semibold leading-tight text-ink disabled:opacity-60"
          >
            {text.upload}
          </button>
        </div>
        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label={text.capture}
          onChange={(event) => {
            void onFiles(event.target.files ?? undefined, "replace");
            event.target.value = "";
          }}
        />
        <input
          ref={libraryRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          aria-label={text.upload}
          onChange={(event) => {
            void onFiles(event.target.files ?? undefined, "replace");
            event.target.value = "";
          }}
        />
        <input
          ref={addRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          aria-label={text.addAngle}
          onChange={(event) => {
            void onFiles(event.target.files ?? undefined, "append");
            event.target.value = "";
          }}
        />
        {photos.length > 0 ? (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {photos.map((photo, index) => (
              <div key={`${photo.width}x${photo.height}-${index}`} className="w-20 shrink-0">
                <button
                  type="button"
                  aria-pressed={frame === index}
                  onClick={() => {
                    setFrame(index);
                    setPreview(photo.dataUrl);
                  }}
                  className={`block overflow-hidden rounded-xl border-2 ${frame === index ? "border-leaf" : "border-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.dataUrl} alt="" className="h-20 w-20 object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = photos.filter((_, item) => item !== index);
                    setPhotos(next);
                    const shown = Math.min(frame, Math.max(0, next.length - 1));
                    setFrame(shown);
                    setPreview(next[shown]?.dataUrl ?? null);
                    if (next.length === 0) setResult(null);
                  }}
                  className="mt-1 min-h-11 w-full text-sm font-semibold text-leaf"
                >
                  {text.removePhoto}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {photos.length > 0 && photos.length < 3 && !busy ? (
          <button
            type="button"
            onClick={() => addRef.current?.click()}
            className="mt-3 min-h-14 w-full rounded-2xl bg-sand px-4 text-base font-semibold text-ink"
          >
            {text.addAngle}
          </button>
        ) : null}
        {busy ? <CheckProgress text={text} step={progressStep} /> : null}
        {error ? (
          <p className="mt-3 text-base leading-6 text-beet" role="alert">
            {error}
          </p>
        ) : null}
        {preview && !busy ? (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={reset} className="min-h-12 rounded-xl px-3 text-base font-semibold text-leaf">
              {text.retake}
            </button>
            {photos.length > 0 && phase === "error" ? (
              <button
                type="button"
                onClick={() => void runCheck(photos)}
                className="min-h-12 rounded-xl px-3 text-base font-semibold text-soil"
              >
                {text.retry}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
      </div>

      <div className="mt-8 flex min-w-0 flex-col gap-6 lg:mt-0">
      {result && !busy ? <ResultCard locale={locale} result={result} /> : null}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{text.history}</h2>
          {history.length > 0 ? (
            <button type="button" onClick={clearHistory} className="min-h-11 px-2 text-base font-semibold text-leaf">
              {text.clear}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? <p className="mt-2 text-base leading-6 text-ink/70">{text.historyEmpty}</p> : null}
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible">
          {history.slice(0, HISTORY_LIMIT).map((entry) => (
            <li key={entry.id} className="shrink-0">
              <button
                type="button"
                onClick={() => restore(entry)}
                className="w-44 overflow-hidden rounded-2xl bg-white text-left shadow-sm lg:w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.thumbnail} alt="" className="h-28 w-full object-cover" />
                <span className="block px-3 py-3 text-sm font-semibold leading-5">
                  {entry.result.farmerPlant ||
                    entry.result.detectedPlant ||
                    (entry.result.primaryCrop ? text.concepts[entry.result.primaryCrop] : text.marks)}
                  <span className="mt-1 block font-normal text-ink/60">{text.levelLabel(entry.result.confidence)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      </div>
      </div>

      <footer className="mt-8 text-sm leading-6 text-ink/60">{text.footer}</footer>
      {photos.length > 0 && !busy ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/95 pt-3 shadow-[0_-10px_30px_rgba(36,48,36,0.12)] backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-xl px-4 sm:px-6 lg:max-w-6xl lg:px-8">
            <button
              type="button"
              onClick={() => void submitPrepared()}
              className="min-h-14 w-full rounded-2xl bg-soil px-4 text-base font-semibold text-paper lg:max-w-[28rem]"
            >
              {photos.length > 1 ? text.checkPhotos : text.checkPhoto}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ResultCard({ locale, result }: { locale: Locale; result: AnalyzeResult }) {
  const text = copy[locale];
  const score = Math.round(result.confidenceScore * 100);
  const pair = (result.likelyCauses?.length ?? 0) > 0 && (result.mitigations?.length ?? 0) > 0;
  return (
    <section id="result" className="space-y-4 lg:space-y-5" aria-live="polite">
      {result.qualityNote ? (
        <p id="quality-note" className="rounded-2xl bg-[#f6b23a] px-4 py-3 text-base font-semibold leading-6 text-ink" role="status">
          {result.qualityNote}
        </p>
      ) : null}
      {result.qualityHold ? (
        <div id="quality-hold" className="rounded-[1.5rem] border-2 border-[#c56a00] bg-[#fff4dc] px-5 py-5" role="status">
          <p className="font-serif text-2xl leading-tight text-soil sm:text-3xl">{result.qualityMessage}</p>
        </div>
      ) : (
      <div id="result-reading" className="space-y-4 lg:space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex min-h-8 items-center rounded-full bg-[#f6b23a] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink">
            {result.mode === "mock" ? text.modeMock : text.modeLive}
          </p>
          <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">
            {text.plantLine({
              detectedPlant: result.detectedPlant,
              cropFocus: result.cropFocus,
              primaryCrop: result.primaryCrop,
            })}
          </h2>
        </div>
        <p className="shrink-0 sm:text-right">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink/50">{text.confidence}</span>
          <span className="text-base font-semibold">{text.levelLabel(result.confidence)}</span>
          <span className="mt-1.5 block h-2 w-24 overflow-hidden rounded-full bg-sand">
            <span className="block h-full bg-onion" style={{ width: `${score}%` }} />
          </span>
        </p>
      </div>

      <section id="result-stands-out" className="overflow-hidden rounded-[1.5rem] border border-[#c8881a]/50 bg-white shadow-sm">
        <div className="border-b border-[#c8881a]/30 bg-[#f8e7c4] px-4 py-4 sm:px-5">
          <h3 className="font-serif text-2xl leading-tight text-soil sm:text-3xl">{text.observations}</h3>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          {result.masks.length === 0 ? <p className="text-base leading-6 text-ink/75">{text.noMasks}</p> : null}
          {CONCEPTS.some((concept) => result.counts[concept.id] > 0) ? (
            <ul className="flex flex-wrap gap-2">
              {CONCEPTS.filter((concept) => result.counts[concept.id] > 0).map((concept) => (
                <li key={concept.id} className="flex min-h-10 items-center gap-2 rounded-full bg-sand px-3 py-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: concept.swatch }} />
                  {text.concepts[concept.id]} {result.counts[concept.id]}
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="space-y-3">
            {result.observations.map((item) => (
              <li key={item} className="border-l-4 border-[#e0941a] bg-paper px-4 py-3 text-base leading-7">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {pair ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AdviceList id="result-causes" title={text.likelyCauses} hint={text.likelyCausesHint} items={result.likelyCauses ?? []} />
          <AdviceList id="result-mitigation" title={text.mitigations} hint={text.mitigationsHint} items={result.mitigations ?? []} />
        </div>
      ) : (
        <>
          <AdviceList id="result-causes" title={text.likelyCauses} hint={text.likelyCausesHint} items={result.likelyCauses ?? []} />
          <AdviceList id="result-mitigation" title={text.mitigations} hint={text.mitigationsHint} items={result.mitigations ?? []} />
        </>
      )}

      <div id="result-checks" className="rounded-[1.5rem] bg-white/85 p-4 shadow-sm sm:p-5">
        <h3 className="font-serif text-2xl leading-tight text-soil sm:text-3xl">{text.actions}</h3>
        <p className="mt-2 text-base leading-6 text-ink/70">{text.actionsHint}</p>
        <ol className="mt-4 space-y-3">
          {result.actions.map((action, index) => (
            <li key={action} className="flex items-start gap-3 rounded-2xl bg-paper px-3 py-3 ring-1 ring-ink/10 sm:px-4 sm:py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soil font-serif text-xl text-onion">
                {index + 1}
              </span>
              <span className="pt-1.5 text-base leading-7">{action}</span>
            </li>
          ))}
        </ol>
      </div>
      </div>
      )}

      {result.chemicals ? <ChemicalCard text={text} advice={result.chemicals} /> : null}

      <aside className="rounded-2xl border border-beet/30 bg-[#f8ebe7] px-4 py-4 sm:px-5">
        <h3 className="font-serif text-2xl leading-tight text-beet">{text.askAgronomist}</h3>
        <p className="mt-2 text-base leading-7">{result.agronomistCallout}</p>
      </aside>

      {result.note === "local-fallback" ? <p className="text-base leading-6 text-ink/70">{text.backupNote}</p> : null}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.beforeYouAct}</h3>
        <p className="mt-2 text-base leading-7 text-ink/80">{result.disclaimer}</p>
      </div>
    </section>
  );
}

function CheckProgress({ text, step }: { text: Copy; step: number }) {
  const clamped = Math.min(2, Math.max(0, step));
  return (
    <div id="check-progress" className="mt-4 rounded-[1.5rem] border-2 border-[#c56a00] bg-[#fff4dc] px-4 py-5 shadow-sm" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-[#f0d7a4] border-t-[#c56a00]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#c56a00]" />
        </span>
        <span>
          <span className="block font-serif text-2xl leading-tight text-soil">{text.progressTitle}</span>
          <span className="mt-1 block text-base leading-6 text-ink/70">{text.progressHint}</span>
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sand">
        <div className="bedsense-indeterminate h-full w-1/2 rounded-full bg-[#e0941a]" />
      </div>
      <ol className="mt-4 space-y-2">
        {text.progressSteps.map((label, index) => {
          const state = index < clamped ? "done" : index === clamped ? "active" : "wait";
          return (
            <li key={label} className="flex min-h-11 items-center gap-3 text-base" aria-current={state === "active" ? "step" : undefined}>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "wait" ? "bg-sand text-ink/40" : "bg-soil text-onion"
                } ${state === "active" ? "animate-pulse" : ""}`}
              >
                {index + 1}
              </span>
              <span className={state === "wait" ? "text-ink/45" : "font-semibold"}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AdviceList({ id, title, hint, items }: { id: string; title: string; hint: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div id={id} className="rounded-[1.5rem] bg-white/85 p-4 shadow-sm sm:p-5">
      <h3 className="font-serif text-2xl leading-tight text-soil sm:text-3xl">{title}</h3>
      <p className="mt-2 text-base leading-6 text-ink/70">{hint}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="rounded-2xl bg-paper px-4 py-3 text-base leading-7 ring-1 ring-ink/10">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChemicalCard({ text, advice }: { text: Copy; advice: ChemicalAdvice }) {
  return (
    <div className="space-y-4">
      <div id="result-chemicals" className="rounded-[1.5rem] border border-leaf/25 bg-white/85 px-4 py-5 sm:px-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.chemicalsTitle}</h3>
        <p className="mt-2 text-base leading-7">
          <span className="font-semibold">{text.chemicalsSuspect}. </span>
          {advice.suspect}
        </p>
        <p className="mt-2 text-base leading-7 text-ink/80">{advice.verifyNote}</p>
        <ul className="mt-4 space-y-3">
          {advice.products.map((product) => (
            <li key={product.activeIngredient} className="rounded-2xl bg-sand/60 px-4 py-3">
              <p className="text-base font-semibold">{product.activeIngredient}</p>
              <p className="text-sm leading-6 text-ink/70">{product.productClass}</p>
              <p className="mt-1 text-base leading-7">{product.useNote}</p>
            </li>
          ))}
        </ul>
      </div>

      <div id="result-shops" className="rounded-[1.5rem] border border-leaf/25 bg-white/85 px-4 py-5 sm:px-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.chemicalsWhere}</h3>
        <ul className="mt-3 space-y-3">
          {advice.products.map((product) => (
            <li key={product.activeIngredient} className="rounded-2xl bg-sand/60 px-4 py-3">
              <p className="text-base font-semibold">{product.activeIngredient}</p>
              {product.offers.length === 0 ? <p className="mt-1 text-base leading-6">{text.chemicalsNoShop}</p> : null}
              <ul className="mt-2 space-y-2">
                {orderedOffers(product.offers).map((offer) => (
                  <li key={`${product.activeIngredient}-${offer.quality}-${offer.brand}`} className="rounded-xl bg-white px-3 py-3 text-base leading-6">
                    <span className="font-semibold">{text.quality[offer.quality]}</span>
                    <span className="text-ink/70"> · {offer.brand} · {offer.pack}</span>
                    <span className="mt-0.5 block">
                      {offer.shopName} · {offer.shopKind} · {offer.place}
                    </span>
                    <span className="mt-0.5 block font-semibold">{kesRange(offer.priceMinKes, offer.priceMaxKes)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-base leading-6 text-ink/70">{advice.priceNote}</p>
      </div>
    </div>
  );
}

function orderedOffers(offers: readonly ShopOffer[]): ShopOffer[] {
  return [...offers].sort((a, b) => QUALITY_BANDS.indexOf(a.quality) - QUALITY_BANDS.indexOf(b.quality));
}

function kesRange(min: number, max: number): string {
  const format = new Intl.NumberFormat("en-KE");
  return `KES ${format.format(min)}–${format.format(max)}`;
}

function ContextForm({
  text,
  locale,
  context,
  onChange,
  disabled,
  open,
  onOpenChange,
  canUpdate,
  onUpdate,
  ask,
}: {
  text: Copy;
  locale: Locale;
  context: FarmerContext;
  onChange: (next: FarmerContext) => void;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpdate: boolean;
  onUpdate: () => void;
  ask: string | null;
}) {
  const preview = context.notes.replace(/\s+/g, " ").trim();
  const filled = preview.length > 0;
  const previewText = preview.length > 90 ? `${preview.slice(0, 89).trimEnd()}…` : preview;
  return (
    <section id="home-context" className="rounded-[1.5rem] border border-ink/10 bg-white/75 p-4 sm:p-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="context-panel"
        onClick={() => onOpenChange(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span id="context-title" className="block text-base font-semibold">
            {text.contextTitle}
          </span>
          {open ? null : (
            <span className="mt-1 block text-base leading-6 text-ink/70">{filled ? previewText : text.contextHint}</span>
          )}
        </span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand text-lg font-semibold text-leaf">
          {open ? "–" : "+"}
        </span>
      </button>
      {ask ? (
        <p className="mt-3 rounded-2xl bg-[#f8ebe7] px-4 py-3 text-base leading-6" role="status">
          <span className="block font-semibold text-beet">{text.contextAskLabel}</span>
          {ask}
        </p>
      ) : null}
      {open ? (
        <div id="context-panel" className="mt-4 space-y-3">
          <textarea
            id="context-notes"
            value={context.notes}
            disabled={disabled}
            rows={4}
            maxLength={NOTES_LIMIT}
            aria-labelledby="context-title"
            aria-describedby="context-guide"
            onChange={(event) => onChange({ ...emptyFarmerContext(), notes: event.target.value })}
            className="min-h-32 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-base leading-7 font-normal"
          />
          <p id="context-guide" className="text-base leading-7 text-ink/75">
            {text.contextGuide}
          </p>
          <VoiceContext text={text} locale={locale} context={context} onChange={onChange} disabled={disabled} />
          {canUpdate ? (
            <button
              type="button"
              disabled={disabled || contextIsEmpty(context)}
              onClick={onUpdate}
              className="min-h-14 w-full rounded-2xl bg-leaf px-4 text-base font-semibold text-paper disabled:opacity-60"
            >
              {text.contextUpdate}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    throw new Error("format");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("format");
    context.drawImage(bitmap, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), width, height };
  } finally {
    bitmap.close();
  }
}

async function makeThumbnail(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const width = 280;
  const height = Math.max(1, Math.round((image.naturalHeight / Math.max(1, image.naturalWidth)) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("format"));
    image.src = src;
  });
}
