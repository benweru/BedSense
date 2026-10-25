"use client";

import { useEffect, useRef, useState } from "react";
import { MaskCanvas } from "@/components/mask-canvas";
import { CONCEPTS } from "@/lib/concepts";
import { copy } from "@/lib/copy";
import { HISTORY_LIMIT, rememberCheck } from "@/lib/history";
import { clearHistoryStore, useHistory, useLocale, writeHistory, writeLocale } from "@/lib/phone-store";
import type { AnalyzeResult, HistoryEntry, Locale } from "@/lib/types";

type PreparedPhoto = {
  dataUrl: string;
  width: number;
  height: number;
};

type Phase = "idle" | "preparing" | "analyzing" | "ready" | "error";

export function BedSenseApp() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const history = useHistory();
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "sw" ? "sw" : "en";
  }, [locale]);

  function chooseLocale(next: Locale) {
    writeLocale(next);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPhase("preparing");
    setError(null);
    setResult(null);
    setPreview(null);
    setPrepared(null);
    try {
      const photo = await preparePhoto(file);
      setPrepared(photo);
      setPreview(photo.dataUrl);
      await runCheck(photo);
    } catch {
      setPhase("error");
      setError(text.errorFormat);
    }
  }

  async function runCheck(photo: PreparedPhoto) {
    setPhase("analyzing");
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image: photo.dataUrl,
          locale,
          width: photo.width,
          height: photo.height,
        }),
      });
      const body = (await response.json()) as AnalyzeResult & { error?: string };
      if (!response.ok) {
        setPhase("error");
        setError(body.error === "unsupported_image" || body.error === "image_too_large" ? text.errorFormat : text.errorGeneric);
        return;
      }
      setResult(body);
      setPreview(photo.dataUrl);
      setPhase("ready");
      const thumbnail = await makeThumbnail(photo.dataUrl);
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
    setPreview(entry.thumbnail);
    setPrepared(null);
    setError(null);
    setPhase("ready");
  }

  function clearHistory() {
    clearHistoryStore();
  }

  function reset() {
    setPhase("idle");
    setPreview(null);
    setPrepared(null);
    setResult(null);
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  const busy = phase === "preparing" || phase === "analyzing";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-16 pt-6">
      <header className="flex items-start justify-between gap-3">
        <p className="max-w-[16rem] text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-leaf">{text.kicker}</p>
        <div role="group" aria-label={text.language} className="flex shrink-0 rounded-full bg-sand p-1">
          {(["en", "sw"] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={locale === code}
              onClick={() => chooseLocale(code)}
              className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold ${
                locale === code ? "bg-soil text-paper" : "text-ink"
              }`}
            >
              {code === "en" ? "EN" : "SW"}
            </button>
          ))}
        </div>
      </header>

      <h1 className="mt-4 font-serif text-5xl leading-none tracking-tight">{text.title}</h1>
      <p className="mt-3 text-[1.02rem] leading-6 text-ink/80">{text.lede}</p>

      <ul className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {CONCEPTS.filter((concept) => concept.crop).map((concept) => (
          <li key={concept.id} className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-sm shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: concept.swatch }} />
            <span className="font-semibold">{text.concepts[concept.id]}</span>
            <span className="text-xs uppercase tracking-wide text-ink/55">
              {concept.id === "onion" ? text.primary : text.secondary}
            </span>
          </li>
        ))}
      </ul>

      <section className="mt-5 rounded-[1.6rem] border border-ink/10 bg-white/55 p-3 shadow-[0_10px_30px_rgba(36,48,36,0.05)]">
        {preview ? (
          <MaskCanvas src={preview} alt={text.title} result={result} />
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-leaf/40 bg-sand/50 px-6 text-center">
            <p className="font-serif text-2xl">{text.capture}</p>
            <p className="mt-2 max-w-xs text-sm leading-5 text-ink/70">{text.hint}</p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="min-h-12 rounded-2xl bg-soil px-3 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {text.capture}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
            className="min-h-12 rounded-2xl bg-sand px-3 text-sm font-semibold text-ink disabled:opacity-60"
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
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <input
          ref={libraryRef}
          className="sr-only"
          type="file"
          accept="image/*"
          aria-label={text.upload}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        {busy ? (
          <p className="mt-3 text-sm text-leaf" role="status">
            {phase === "preparing" ? text.preparing : text.analyzing}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-beet" role="alert">
            {error}
          </p>
        ) : null}
        {preview && !busy ? (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={reset} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-leaf">
              {text.retake}
            </button>
            {prepared && phase === "error" ? (
              <button
                type="button"
                onClick={() => void runCheck(prepared)}
                className="min-h-11 rounded-xl px-3 text-sm font-semibold text-soil"
              >
                {text.retry}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {result ? <ResultCard locale={locale} result={result} /> : null}

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">{text.history}</h2>
          {history.length > 0 ? (
            <button type="button" onClick={clearHistory} className="text-sm font-semibold text-leaf">
              {text.clear}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? <p className="mt-2 text-sm text-ink/70">{text.historyEmpty}</p> : null}
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {history.slice(0, HISTORY_LIMIT).map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => restore(entry)}
                className="w-36 overflow-hidden rounded-2xl bg-white text-left shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.thumbnail} alt="" className="h-20 w-full object-cover" />
                <span className="block px-2 py-2 text-xs font-semibold">
                  {entry.result.primaryCrop ? text.concepts[entry.result.primaryCrop] : text.marks}
                  <span className="mt-0.5 block font-normal text-ink/60">{text.levelLabel(entry.result.confidence)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-8 text-xs leading-5 text-ink/60">{text.footer}</footer>
    </main>
  );
}

function ResultCard({ locale, result }: { locale: Locale; result: AnalyzeResult }) {
  const text = copy[locale];
  const score = Math.round(result.confidenceScore * 100);
  return (
    <section className="mt-6 space-y-4" aria-live="polite">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf">
            {result.mode === "mock" ? text.modeMock : text.modeLive}
          </p>
          <h2 className="mt-1 font-serif text-3xl leading-tight">{text.focusLine(result.cropFocus, result.primaryCrop)}</h2>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-xs uppercase tracking-wide text-ink/50">{text.confidence}</span>
          <span className="font-semibold">{text.levelLabel(result.confidence)}</span>
          <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-sand">
            <span className="block h-full bg-onion" style={{ width: `${score}%` }} />
          </span>
        </p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {CONCEPTS.map((concept) => (
          <li key={concept.id} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: concept.swatch }} />
            {text.concepts[concept.id]} {result.counts[concept.id]}
          </li>
        ))}
      </ul>

      {result.masks.length === 0 ? <p className="text-sm text-ink/75">{text.noMasks}</p> : null}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.observations}</h3>
        <ul className="mt-2 space-y-2">
          {result.observations.map((item) => (
            <li key={item} className="rounded-2xl bg-white/80 px-3 py-3 text-sm leading-5">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.actions}</h3>
        <ol className="mt-2 space-y-2">
          {result.actions.map((action, index) => (
            <li key={action} className="flex gap-3 rounded-2xl bg-soil px-3 py-3 text-sm leading-5 text-paper">
              <span className="font-serif text-2xl leading-none text-onion">{index + 1}</span>
              <span>{action}</span>
            </li>
          ))}
        </ol>
      </div>

      <aside className="rounded-2xl border border-beet/30 bg-[#f8ebe7] px-4 py-4">
        <h3 className="font-serif text-xl text-beet">{text.askAgronomist}</h3>
        <p className="mt-1 text-sm leading-5">{result.agronomistCallout}</p>
      </aside>

      {result.note === "local-fallback" ? <p className="text-sm text-ink/70">{text.backupNote}</p> : null}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.beforeYouAct}</h3>
        <p className="mt-2 text-sm leading-5 text-ink/80">{result.disclaimer}</p>
      </div>
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
