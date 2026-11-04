"use client";

import { ChatThread } from "@/components/chat-thread";
import { ReferenceCard } from "@/components/reference-card";
import { threadWithDecision } from "@/lib/decisions";
import { relocalizeResult } from "@/lib/relocalize";
import { buildShareIntent, selectShareSummary } from "@/lib/share";
import { watcherChecksFor, watchTimeline, type WatcherVerdict } from "@/lib/watcher";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MaskCanvas } from "@/components/mask-canvas";
import {
  EmptyIllustration,
  FirstVisitIntro,
  MaskToggle,
  ResultSkeleton,
  SavedBurst,
  ScanStatus,
  SeverityLine,
  buzz,
  prefersReducedMotion,
  replayIntro,
} from "@/components/premium";
import { PlantMemory, PlantsHomeCard, ProgressNote, type SavedPlant } from "@/components/plant-memory";
import { SiteChrome } from "@/components/site-chrome";
import { VoiceContext } from "@/components/voice-context";
import { NOTES_LIMIT, contextIsEmpty, emptyFarmerContext } from "@/lib/context";
import { copy, type Copy } from "@/lib/copy";
import { HISTORY_LIMIT, forgetCheck, rememberCheck } from "@/lib/history";
import { parseFarmerPlant } from "@/lib/plant-name";
import { severityFor } from "@/lib/severity";
import { fetchSession, onAuthChanged } from "@/lib/auth-client";
import { UI, type UiWords } from "@/lib/ui-copy";
import { clearHistoryStore, useHistory, useLocale, writeHistory } from "@/lib/phone-store";
import {
  QUALITY_BANDS,
  type AnalyzeResult,
  type AskTurn,
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

export function BedSenseApp({ plants = false }: { plants?: boolean }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const locale = useLocale();
  const history = useHistory();
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [frame, setFrame] = useState(0);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<FarmerContext>(emptyFarmerContext);
  const [dragging, setDragging] = useState(false);
  const [savedPlant, setSavedPlant] = useState<SavedPlant | null>(null);
  const [memoryRefresh, setMemoryRefresh] = useState(0);
  const [showMasks, setShowMasks] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const router = useRouter();
  const text = copy[locale];
  const words = UI[locale];

  useEffect(() => {
    const load = () => void fetchSession().then((session) => setSignedIn(Boolean(session.user)));
    load();
    return onAuthChanged(load);
  }, []);

  const choosePlant = useCallback((plant: SavedPlant | null) => {
    setSavedPlant(plant);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "sw" ? "sw" : "en";
  }, [locale]);

  // Keep the running check in view: on phones the photo stage sits below the fold when a scan starts.
  useEffect(() => {
    if (phase !== "preparing" && phase !== "analyzing") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("photo-stage")?.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

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
    const ticket = runRef.current;

    setPhase("preparing");
    setError(overflow ? text.photoLimit : null);
    setResult(null);
    try {
      const made: PreparedPhoto[] = [];
      for (const file of chosen) made.push(await preparePhoto(file));
      if (ticket !== runRef.current) return;
      const next = mode === "append" ? [...photos, ...made].slice(0, 3) : made;
      const shown = mode === "append" ? photos.length : 0;
      setPhotos(next);
      setFrame(shown);
      setPreview(next[shown]?.dataUrl ?? next[0]?.dataUrl ?? null);
      setPhase("idle");
    } catch {
      if (ticket !== runRef.current) return;
      setPhase("error");
      setError(text.errorFormat);
    }
  }

  async function submitPrepared() {
    if (photos.length === 0) return;
    await runCheck(photos);
  }

  /** Photo-only by default. `namedPlant` is set only by the result's correction re-run. */
  async function runCheck(batch: PreparedPhoto[], namedPlant?: string) {
    const ticket = runRef.current;

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
          ...(namedPlant ? { plantName: namedPlant } : {}),
          plantId: savedPlant?.id,
        }),
      });
      const body = (await response.json()) as AnalyzeResult & { error?: string };
      if (ticket !== runRef.current) return;
      if (!response.ok) {
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
      setShowMasks(true);
      setResult(body);
      window.requestAnimationFrame(() => {
        document.getElementById("diagnosis-card")?.scrollIntoView({
          block: "start",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      });
      if (body.plantId) setMemoryRefresh((count) => count + 1);
      setPreview(batch[frame]?.dataUrl ?? batch[0]?.dataUrl ?? null);
      setPhase("ready");
      const thumbnail = await makeThumbnail(batch[0]?.dataUrl ?? "");
      if (ticket !== runRef.current) return;
      const entry: HistoryEntry = {
        id: body.id,
        createdAt: body.createdAt,
        thumbnail,
        result: body,
      };
      writeHistory(rememberCheck(history, entry));
    } catch {
      if (ticket !== runRef.current) return;
      setPhase("error");
      setError(text.errorGeneric);
    }
  }

  function restore(entry: HistoryEntry) {
    setResult(entry.result);
    setPreview(entry.thumbnail);
    setPhotos([]);
    setFrame(0);
    setError(null);
    setPhase("ready");
    window.requestAnimationFrame(() => {
      document.getElementById("diagnosis-card")?.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  }

  const [clearArmed, setClearArmed] = useState(false);
  useEffect(() => {
    if (!clearArmed) return;
    const timer = window.setTimeout(() => setClearArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [clearArmed]);

  function clearHistory() {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    clearHistoryStore();
  }

  function removeCheck(id: string) {
    const entry = history.find((item) => item.id === id);
    const plantId = entry?.result.plantId;
    if (plantId) void fetch(`/api/plants/${plantId}/checks/${id}`, { method: "DELETE" });
    const next = forgetCheck(history, id);
    writeHistory(next);
    if (result?.id === id && photos.length === 0) {
      setResult(null);
      setPreview(null);
      setPhase("idle");
      setError(null);
    }
  }

  function startFresh() {
    runRef.current += 1;
    setPhase("idle");
    setPreview(null);
    setPhotos([]);
    setFrame(0);
    setResult(null);
    setError(null);
    setContext(emptyFarmerContext());

    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    if (addRef.current) addRef.current.value = "";
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

  function rescan() {
    reset();
    window.requestAnimationFrame(() => {
      document.getElementById("photo-stage")?.scrollIntoView({ block: "start", behavior: "smooth" });
      cameraRef.current?.click();
    });
  }

  const busy = phase === "preparing" || phase === "analyzing";
  const sessionLive = Boolean(context.notes.trim() || photos.length > 0 || preview || result || error);

  return (
    <SiteChrome pad={(photos.length > 0 && !busy && !result) || (!preview && !busy && (!plants || savedPlant)) ? "pb-36 lg:pb-12" : "pb-12"}>
      {plants ? null : <FirstVisitIntro locale={locale} />}
      <div className="mt-6 sm:mt-8 lg:max-w-3xl">
        {plants ? (
          <>
            <p className="eyebrow text-leaf">{locale === "sw" ? "Kumbukumbu ya mimea" : "Plant memory"}</p>
            <h1 className="mt-2 font-serif text-[clamp(2.6rem,6vw,4.75rem)] leading-[1.04] tracking-[-0.01em] text-paper">
              {locale === "sw" ? "Mimea yangu" : "My plants"}
              <span className="text-mute">{locale === "sw" ? ", siku baada ya siku." : ", over time."}</span>
            </h1>
          </>
        ) : (
          <>
            <h1 className="max-w-2xl text-3xl leading-tight tracking-[-0.01em] text-paper sm:text-4xl">
              {text.headline}
            </h1>
            <p className="mt-3 max-w-xl font-sans text-lg leading-7 text-mute">
              {text.subhead}
            </p>
          </>
        )}
        {!plants ? (
          <button
            type="button"
            onClick={replayIntro}
            className="press mx-auto mt-4 flex min-h-12 items-center rounded-full border border-leaf/50 px-5 text-base font-semibold text-paper hover:border-leaf sm:mx-0 sm:inline-flex"
          >
            {words.howItWorks}
          </button>
        ) : null}
        {!plants && sessionLive && !(photos.length > 0 && !busy) && !(result && !busy) ? (
          <button
            type="button"
            onClick={startFresh}
            className="lift mt-5 min-h-14 rounded-full border border-leaf/50 bg-leaf/15 px-5 text-base font-semibold text-paper transition-[border-color,background-color] duration-500 ease-out-soft hover:border-leaf"
          >
            {text.newCheck}
          </button>
        ) : null}
      </div>

      <div className={`mt-6 lg:mt-8 lg:grid lg:items-start lg:gap-6 ${plants && !result && !busy ? "lg:max-w-4xl lg:grid-cols-1" : "lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]"}`}>
      <div
        id="left-column"
        className={`flex min-w-0 flex-col gap-6 ${
          preview && (busy || result) ? "lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto" : ""
        }`}
      >
      {plants ? (
        <PlantMemory
          locale={locale}
          selected={savedPlant}
          onSelect={choosePlant}
          history={history}
          refreshKey={memoryRefresh}
          disabled={busy}
        />
      ) : (
        <PlantsHomeCard locale={locale} />
      )}

      {!plants || savedPlant ? (
      <>
      <section
        id="photo-stage"
        className={`transition-colors duration-500 ease-out-soft ${dragging ? "rounded-xl bg-leaf/10" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void onFiles(event.dataTransfer.files, photos.length > 0 ? "append" : "replace");
        }}
      >
        {preview && photos.length > 0 && !result && !busy ? (
          <div className="mb-3">
            <p className="eyebrow text-leaf">{words.preview}</p>
            <p className="mt-1 text-sm leading-6 text-mute">{words.previewHint}</p>
          </div>
        ) : null}
        {preview ? (
          <MaskCanvas
            src={photos[frame]?.dataUrl ?? preview}
            alt={text.title}
            result={busy ? null : result}
            frame={photos.length > 0 ? frame : 0}
            width={photos[frame]?.width}
            height={photos[frame]?.height}
            showMasks={showMasks}
            scanning={phase === "analyzing"}
          />
        ) : (
          <div id="empty-state" className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-leaf/40 px-6 py-10 text-center">
            <EmptyIllustration />
            <p className="mt-4 text-3xl leading-[1.04] tracking-[-0.01em]">
              {words.emptyTitle}
            </p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-mute">{text.photoOnlyHint}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="lift mt-5 min-h-14 rounded-[10px] bg-sun px-6 text-base font-semibold text-ink"
            >
              {history.length > 0 ? words.emptyCtaAgain : words.emptyCta}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => libraryRef.current?.click()}
              className="press mt-3 min-h-12 rounded-full border border-ink/20 px-5 text-base font-semibold text-paper disabled:opacity-60"
            >
              {text.upload}
            </button>
            <p className="mt-3 hidden text-sm font-semibold text-leaf lg:block">{text.dropPhoto}</p>
          </div>
        )}
        {result && !busy && result.masks.length > 0 && preview ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <MaskToggle showMasks={showMasks} onChange={setShowMasks} words={words} />
            {showMasks ? <p className="mt-3 text-sm leading-6 text-mute">{words.maskLegend}</p> : null}
          </div>
        ) : null}

        <div className={`mt-4 grid-cols-2 gap-3 ${preview ? "grid" : "hidden lg:grid"}`}>
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="press min-h-14 rounded-[10px] bg-leaf px-3 text-base font-semibold leading-tight text-cream transition-colors hover:bg-sun hover:text-ink disabled:opacity-60"
          >
            {text.capture}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
            className="press min-h-14 rounded-full border border-ink/10 bg-field px-3 text-base font-semibold leading-tight text-paper transition-colors hover:border-leaf hover:text-leaf disabled:opacity-60"
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
            className="press mt-3 min-h-14 w-full rounded-full border border-ink/10 bg-field px-4 text-base font-semibold text-paper"
          >
            {text.addAngle}
          </button>
        ) : null}
        {phase === "analyzing" ? (
          <ScanStatus words={words} count={photos.length} />
        ) : phase === "preparing" ? (
          <div id="check-preparing" className="mt-4 rounded-lg border border-sun/50 bg-card px-4 py-4" role="status" aria-live="polite" aria-busy="true">
            <p className="tick-label text-2xl font-semibold leading-tight text-paper">{words.preparing}</p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
              <span className="bedsense-indeterminate block h-full w-1/2 rounded-[10px] bg-sun" />
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="mt-3 text-base leading-6 text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {preview && !busy ? (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={reset} className="press min-h-12 rounded-full px-3 text-base font-semibold text-leaf">
              {text.retake}
            </button>
            {photos.length > 0 && phase === "error" ? (
              <button
                type="button"
                onClick={() => void runCheck(photos)}
                className="press min-h-12 rounded-full px-3 text-base font-semibold text-leaf"
              >
                {text.retry}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      </>
      ) : null}
      </div>

      <div className="mt-8 flex min-w-0 flex-col gap-8 lg:mt-0 lg:h-full">
      {phase === "analyzing" ? <ResultSkeleton /> : null}
      {result && !busy ? (
        <div className="space-y-4">
          <ResultCard
            key={result.id}
            locale={locale}
            result={result}
            history={history}
            words={words}
            signedIn={signedIn}
            onRescan={rescan}
            onNewCheck={startFresh}
            onOpenProfile={() => router.push("/plants")}
            contextSlot={photos.length > 0 ? (
              <ContextForm
                text={text}
                locale={locale}
                context={context}
                onChange={setContext}
                disabled={busy}
                canUpdate={photos.length > 0}
                onUpdate={() => {
                  if (photos.length > 0) void runCheck(photos);
                }}
                ask={result.contextAsk ?? null}
              />
            ) : undefined}
            onThread={(thread) => {
              setResult((current) => (current && current.id === result.id ? { ...current, thread } : current));
              const entry = history.find((item) => item.id === result.id);
              if (entry) {
                writeHistory(rememberCheck(history, { ...entry, result: { ...entry.result, thread } }));
              }
            }}
            entry={history.find((item) => item.id === result.id) ?? null}
            onFiled={(plantId) => {
              setResult((current) => (current && current.id === result.id ? { ...current, plantId } : current));
              const entry = history.find((item) => item.id === result.id);
              if (entry) {
                writeHistory(rememberCheck(history, { ...entry, result: { ...entry.result, plantId } }));
              }
              setMemoryRefresh((count) => count + 1);
            }}
            onCorrect={photos.length > 0 ? (name) => void runCheck(photos, name) : undefined}
          />
        </div>
      ) : null}

      {plants ? null : (
      <section className="lg:flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-2xl leading-[1.04] tracking-[-0.01em] sm:text-3xl">{text.history}</h2>
          {history.length > 0 ? (
            <button
              type="button"
              onClick={clearHistory}
              aria-live="polite"
              className={`press min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                clearArmed
                  ? "border-danger bg-danger text-cream"
                  : "border-danger/50 bg-danger/10 text-danger hover:bg-danger/20"
              }`}
            >
              {clearArmed ? text.clearConfirm : text.clear}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? <p className="mt-2 text-base leading-6 text-mute">{text.historyEmpty}</p> : null}
        {history.length > 0 ? <p className="mt-2 text-sm leading-6 text-mute">{text.historyHold}</p> : null}
        <ul className="mt-4 flex gap-3 overflow-x-auto p-1 pb-2 [mask-image:linear-gradient(to_right,black_88%,transparent_100%)] lg:grid lg:grid-cols-2 lg:overflow-visible lg:[mask-image:none]">
          {history.slice(0, HISTORY_LIMIT).map((entry) => (
            <li key={entry.id} className="shrink-0">
              <RecentCheck
                entry={entry}
                label={
                  entry.result.farmerPlant ||
                  entry.result.detectedPlant ||
                  (entry.result.primaryCrop ? text.concepts[entry.result.primaryCrop] : text.failedCheck)
                }
                confidence={text.levelLabel(entry.result.confidence)}
                deleteLabel={text.deleteCheck}
                ask={text.deleteCheckAsk}
                keepLabel={text.keepCheck}
                onOpen={() => restore(entry)}
                current={entry.id === result?.id}
                currentLabel={text.currentCheck}
                onDelete={() => removeCheck(entry.id)}
              />
            </li>
          ))}
        </ul>
      </section>
      )}

      {result && !busy ? (
        <aside className="rounded-lg border border-dashed border-ink/25 bg-field px-4 py-3 font-serif italic">
          <p className="text-sm font-semibold not-italic uppercase tracking-[0.12em] text-mute">{text.askAgronomist}</p>
          <p className="mt-1 text-sm leading-6 text-paper/85">{result.agronomistCallout}</p>
          <p className="mt-2 text-sm leading-6 text-mute">{text.beforeYouAct}: {result.disclaimer}</p>
        </aside>
      ) : null}
      </div>
      </div>

      {!preview && !busy && (!plants || savedPlant) ? (
        <div id="mobile-action-bar" className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-page/95 pt-3  backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => cameraRef.current?.click()} className="press min-h-14 rounded-[10px] bg-leaf px-3 text-base font-semibold text-cream">
              {text.capture}
            </button>
            <button type="button" onClick={() => libraryRef.current?.click()} className="press min-h-14 rounded-full border border-ink/20 bg-field px-3 text-base font-semibold text-paper">
              {text.upload}
            </button>
          </div>
        </div>
      ) : null}
      {photos.length > 0 && !busy && !result ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-page/95 pt-3  backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="mx-auto mb-2 w-full max-w-xl px-4 text-sm leading-6 text-mute sm:px-6 lg:max-w-6xl lg:px-8" role="status">
            {words.journeyPhoto(photos.length)}
          </p>
          <div className="mx-auto flex w-full max-w-xl gap-3 px-4 sm:px-6 lg:max-w-6xl lg:px-8">
            <button
              type="button"
              onClick={startFresh}
              className="press min-h-14 shrink-0 rounded-full border border-leaf/50 bg-leaf/15 px-4 text-base font-semibold text-paper"
            >
              {text.newCheck}
            </button>
            <button
              type="button"
              onClick={() => void submitPrepared()}
              className="press min-h-14 w-full rounded-[10px] bg-sun px-4 text-base font-semibold tracking-tight text-ink shadow-[0_10px_24px_-10px_rgba(245,184,0,0.8)] lg:max-w-[28rem]"
            >
              {photos.length > 1 ? text.checkPhotos : text.checkPhoto}
            </button>
          </div>
        </div>
      ) : null}
    </SiteChrome>
  );
}

function ResultCard({
  locale,
  result: stored,
  history,
  words,
  signedIn,
  onRescan,
  onNewCheck,
  onOpenProfile,
  contextSlot,
  onThread,
  entry,
  onFiled,
  onCorrect,
}: {
  locale: Locale;
  result: AnalyzeResult;
  history: readonly HistoryEntry[];
  words: UiWords;
  signedIn: boolean | null;
  onRescan: () => void;
  onNewCheck: () => void;
  onOpenProfile: () => void;
  /** Context addition for this check (notes + update), rendered under the diagnosis. */
  contextSlot?: React.ReactNode;
  onThread: (thread: AskTurn[]) => void;
  /** This check's history entry, whose thumbnail becomes the plant photo on save. */
  entry: HistoryEntry | null;
  /** Called with the new plant id once the check is filed server-side. */
  onFiled: (plantId: string) => void;
  /** Re-run the staged photos with a farmer-given name. Absent when no photos are staged (restored checks). */
  onCorrect?: (name: string) => void;
}) {
  // Stored results keep the language they were made in. Fixed copy follows the toggle.
  const result = useMemo(() => relocalizeResult(stored, locale), [stored, locale]);
  const text = copy[locale];
  const severity = severityFor(result);
  const filed = Boolean(result.plantId);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctName, setCorrectName] = useState("");
  useEffect(() => {
    if (filed) buzz();
  }, [filed]);
  async function save() {
    if (filed) {
      onOpenProfile();
      return;
    }
    if (!signedIn) {
      // Signed-out farmers sign in first; the check stays in recent checks.
      onOpenProfile();
      return;
    }
    if (!entry) {
      setSaveError(true);
      return;
    }
    setSaving(true);
    setSaveError(false);
    try {
      const response = await fetch("/api/plants/from-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result: stored, thumbnail: entry.thumbnail }),
      });
      if (!response.ok) throw new Error("save_failed");
      const body = (await response.json()) as { plant: SavedPlant };
      buzz();
      setSaved(true);
      onFiled(body.plant.id);
      window.setTimeout(onOpenProfile, 650);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }
  const score = Math.round(result.confidenceScore * 100);
  const pair = (result.likelyCauses?.length ?? 0) > 0 && (result.mitigations?.length ?? 0) > 0;
  const plantLabel = result.farmerPlant || result.detectedPlant;
  const verdict = useMemo(
    () => watchTimeline(watcherChecksFor(history, plantLabel), plantLabel, new Date()),
    [history, plantLabel],
  );
  useEffect(() => {
    // Trace the volunteered verdict in this check's thread once, in the check's own language.
    if (verdict.kind === "ok") return;
    const storedThread = stored.thread ?? [];
    const words = WATCHER_WORDS[stored.locale];
    const suggestion =
      verdict.kind === "worsening"
        ? words.worseningBody(verdict.plant, verdict.streak)
        : words.overdueBody(verdict.plant, verdict.daysSince);
    const next = threadWithDecision(storedThread, stored.locale, verdict.kind, suggestion);
    if (next !== storedThread) onThread(next);
  }, [verdict, stored, onThread]);
  const [detailOpen, setDetailOpen] = useState(true);
  return (
    <section id="result" className="space-y-6 lg:space-y-7" aria-live="polite">
      {result.qualityNote ? (
        <p id="quality-note" className="rounded-lg bg-sun px-4 py-3 text-base font-semibold leading-6 text-ink" role="status">
          {result.qualityNote}
        </p>
      ) : null}
      {result.qualityHold ? (
        <div className="space-y-4">
          <div id="quality-hold" className="rounded-xl border border-ink/20 bg-field px-5 py-5" role="status">
            <p className="text-2xl leading-[1.04] tracking-[-0.01em] text-ink sm:text-3xl">{result.qualityMessage}</p>
          </div>
          <div id="hold-steps" className="rounded-xl border border-ink/20 bg-card p-5 sm:p-6">
            <h3 className="eyebrow text-leaf">{words.firstAction}</h3>
            <ol className="mt-3 space-y-2">
              {result.actions.filter(Boolean).map((step, index) => (
                <li key={index} className="flex gap-3 text-base leading-6 text-paper">
                  <span aria-hidden="true" className="font-mono text-sm font-semibold text-leaf">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
      <div id="result-reading" className="space-y-4 lg:space-y-5">
      {result.progress ? <ProgressNote locale={locale} progress={result.progress} /> : null}
      {verdict.kind !== "ok" ? <WatcherCard locale={locale} verdict={verdict} /> : null}
      {result.plantMismatch ? (
        <p id="plant-mismatch" className="rounded-lg border border-sun/60 bg-sun/15 px-4 py-3 text-base font-semibold leading-6 text-paper" role="status">
          {text.plantMismatchNote(result.farmerPlant, result.detectedPlant)}
        </p>
      ) : null}
      <div id="diagnosis-card" className={`rise scroll-mt-4 rounded-xl border border-ink/20 bg-card p-5 sm:p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {severity ? <SeverityLine severity={severity} words={words} /> : <p className="eyebrow text-mute">{words.diagnosis}</p>}
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="min-w-0 font-serif text-3xl leading-[1.04] tracking-[-0.01em] text-paper sm:text-4xl">
            {text.plantLine({
              detectedPlant: result.detectedPlant,
              cropFocus: result.cropFocus,
              primaryCrop: result.primaryCrop,
            })}
            {result.likelyCauses?.[0] ? <span className="mt-2 block text-xl leading-snug text-mute sm:text-2xl">{result.likelyCauses[0]}</span> : null}
          </h2>
          <p className="shrink-0 sm:text-right">
            <span className="eyebrow block text-mute">{text.confidence}</span>
            <span className="text-base font-semibold">{text.levelLabel(result.confidence)}</span>
            <span className="mt-1.5 block h-2 w-24 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full origin-left bg-leaf" style={{ width: `${score}%` }} />
            </span>
          </p>
        </div>
        {onCorrect ? (
          <div className="mt-4">
            {correctOpen ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = parseFarmerPlant(correctName);
                  if (name) onCorrect(name);
                }}
              >
                <label htmlFor="correct-plant-name" className="w-full text-sm font-semibold text-paper">
                  {text.correctPlantLabel}
                </label>
                <input
                  id="correct-plant-name"
                  value={correctName}
                  autoFocus
                  autoComplete="off"
                  placeholder={text.correctPlantPlaceholder}
                  onChange={(event) => setCorrectName(event.target.value)}
                  className="min-h-12 min-w-0 flex-1 rounded-full border border-ink/20 bg-field px-4 text-base text-paper placeholder:text-mute"
                />
                <button
                  type="submit"
                  disabled={!parseFarmerPlant(correctName)}
                  className="press min-h-12 shrink-0 rounded-[10px] bg-leaf px-5 text-base font-semibold text-cream disabled:opacity-60"
                >
                  {text.correctPlantRun}
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setCorrectOpen(true)} className="min-h-11 text-sm font-semibold text-leaf hover:underline">
                {text.correctPlantPrompt}
              </button>
            )}
          </div>
        ) : null}
        {result.actions.length > 0 ? (
          <div className="mt-5 rounded-lg border border-leaf/40 bg-leaf/10 px-4 py-3">
            <p className="eyebrow text-leaf">{words.firstAction}</p>
            <ol className="mt-2 space-y-2">
              {result.actions.map((action, index) => (
                <li key={action} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-leaf text-sm text-cream">
                    {index + 1}
                  </span>
                  <span className={`leading-7 text-paper ${index === 0 ? "text-lg font-semibold" : "text-base"}`}>{action}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {saved ? (
            <SavedBurst label={words.savedToProfile} />
          ) : filed ? (
            <>
              <SavedBurst label={words.savedToProfile} />
              <button type="button" onClick={save} className="lift min-h-12 rounded-full border border-leaf/50 px-4 text-base font-semibold text-paper">
                {words.openProfile}
              </button>
            </>
          ) : (
            <button
              id="save-to-profile"
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="lift min-h-12 rounded-[10px] bg-leaf px-5 text-base font-semibold text-cream disabled:opacity-60"
            >
              {saving ? words.savingToProfile : words.saveToProfile}
            </button>
          )}
          {saveError ? (
            <p className="w-full text-base text-danger" role="alert">
              {words.saveFailed}
            </p>
          ) : null}
          <button id="rescan" type="button" onClick={onRescan} className="lift min-h-12 rounded-full border border-ink/20 px-4 text-base font-semibold text-paper">
            {words.rescan}
          </button>
          <button type="button" onClick={onNewCheck} className="press min-h-12 rounded-full px-3 text-base font-semibold text-mute hover:text-paper">
            {text.newCheck}
          </button>
        </div>
      </div>
      {contextSlot}

      <button
        type="button"
        aria-expanded={detailOpen}
        onClick={() => setDetailOpen((open) => !open)}
        className="press flex min-h-12 w-full items-center justify-between rounded-full border border-ink/20 px-5 text-base font-semibold text-paper"
      >
        {detailOpen ? words.lessDetail : words.moreDetail}
        <span aria-hidden="true" className="text-leaf">{detailOpen ? "–" : "+"}</span>
      </button>

      {detailOpen ? (
      <>
      <section id="result-stands-out" style={{ animationDelay: "120ms" }} className="rise">
        <h3 className="font-semibold text-2xl leading-[1.04] tracking-[-0.01em] text-paper sm:text-3xl">{text.observations}</h3>
        <div className="mt-4 space-y-4">
          {result.masks.length === 0 ? <p className="text-base leading-6 text-mute">{text.noMasks}</p> : null}
          <ol className="divide-y divide-ink/10">
            {result.observations.map((item, index) => (
              <li
                key={item}
                className={`flex gap-4 py-3 text-paper first:pt-0 ${index === 0 ? "text-lg leading-8" : "text-base leading-7"}`}
              >
                <span aria-hidden="true" className="w-5 shrink-0 font-mono text-sm font-semibold leading-8 text-leaf tabular-nums">{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ReferenceCard
        plant={plantLabel}
        suspect={result.chemicals?.suspect ?? null}
        symptom={result.observations[0] ?? null}
        text={text}
      />

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

      {result.needsInfo ? (
      <div id="result-checks" style={{ animationDelay: "280ms" }} className="rise">
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-base leading-6 text-paper" role="status">
          {text.needsInfoNote}
        </p>
      </div>
      ) : null}
      </>
      ) : null}
      </div>
      )}

      <div className="border-t border-ink/10 pb-4">
        <FollowUpChat locale={locale} text={text} result={result} onThread={onThread} />
      </div>

      {result.chemicals ? <ChemicalCard text={text} words={words} advice={result.chemicals} /> : null}

      {result.note === "local-fallback" ? <p className="text-base leading-6 text-mute">{text.backupNote}</p> : null}

      <div>
        <a
          href={buildShareIntent(locale, selectShareSummary(result))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center rounded-2xl border border-white/15 px-5 text-base font-semibold text-paper"
        >
          {text.shareResult}
        </a>
      </div>
    </section>
  );
}

const WATCHER_WORDS = {
  en: {
    worseningTitle: "Getting worse",
    worseningBody: (plant: string, streak: number) =>
      `The last ${streak} check${streak === 1 ? "" : "s"} trend${streak === 1 ? "s" : ""} down for ${plant}. Take today's worst leaf to an agrovet.`,
    overdueTitle: "Overdue for a re-check",
    overdueBody: (plant: string, days: number) =>
      `${plant} was last checked ${days} days ago. A fresh photo shows whether the advice helped.`,
  },
  sw: {
    worseningTitle: "Inazidi kuwa mbaya",
    worseningBody: (plant: string, streak: number) =>
      `Ukaguzi ${streak} wa mwisho unaelekea chini kwa ${plant}. Peleka jani baya la leo kwa agrovet.`,
    overdueTitle: "Umechelewa kufanya ukaguzi",
    overdueBody: (plant: string, days: number) =>
      `${plant} ilikaguliwa mara ya mwisho siku ${days} zilizopita. Picha mpya inaonyesha kama ushauri ulisaidia.`,
  },
} as const;

/** The progress-watcher's verdict, volunteered by the system. Rendered only when there is something to say. */
function WatcherCard({ locale, verdict }: { locale: Locale; verdict: Exclude<WatcherVerdict, { kind: "ok" }> }) {
  const words = WATCHER_WORDS[locale];
  const worsening = verdict.kind === "worsening";
  return (
    <div
      id="watcher-card"
      role="status"
      className={`rounded-lg border px-4 py-3 ${worsening ? "border-danger/40 bg-danger/10" : "border-sun/60 bg-sun/15"}`}
    >
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-leaf">
        {worsening ? words.worseningTitle : words.overdueTitle}
      </p>
      <p className="mt-1 text-base leading-7 text-paper [overflow-wrap:anywhere]">
        {worsening ? words.worseningBody(verdict.plant, verdict.streak) : words.overdueBody(verdict.plant, verdict.daysSince)}
      </p>
    </div>
  );
}

/** Follow-up Q&A about this reading. It can ask for one fresh photo when the question needs new evidence. */
function FollowUpChat({
  locale,
  text,
  result,
  onThread,
}: {
  locale: Locale;
  text: Copy;
  result: AnalyzeResult;
  onThread: (thread: AskTurn[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [limited, setLimited] = useState(false);
  const [demo, setDemo] = useState(false);
  const [pending, setPending] = useState<{ question: string; reason: string } | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const thread = result.thread ?? [];

  function groundingOf() {
    return {
      plant: result.detectedPlant,
      observations: result.observations,
      likelyCauses: result.likelyCauses ?? [],
      mitigations: result.mitigations ?? [],
      actions: [...result.actions],
      suspect: result.chemicals?.suspect ?? null,
      actives: result.chemicals?.products.map((product) => product.activeIngredient) ?? [],
      needsInfo: Boolean(result.needsInfo),
      followUp: result.contextAsk,
    };
  }

  async function ask() {
    const question = draft.replace(/\s+/g, " ").trim();
    if (!question || busy || limited) return;
    const asked: AskTurn[] = [...thread, { role: "farmer", text: question }];
    onThread(asked);
    setDraft("");
    setFailed(false);
    setPending(null);
    setBusy(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, question, thread, grounding: groundingOf() }),
      });
      const body = (await response.json()) as { answer?: string; demo?: boolean; error?: string; photoRequested?: boolean; reason?: string };
      if (!response.ok || !body.answer) {
        if (body.error === "rate_limited") {
          // Explain the pause in plain words and hold the button briefly so rapid taps stop hammering.
          setLimited(true);
          window.setTimeout(() => setLimited(false), 10_000);
        } else {
          setFailed(true);
        }
        return;
      }
      if (body.demo) setDemo(true);
      if (body.photoRequested) {
        const reason = typeof body.reason === "string" ? body.reason : "";
        onThread([...threadWithDecision(asked, locale, "photo_requested", reason), { role: "bedsense", text: body.answer }]);
        setPending({ question, reason });
      } else {
        onThread([...asked, { role: "bedsense", text: body.answer }]);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoto(file: File | undefined) {
    if (!file || !pending || busy || limited) return;
    setFailed(false);
    setBusy(true);
    try {
      const made = await preparePhoto(file);
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, question: pending.question, thread, grounding: groundingOf(), photo: made.dataUrl }),
      });
      const body = (await response.json()) as { answer?: string; demo?: boolean; error?: string };
      if (!response.ok || !body.answer) {
        setFailed(true);
        return;
      }
      if (body.demo) setDemo(true);
      onThread([...threadWithDecision(thread, locale, "photo_answered", ""), { role: "bedsense", text: body.answer }]);
      setPending(null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-ink/10 pt-4">
      <h4 className="font-semibold text-xl leading-tight text-paper">{text.askTitle}</h4>
      <p className="mt-1 text-sm leading-6 text-mute">{text.askHint}</p>
      <ChatThread thread={thread} />
      {demo ? <p className="mt-2 text-sm leading-6 text-mute">{text.askDemoNote}</p> : null}
      {limited ? (
        <p className="mt-2 text-sm leading-6 text-danger" role="alert">
          {text.askRateLimited}
        </p>
      ) : null}
      {failed ? (
        <p className="mt-2 text-sm leading-6 text-danger" role="alert">
          {text.askFailed}
        </p>
      ) : null}
      {pending ? (
        <div className="mt-3 rounded-lg border border-sun/50 bg-sun/10 px-4 py-3">
          <button
            type="button"
            disabled={busy || limited}
            onClick={() => photoRef.current?.click()}
            className="press min-h-12 w-full rounded-[10px] bg-leaf px-5 text-base font-semibold text-cream disabled:opacity-60"
          >
            {busy ? text.askThinking : text.askPhotoSend}
          </button>
          <input
            ref={photoRef}
            className="sr-only"
            type="file"
            accept="image/*"
            aria-label={text.askPhotoSend}
            onChange={(event) => {
              void sendPhoto(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          rows={2}
          maxLength={500}
          disabled={busy || limited}
          placeholder={text.askPlaceholder}
          aria-label={text.askTitle}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask();
            }
          }}
          className="min-h-12 flex-1 rounded-lg border border-ink/20 bg-field px-4 py-3 text-base leading-6 text-paper placeholder:text-mute disabled:opacity-60"
        />
        <button
          type="button"
          disabled={busy || limited || draft.trim().length === 0}
          onClick={() => void ask()}
          className="press min-h-12 shrink-0 rounded-[10px] bg-leaf px-5 text-base font-semibold text-cream disabled:opacity-60"
        >
          {busy ? text.askThinking : text.askSend}
        </button>
      </div>
    </div>
  );
}

function AdviceList({
  id,
  title,
  hint,
  items,
}: {
  id: string;
  title: string;
  hint: string;
  items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <div id={id} style={{ animationDelay: "200ms" }} className="rise">
      <h3 className="font-semibold text-2xl leading-[1.04] tracking-[-0.01em] text-paper sm:text-3xl">{title}</h3>
      <p className="mt-2 text-base leading-6 text-mute">{hint}</p>
      <ul className="mt-4 divide-y divide-ink/10">
        {items.map((item, index) => (
          <li key={item} style={{ animationDelay: `${240 + index * 100}ms` }} className="rise flex gap-3 py-3 text-base leading-7 first:pt-0">
            <span aria-hidden="true" className="mt-0 shrink-0 font-semibold text-leaf">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChemicalCard({ text, words, advice }: { text: Copy; words: UiWords; advice: ChemicalAdvice }) {
  const [shopsOpen, setShopsOpen] = useState(true);
  const eyebrow = "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-leaf";
  const term = "text-sm font-semibold leading-6 text-mute";
  return (
    <div className="space-y-6">
      <div id="result-chemicals">
        <h3 className={eyebrow}>{text.chemicalsTitle}</h3>
        <p className="mt-3 text-lg leading-7 text-paper">
          <span className="font-semibold">{text.chemicalsWhy}: </span>
          {advice.suspect}
        </p>
        <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          {advice.products.map((product) => {
            const brands = [...new Set(product.offers.map((offer) => offer.brand))];
            return (
              <li key={product.activeIngredient} className="py-4">
                <h4 className="font-serif text-xl leading-tight tracking-[-0.01em] text-paper sm:text-2xl">{product.activeIngredient}</h4>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-[9rem_1fr] sm:gap-y-2">
                  <dt className={term}>{text.chemicalsType}</dt>
                  <dd className="text-base leading-6 text-paper first-letter:uppercase">{product.productClass}</dd>
                  <dt className={`${term} mt-2 sm:mt-0`}>{text.chemicalsHow}</dt>
                  <dd className="text-base leading-6 text-paper">{product.useNote}</dd>
                  {brands.length > 0 ? (
                    <>
                      <dt className={`${term} mt-2 sm:mt-0`}>{text.chemicalsBrands}</dt>
                      <dd className="text-base leading-6 text-paper">{brands.join(", ")}</dd>
                    </>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
        <div id="chemicals-safety" className="mt-4 rounded-lg border border-ink/10 bg-field px-4 py-3">
          <p className="text-sm font-semibold leading-6 text-paper">{text.chemicalsSafety}</p>
          <p className="text-base leading-6 text-paper">{advice.verifyNote}</p>
        </div>
      </div>

      <div id="result-shops" className="border-t border-ink/10 pt-4">
        <button
          type="button"
          aria-expanded={shopsOpen}
          onClick={() => setShopsOpen((open) => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span className={eyebrow}>{words.shopsDetail}</span>
          <span aria-hidden="true" className="text-leaf">{shopsOpen ? "–" : "+"}</span>
        </button>
        {shopsOpen ? (
          <div className="mt-2 space-y-6">
            {advice.products.map((product) => (
              <section key={product.activeIngredient} aria-label={product.activeIngredient}>
                <h4 className="text-base font-semibold leading-6 text-paper">{product.activeIngredient}</h4>
                {product.offers.length === 0 ? (
                  <p className="mt-1 text-base leading-6 text-mute">{text.chemicalsNoShop}</p>
                ) : (
                  <div className="mt-2 border-t border-ink/20">
                    <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_6rem_9rem] gap-4 border-b border-ink/10 py-2 text-sm font-semibold text-mute sm:grid">
                      <span>{text.shopsShop}</span>
                      <span>{text.shopsPack}</span>
                      <span>{text.shopsGrade}</span>
                      <span className="text-right">{text.shopsPrice}</span>
                    </div>
                    <ul className="divide-y divide-ink/10">
                      {orderedOffers(product.offers).map((offer) => (
                        <li
                          key={`${product.activeIngredient}-${offer.quality}-${offer.brand}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_6rem_9rem] sm:items-baseline"
                        >
                          <div className="min-w-0">
                            <p className="text-base font-semibold leading-6 text-paper">{offer.shopName}</p>
                            <p className="text-sm leading-5 text-mute">{offer.shopKind} · {offer.place}</p>
                          </div>
                          <p className="col-start-2 row-start-1 text-right text-base font-semibold leading-6 text-paper tabular-nums sm:col-start-4">
                            <span className="font-normal text-mute sm:hidden">KES </span>
                            {kesRange(offer.priceMinKes, offer.priceMaxKes)}
                          </p>
                          <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                            <p className="text-base leading-6 text-paper">
                              {offer.brand} <span className="text-mute">· {offer.pack}</span>
                            </p>
                            {offer.productLink?.url ? (
                              <a
                                href={offer.productLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-leaf underline decoration-leaf/50 underline-offset-2 hover:decoration-leaf"
                              >
                                {offer.productLink.curated ? text.productLinkView : text.productLinkSearch}
                              </a>
                            ) : null}
                          </div>
                          <p className="col-span-2 text-sm leading-5 text-mute sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:text-base sm:text-paper">
                            <span className="sm:hidden">{text.shopsGrade}: </span>
                            {text.quality[offer.quality]}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
            <p className="text-sm leading-6 text-mute">{advice.priceNote}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function orderedOffers(offers: readonly ShopOffer[]): ShopOffer[] {
  return [...offers].sort((a, b) => QUALITY_BANDS.indexOf(a.quality) - QUALITY_BANDS.indexOf(b.quality));
}

function kesRange(min: number, max: number): string {
  const format = new Intl.NumberFormat("en-KE");
  return `${format.format(min)}–${format.format(max)}`;
}

function ContextForm({
  text,
  locale,
  context,
  onChange,
  disabled,
  canUpdate,
  onUpdate,
  ask,
}: {
  text: Copy;
  locale: Locale;
  context: FarmerContext;
  onChange: (next: FarmerContext) => void;
  disabled: boolean;
  canUpdate: boolean;
  onUpdate: () => void;
  ask: string | null;
}) {
  return (
    <section id="home-context" className="border-t border-ink/10 pt-5">
      {ask ? (
        <p className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-base leading-6 text-paper" role="status">
          <span className="block text-sm font-semibold text-mute">{UI[locale].contextFromCheck}</span>
          {ask}
        </p>
      ) : null}
      <div id="context-panel" className="space-y-3">
        <textarea
          id="context-notes"
          value={context.notes}
          disabled={disabled}
          rows={4}
          maxLength={NOTES_LIMIT}
          placeholder={text.contextHint}
          aria-label={text.contextHint}
          aria-describedby="context-guide"
          onChange={(event) => onChange({ ...emptyFarmerContext(), notes: event.target.value })}
          className="min-h-32 w-full rounded-lg border border-ink/20 bg-field px-4 py-3 text-base leading-7 font-normal text-paper placeholder:text-mute"
        />
        <p id="context-guide" className="text-base leading-7 text-mute">
          {text.contextGuide}
        </p>
        <VoiceContext text={text} locale={locale} context={context} onChange={onChange} disabled={disabled} />
        {canUpdate ? (
          <button
            type="button"
            disabled={disabled || contextIsEmpty(context)}
            onClick={onUpdate}
            className="press min-h-14 w-full rounded-[10px] bg-leaf px-4 text-base font-semibold text-cream disabled:opacity-60"
          >
            {text.contextUpdate}
          </button>
        ) : null}
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

function RecentCheck({
  entry,
  label,
  confidence,
  deleteLabel,
  ask,
  keepLabel,
  current,
  currentLabel,
  onOpen,
  onDelete,
}: {
  entry: HistoryEntry;
  label: string;
  confidence: string;
  deleteLabel: string;
  ask: string;
  keepLabel: string;
  current: boolean;
  currentLabel: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const [confirm, setConfirm] = useState(false);

  function clearTimer() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => clearTimer, []);

  function press() {
    held.current = false;
    clearTimer();
    timer.current = window.setTimeout(() => {
      held.current = true;
      setConfirm(true);
    }, 600);
  }

  if (confirm) {
    return (
      <div role="alertdialog" aria-label={ask} className="flex w-44 flex-col justify-between gap-3 rounded-xl border border-danger/50 bg-card p-3 lg:w-full">
        <p className="text-sm leading-5 text-paper">{ask}</p>
        <div className="grid grid-cols-1 gap-2">
          <button type="button" autoFocus onClick={() => setConfirm(false)} className="min-h-11 rounded-xl bg-leaf px-3 text-sm font-semibold text-cream">
            {keepLabel}
          </button>
          <button type="button" onClick={onDelete} className="min-h-11 rounded-xl border border-danger/60 px-3 text-sm font-semibold text-danger lg:min-h-8 lg:px-2 lg:text-xs">
            {deleteLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative w-44 lg:w-full"
      onContextMenu={(event) => {
        event.preventDefault();
        held.current = true;
        setConfirm(true);
      }}
    >
      <button
        type="button"
        onPointerDown={press}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          onOpen();
        }}
        className={`w-full touch-manipulation overflow-hidden rounded-xl border bg-field text-left select-none transition-[border-color,box-shadow] duration-500 ease-out-soft ${current ? "border-sun lg:group-hover:border-sun" : "border-ink/10 lg:group-hover:border-leaf/50"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.thumbnail} alt="" className="h-28 w-full object-cover" />
        <span className="block px-4 py-4 text-sm font-semibold leading-5 text-paper">
          {label}
          <span className="mt-1 block font-normal text-mute">{confidence}</span>
          {current ? <span className="mt-1 hidden text-sm font-semibold text-paper lg:group-hover:block">{currentLabel}</span> : null}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="absolute top-2 right-2 hidden min-h-11 rounded-xl bg-page/90 px-3 text-sm font-semibold text-paper lg:inline-flex lg:min-h-8 lg:items-center lg:px-2 lg:text-xs lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
      >
        {deleteLabel}
      </button>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("format"));
    image.src = src;
  });
}
