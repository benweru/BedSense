"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MaskCanvas } from "@/components/mask-canvas";
import { VoiceContext } from "@/components/voice-context";
import { CONCEPTS } from "@/lib/concepts";
import { contextIsEmpty, emptyFarmerContext } from "@/lib/context";
import { copy, type Copy } from "@/lib/copy";
import { HISTORY_LIMIT, rememberCheck } from "@/lib/history";
import { parseFarmerPlant } from "@/lib/plant-name";
import { clearHistoryStore, useHistory, useLocale, writeHistory, writeLocale } from "@/lib/phone-store";
import {
  CONTEXT_FIELDS,
  QUALITY_BANDS,
  type AnalyzeResult,
  type ChemicalAdvice,
  type ContextField,
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
  const plantRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const history = useHistory();
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
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

  async function onFile(file: File | undefined) {
    if (!file) return;
    setProgressStep(0);
    setPhase("preparing");
    setError(null);
    setResult(null);
    setPreview(null);
    setPrepared(null);
    try {
      const photo = await preparePhoto(file);
      setPrepared(photo);
      setPreview(photo.dataUrl);
      if (!parseFarmerPlant(plantName)) {
        setPlantError(true);
        setPhase("idle");
        plantRef.current?.focus();
        return;
      }
      setPlantError(false);
      await runCheck(photo);
    } catch {
      setPhase("error");
      setError(text.errorFormat);
    }
  }

  async function submitPrepared() {
    if (!prepared) return;
    if (!parseFarmerPlant(plantName)) {
      setPlantError(true);
      plantRef.current?.focus();
      return;
    }
    setPlantError(false);
    await runCheck(prepared);
  }

  async function runCheck(photo: PreparedPhoto) {
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
          image: photo.dataUrl,
          locale,
          width: photo.width,
          height: photo.height,
          context,
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
      if (body.contextAsk) setContextOpen(true);
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
    if (entry.result.farmerPlant) setPlantName(entry.result.farmerPlant);
    if (entry.result.contextAsk) setContextOpen(true);
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

      <div id="home-plant-name" className="mt-5">
        <label htmlFor="plant-name" className="block text-sm font-semibold">
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
          className="mt-2 min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-3 text-base"
        />
        <p id="plant-name-hint" className="mt-2 text-sm leading-5 text-ink/70">
          {text.plantNameHint}
        </p>
        {plantError ? (
          <p className="mt-2 text-sm text-beet" role="alert">
            {text.plantNameMissing}
          </p>
        ) : null}
        {prepared && !busy ? (
          <button
            type="button"
            onClick={() => void submitPrepared()}
            className="mt-3 min-h-12 w-full rounded-2xl bg-leaf px-3 text-sm font-semibold text-paper"
          >
            {text.checkPhoto}
          </button>
        ) : null}
      </div>

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
        {busy ? <CheckProgress text={text} step={progressStep} /> : null}
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

      {result && !busy ? (
        <ResultCard
          locale={locale}
          result={result}
          contextSlot={
            <ContextForm
              text={text}
              locale={locale}
              context={context}
              onChange={setContext}
              disabled={busy}
              open={contextOpen}
              onOpenChange={setContextOpen}
              canUpdate={Boolean(prepared)}
              onUpdate={() => {
                if (prepared) void runCheck(prepared);
              }}
              ask={result.contextAsk}
            />
          }
        />
      ) : (
        <ContextForm
          text={text}
          locale={locale}
          context={context}
          onChange={setContext}
          disabled={busy}
          open={contextOpen}
          onOpenChange={setContextOpen}
          canUpdate={false}
          onUpdate={() => undefined}
          ask={null}
        />
      )}

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
                  {entry.result.farmerPlant ||
                    entry.result.detectedPlant ||
                    (entry.result.primaryCrop ? text.concepts[entry.result.primaryCrop] : text.marks)}
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

function ResultCard({
  locale,
  result,
  contextSlot,
}: {
  locale: Locale;
  result: AnalyzeResult;
  contextSlot: ReactNode;
}) {
  const text = copy[locale];
  const score = Math.round(result.confidenceScore * 100);
  return (
    <section id="result" className="mt-6 space-y-4" aria-live="polite">
      <div id="result-reading" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf">
            {result.mode === "mock" ? text.modeMock : text.modeLive}
          </p>
          <h2 className="mt-1 font-serif text-3xl leading-tight">
            {text.plantLine({
              detectedPlant: result.detectedPlant,
              cropFocus: result.cropFocus,
              primaryCrop: result.primaryCrop,
            })}
          </h2>
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
        {CONCEPTS.filter((concept) => result.counts[concept.id] > 0).map((concept) => (
          <li key={concept.id} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: concept.swatch }} />
            {text.concepts[concept.id]} {result.counts[concept.id]}
          </li>
        ))}
      </ul>

      {result.masks.length === 0 ? <p className="text-sm text-ink/75">{text.noMasks}</p> : null}

      <div id="result-stands-out">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.observations}</h3>
        <ul className="mt-3 space-y-2">
          {result.observations.map((item) => (
            <li key={item} className="rounded-2xl bg-white px-3 py-3 text-sm leading-6 shadow-sm">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <AdviceList id="result-causes" title={text.likelyCauses} hint={text.likelyCausesHint} items={result.likelyCauses ?? []} />
      <AdviceList id="result-mitigation" title={text.mitigations} hint={text.mitigationsHint} items={result.mitigations ?? []} />

      <div id="result-checks" className="rounded-[1.4rem] bg-white/80 p-3 shadow-sm">
        <h3 className="font-serif text-2xl leading-none text-soil">{text.actions}</h3>
        <p className="mt-2 text-sm leading-5 text-ink/70">{text.actionsHint}</p>
        <ol className="mt-4 space-y-3">
          {result.actions.map((action, index) => (
            <li key={action} className="flex items-start gap-3 rounded-2xl bg-paper px-3 py-3 ring-1 ring-ink/10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soil font-serif text-xl text-onion">
                {index + 1}
              </span>
              <span className="pt-2 text-[0.95rem] leading-6">{action}</span>
            </li>
          ))}
        </ol>
      </div>
      </div>

      {result.chemicals ? <ChemicalCard text={text} advice={result.chemicals} /> : null}

      {contextSlot}

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

function CheckProgress({ text, step }: { text: Copy; step: number }) {
  const clamped = Math.min(2, Math.max(0, step));
  return (
    <div id="check-progress" className="mt-3 rounded-[1.4rem] bg-white px-3 py-4 shadow-sm" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-sand border-t-leaf" />
          <span className="h-2.5 w-2.5 rounded-full bg-leaf" />
        </span>
        <span>
          <span className="block font-serif text-2xl leading-none text-soil">{text.progressTitle}</span>
          <span className="mt-1 block text-sm leading-5 text-ink/70">{text.progressHint}</span>
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sand">
        <div className="bedsense-indeterminate h-full w-1/2 rounded-full bg-leaf" />
      </div>
      <ol className="mt-4 space-y-2">
        {text.progressSteps.map((label, index) => {
          const state = index < clamped ? "done" : index === clamped ? "active" : "wait";
          return (
            <li key={label} className="flex min-h-11 items-center gap-3 text-sm" aria-current={state === "active" ? "step" : undefined}>
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
    <div id={id} className="rounded-[1.4rem] bg-white/80 p-3 shadow-sm">
      <h3 className="font-serif text-2xl leading-none text-soil">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-ink/70">{hint}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-2xl bg-paper px-3 py-3 text-[0.95rem] leading-6 ring-1 ring-ink/10">
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
      <div id="result-chemicals" className="rounded-[1.4rem] border border-leaf/25 bg-white/80 px-3 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.chemicalsTitle}</h3>
        <p className="mt-2 text-sm leading-5">
          <span className="font-semibold">{text.chemicalsSuspect}. </span>
          {advice.suspect}
        </p>
        <p className="mt-2 text-sm leading-5 text-ink/80">{advice.verifyNote}</p>
        <ul className="mt-3 space-y-3">
          {advice.products.map((product) => (
            <li key={product.activeIngredient} className="rounded-2xl bg-sand/60 px-3 py-3">
              <p className="font-semibold">{product.activeIngredient}</p>
              <p className="text-sm text-ink/70">{product.productClass}</p>
              <p className="mt-1 text-sm leading-5">{product.useNote}</p>
            </li>
          ))}
        </ul>
      </div>

      <div id="result-shops" className="rounded-[1.4rem] border border-leaf/25 bg-white/80 px-3 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/50">{text.chemicalsWhere}</h3>
        <ul className="mt-3 space-y-3">
          {advice.products.map((product) => (
            <li key={product.activeIngredient} className="rounded-2xl bg-sand/60 px-3 py-3">
              <p className="font-semibold">{product.activeIngredient}</p>
              {product.offers.length === 0 ? <p className="mt-1 text-sm leading-5">{text.chemicalsNoShop}</p> : null}
              <ul className="mt-2 space-y-2">
                {orderedOffers(product.offers).map((offer) => (
                  <li key={`${product.activeIngredient}-${offer.quality}-${offer.brand}`} className="rounded-xl bg-white px-3 py-2 text-sm leading-5">
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
        <p className="mt-3 text-sm leading-5 text-ink/70">{advice.priceNote}</p>
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
  function setField(field: ContextField, value: string) {
    onChange({ ...context, [field]: value });
  }

  return (
    <section className="mt-4 rounded-[1.4rem] border border-ink/10 bg-white/70 p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block font-semibold">{text.contextTitle}</span>
          <span className="mt-0.5 block text-sm leading-5 text-ink/70">{text.contextHint}</span>
        </span>
        <span className="text-sm font-semibold text-leaf">{open ? "–" : "+"}</span>
      </button>
      {ask ? (
        <p className="mt-3 rounded-2xl bg-[#f8ebe7] px-3 py-3 text-sm leading-5" role="status">
          <span className="block font-semibold text-beet">{text.contextAskLabel}</span>
          {ask}
        </p>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-3">
          <VoiceContext text={text} locale={locale} context={context} onChange={onChange} disabled={disabled} />
          {CONTEXT_FIELDS.map((field) => (
            <label key={field} className="block text-sm font-semibold">
              {text.contextFields[field]}
              {field === "notes" ? (
                <textarea
                  value={context[field]}
                  disabled={disabled}
                  rows={3}
                  onChange={(event) => setField(field, event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-normal"
                />
              ) : (
                <input
                  value={context[field]}
                  disabled={disabled}
                  onChange={(event) => setField(field, event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-2xl border border-ink/15 bg-paper px-3 text-sm font-normal"
                />
              )}
            </label>
          ))}
          {canUpdate ? (
            <button
              type="button"
              disabled={disabled || contextIsEmpty(context)}
              onClick={onUpdate}
              className="min-h-12 w-full rounded-2xl bg-leaf px-3 text-sm font-semibold text-paper disabled:opacity-60"
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
