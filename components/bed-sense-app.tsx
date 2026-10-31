"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MaskCanvas } from "@/components/mask-canvas";
import {
  Checklist,
  EmptyIllustration,
  FirstVisitIntro,
  GuestSavePrompt,
  MaskToggle,
  ResultSkeleton,
  SavedBurst,
  ScanStatus,
  SeverityLine,
  severityBorder,
  buzz,
} from "@/components/premium";
import { PlantMemory, PlantsHomeCard, ProgressNote, type SavedPlant } from "@/components/plant-memory";
import { SiteChrome } from "@/components/site-chrome";
import { VoiceContext } from "@/components/voice-context";
import { CONCEPTS } from "@/lib/concepts";
import { NOTES_LIMIT, contextIsEmpty, emptyFarmerContext } from "@/lib/context";
import { copy, type Copy } from "@/lib/copy";
import { HISTORY_LIMIT, forgetCheck, rememberCheck } from "@/lib/history";
import { parseFarmerPlant } from "@/lib/plant-name";
import { severityFor } from "@/lib/severity";
import { browserSupabase } from "@/lib/supabase-browser";
import { UI, type UiWords } from "@/lib/ui-copy";
import { clearHistoryStore, useHistory, useLocale, writeHistory } from "@/lib/phone-store";
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

export function BedSenseApp({ plants = false }: { plants?: boolean }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const plantRef = useRef<HTMLInputElement>(null);
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
  const [contextOpen, setContextOpen] = useState(false);
  const [plantName, setPlantName] = useState("");
  const [plantError, setPlantError] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [savedPlant, setSavedPlant] = useState<SavedPlant | null>(null);
  const [memoryRefresh, setMemoryRefresh] = useState(0);
  const [showMasks, setShowMasks] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const router = useRouter();
  const text = copy[locale];
  const words = UI[locale];

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  const choosePlant = useCallback((plant: SavedPlant | null) => {
    setSavedPlant(plant);
    if (plant) {
      setPlantName(plant.name);
      setPlantError(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "sw" ? "sw" : "en";
  }, [locale]);

  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = window.setTimeout(() => setProgressStep(2), 4000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function markPlantMissing() {
    setPlantError(true);
    setPhase("idle");
    window.requestAnimationFrame(() => {
      plantRef.current?.focus();
      document.getElementById("home-plant-name")?.scrollIntoView({ block: "center" });
    });
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
    const ticket = runRef.current;
    setProgressStep(0);
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
      if (!parseFarmerPlant(plantName)) {
        markPlantMissing();
        return;
      }
      setPlantError(false);
      setPhase("idle");
    } catch {
      if (ticket !== runRef.current) return;
      setPhase("error");
      setError(text.errorFormat);
    }
  }

  async function submitPrepared() {
    if (photos.length === 0) return;
    if (!parseFarmerPlant(plantName)) {
      markPlantMissing();
      return;
    }
    setPlantError(false);
    await runCheck(photos);
  }

  async function runCheck(batch: PreparedPhoto[]) {
    const named = parseFarmerPlant(plantName);
    if (!named) {
      markPlantMissing();
      return;
    }
    const ticket = runRef.current;
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
          plantId: savedPlant?.id,
        }),
      });
      const body = (await response.json()) as AnalyzeResult & { error?: string };
      if (ticket !== runRef.current) return;
      if (!response.ok) {
        if (body.error === "missing_plant") {
          markPlantMissing();
          setError(text.plantNameMissing);
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
      setShowMasks(true);
      setResult(body);
      if (body.plantId) setMemoryRefresh((count) => count + 1);
      if (body.contextAsk) {
        setContextOpen(true);
        window.requestAnimationFrame(() => {
          document.getElementById("home-context")?.scrollIntoView({ block: "nearest" });
        });
      }
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
    setContextOpen(false);
    setPlantName(savedPlant?.name ?? "");
    setPlantError(false);
    setProgressStep(0);
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
      document.getElementById("new-check")?.scrollIntoView({ block: "start", behavior: "smooth" });
      cameraRef.current?.click();
    });
  }

  const busy = phase === "preparing" || phase === "analyzing";
  const sessionLive = Boolean(plantName.trim() || context.notes.trim() || photos.length > 0 || preview || result || error);

  return (
    <SiteChrome pad={(photos.length > 0 && !busy && !result) || (!preview && !busy && (!plants || savedPlant)) ? "pb-36 lg:pb-12" : "pb-12"}>
      {plants ? null : <FirstVisitIntro locale={locale} />}
      <div className="mt-6 sm:mt-8 lg:max-w-3xl">
        {plants ? (
          <>
            <p className="eyebrow text-leaf">{locale === "sw" ? "Kumbukumbu ya mimea" : "Plant memory"}</p>
            <h1 className="mt-2 font-serif text-[clamp(2.6rem,6vw,4.75rem)] leading-[1.04] tracking-[-0.01em] text-paper">
              {locale === "sw" ? "Mimea yangu" : "My plants"}
              <span className="text-mute">{locale === "sw" ? ", kwa muda." : ", over time."}</span>
            </h1>
          </>
        ) : (
          <>
            <p className="eyebrow text-leaf">{locale === "sw" ? "Kitanda chako, kimesomwa" : "Farm bed check"}</p>
            <p className="mt-2 max-w-2xl font-serif text-2xl leading-snug text-paper sm:text-3xl">
              {text.lede.split(". ")[0]}
              {text.lede.includes(". ") ? <span className="text-mute">. {text.lede.split(". ").slice(1).join(". ")}</span> : null}
            </p>
          </>
        )}
        {!plants && sessionLive && !(photos.length > 0 && !busy) && !(result && !busy) ? (
          <button
            type="button"
            onClick={startFresh}
            className="lift mt-5 min-h-14 rounded-full border border-leaf/50 bg-leaf/15 px-5 text-base font-semibold text-paper transition-[border-color,background-color,box-shadow] duration-500 ease-out-soft hover:border-leaf hover:shadow-[0_0_32px_-12px_rgba(31,157,85,0.8)]"
          >
            {text.newCheck}
          </button>
        ) : null}
      </div>

      <div className={`mt-6 lg:mt-8 lg:grid lg:items-start lg:gap-6 ${plants && !result && !busy ? "lg:max-w-4xl lg:grid-cols-1" : "lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]"}`}>
      <div
        id="left-column"
        className={`flex min-w-0 flex-col gap-6 lg:rounded-[32px] lg:border lg:border-white/[0.09] lg:bg-card lg:p-6 lg:shadow-[0_24px_60px_-36px_rgba(0,0,0,0.85)] ${
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
      <section id="new-check" className="rounded-[28px] border border-leaf/40 bg-card p-5 sm:p-6">
        <p className="eyebrow text-leaf">01</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-paper">{text.newCheck}</h2>
        {savedPlant ? <p className="mt-1 text-sm leading-6 text-mute">{savedPlant.name}</p> : null}
      <div id="home-plant-name" className={`mt-4 ${plantError ? "rounded-[28px] border border-beet bg-beet/10 p-3 sm:p-4" : ""}`}>
        <label htmlFor="plant-name" className={`block text-base font-semibold ${plantError ? "text-beet" : "text-paper"}`}>
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
          aria-describedby={plantError ? "plant-name-hint plant-name-error" : "plant-name-hint"}
          onChange={(event) => {
            setPlantName(event.target.value);
            if (parseFarmerPlant(event.target.value)) setPlantError(false);
          }}
          className={`mt-2 min-h-14 w-full rounded-2xl border px-4 text-base text-paper placeholder:text-mute ${
            plantError ? "border-beet bg-beet/15 ring-2 ring-beet" : "border-white/[0.18] bg-field"
          }`}
        />
        <p id="plant-name-hint" className={`mt-2 text-sm leading-6 sm:text-base ${plantError ? "text-paper" : "text-mute"}`}>
          {text.plantNameHint}
        </p>
        {plantError ? (
          <p id="plant-name-error" className="mt-2 text-base font-semibold leading-6 text-beet" role="alert">
            {text.plantNameMissing}
          </p>
        ) : null}
      </div>
      </section>

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

      <section
        id="photo-stage"
        className={`rounded-[28px] border bg-card p-5 shadow ${preview ? "lg:order-first" : ""}-[0_18px_50px_-32px_rgba(0,0,0,0.8)] transition-[border-color,box-shadow] duration-500 ease-out-soft sm:p-6 ${dragging ? "border-leaf bg-leaf/10" : "border-white/[0.09] lg:hover:border-leaf/60"}`}
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
          <div id="empty-state" className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-dashed border-leaf/40 bg-field px-6 py-10 text-center">
            <EmptyIllustration />
            <p className="mt-4 font-serif text-3xl leading-[1.04] tracking-[-0.01em]">
              {words.emptyTitle}
            </p>
            <p className="mt-3 max-w-xs text-base leading-6 text-mute">{words.emptyTip}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="lift mt-5 min-h-14 rounded-full bg-leaf px-6 text-base font-semibold text-paper"
            >
              {words.emptyCta}
            </button>
            <p className="mt-3 hidden text-sm font-semibold text-leaf lg:block">{text.dropPhoto}</p>
          </div>
        )}
        {result && !busy && result.masks.length > 0 && preview ? <MaskToggle showMasks={showMasks} onChange={setShowMasks} words={words} /> : null}

        <div className={`mt-4 grid-cols-2 gap-3 ${preview ? "grid" : "hidden lg:grid"}`}>
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="press min-h-14 rounded-full bg-soil px-3 text-base font-semibold leading-tight text-paper transition-colors hover:bg-leaf disabled:opacity-60"
          >
            {text.capture}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
            className="press min-h-14 rounded-full border border-white/[0.09] bg-field px-3 text-base font-semibold leading-tight text-paper transition-colors hover:border-clay hover:text-clay disabled:opacity-60"
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
            className="press mt-3 min-h-14 w-full rounded-full border border-white/[0.09] bg-field px-4 text-base font-semibold text-paper"
          >
            {text.addAngle}
          </button>
        ) : null}
        {phase === "analyzing" ? <ScanStatus words={words} /> : phase === "preparing" ? <CheckProgress text={text} step={progressStep} /> : null}
        {error ? (
          <p className="mt-3 text-base leading-6 text-beet" role="alert">
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

      <div className="mt-8 flex min-w-0 flex-col gap-5 lg:mt-0 lg:h-full">
      {phase === "analyzing" ? <ResultSkeleton /> : null}
      {result && !busy ? (
        <div className="space-y-4">
          <ResultCard
            key={result.id}
            locale={locale}
            result={result}
            words={words}
            signedIn={signedIn}
            onRescan={rescan}
            onNewCheck={startFresh}
            onOpenProfile={() => router.push("/plants")}
          />
        </div>
      ) : null}

      {plants ? null : (
      <section className="rounded-[28px] border border-onion/30 bg-card p-5 sm:p-6 lg:flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl leading-[1.04] tracking-[-0.01em] sm:text-3xl">{text.history}</h2>
          {history.length > 0 ? (
            <button type="button" onClick={clearHistory} className="min-h-11 px-2 text-base font-semibold text-leaf">
              {text.clear}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? <p className="mt-2 text-base leading-6 text-mute">{text.historyEmpty}</p> : null}
        {history.length > 0 ? <p className="mt-2 text-sm leading-6 text-mute">{text.historyHold}</p> : null}
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible">
          {history.slice(0, HISTORY_LIMIT).map((entry) => (
            <li key={entry.id} className="shrink-0">
              <RecentCheck
                entry={entry}
                label={
                  entry.result.farmerPlant ||
                  entry.result.detectedPlant ||
                  (entry.result.primaryCrop ? text.concepts[entry.result.primaryCrop] : text.marks)
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
      </div>
      </div>

      {!preview && !busy && (!plants || savedPlant) ? (
        <div id="mobile-action-bar" className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.09] bg-page/95 pt-3 shadow-[0_-16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => cameraRef.current?.click()} className="press min-h-14 rounded-full bg-leaf px-3 text-base font-semibold text-paper">
              {text.capture}
            </button>
            <button type="button" onClick={() => libraryRef.current?.click()} className="press min-h-14 rounded-full border border-white/[0.18] bg-field px-3 text-base font-semibold text-paper">
              {text.upload}
            </button>
          </div>
        </div>
      ) : null}
      {photos.length > 0 && !busy && !result ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.09] bg-page/95 pt-3 shadow-[0_-16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
              className="press min-h-14 w-full rounded-full bg-leaf px-4 text-base font-semibold tracking-tight text-paper lg:max-w-[28rem]"
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
  result,
  words,
  signedIn,
  onRescan,
  onNewCheck,
  onOpenProfile,
}: {
  locale: Locale;
  result: AnalyzeResult;
  words: UiWords;
  signedIn: boolean | null;
  onRescan: () => void;
  onNewCheck: () => void;
  onOpenProfile: () => void;
}) {
  const text = copy[locale];
  const severity = severityFor(result);
  const filed = Boolean(result.plantId);
  const [saved, setSaved] = useState(false);
  const [guestAsk, setGuestAsk] = useState(false);
  const [guestDismissed, setGuestDismissed] = useState(false);
  useEffect(() => {
    if (filed) buzz();
  }, [filed]);
  function save() {
    if (filed) {
      onOpenProfile();
      return;
    }
    if (!signedIn) {
      setGuestAsk(true);
      setGuestDismissed(false);
      return;
    }
    buzz();
    setSaved(true);
    window.setTimeout(onOpenProfile, 650);
  }
  const showGuest = !filed && signedIn === false && !guestDismissed && (guestAsk || !result.qualityHold);
  const score = Math.round(result.confidenceScore * 100);
  const pair = (result.likelyCauses?.length ?? 0) > 0 && (result.mitigations?.length ?? 0) > 0;
  let step = 1;
  const standsStep = String(step++).padStart(2, "0");
  const causeStep = (result.likelyCauses?.length ?? 0) > 0 ? String(step++).padStart(2, "0") : undefined;
  const mitigateStep = (result.mitigations?.length ?? 0) > 0 ? String(step++).padStart(2, "0") : undefined;
  const checkStep = String(step).padStart(2, "0");
  return (
    <section id="result" className="space-y-4 lg:space-y-5" aria-live="polite">
      {result.qualityNote ? (
        <p id="quality-note" className="rounded-2xl bg-[#f6b23a] px-4 py-3 text-base font-semibold leading-6 text-ink" role="status">
          {result.qualityNote}
        </p>
      ) : null}
      {result.qualityHold ? (
        <div id="quality-hold" className="rounded-[1.5rem] border-2 border-[#c56a00] bg-[#fff4dc] px-5 py-5" role="status">
          <p className="font-serif text-2xl leading-[1.04] tracking-[-0.01em] text-ink sm:text-3xl">{result.qualityMessage}</p>
        </div>
      ) : (
      <div id="result-reading" className="space-y-4 lg:space-y-5">
      {result.progress ? <ProgressNote locale={locale} progress={result.progress} /> : null}
      <div id="diagnosis-card" className={`rise rounded-[32px] border border-white/[0.18] ${severityBorder(severity)} bg-card p-5 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.9)] sm:p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {severity ? <SeverityLine severity={severity} words={words} /> : <p className="eyebrow text-mute">{words.diagnosis}</p>}
          <span className="eyebrow text-mute/70">
            {result.mode === "mock" ? text.modeMock : text.modeLive}
          </span>
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
            <span className="eyebrow block text-dusk">{text.confidence}</span>
            <span className="text-base font-semibold">{text.levelLabel(result.confidence)}</span>
            <span className="mt-1.5 block h-2 w-24 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full origin-left bg-leaf" style={{ width: `${score}%` }} />
            </span>
          </p>
        </div>
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
              onClick={save}
              className="lift min-h-12 rounded-full bg-leaf px-5 text-base font-semibold text-paper"
            >
              {words.saveToProfile}
            </button>
          )}
          <button id="rescan" type="button" onClick={onRescan} className="lift min-h-12 rounded-full border border-white/[0.18] px-4 text-base font-semibold text-paper">
            {words.rescan}
          </button>
          <button type="button" onClick={onNewCheck} className="press min-h-12 rounded-full px-3 text-base font-semibold text-mute hover:text-paper">
            {text.newCheck}
          </button>
        </div>
      </div>
      {showGuest && (guestAsk || filed === false) ? <GuestSavePrompt words={words} onDismiss={() => setGuestDismissed(true)} /> : null}

      <section id="result-stands-out" style={{ animationDelay: "120ms" }} className="rise overflow-hidden rounded-[28px] border border-[#c8881a]/60 bg-card shadow-[0_18px_50px_-32px_rgba(0,0,0,0.8)]">
        <div className="border-b border-[#c8881a]/40 bg-[#f8e7c4] px-4 py-4 text-ink sm:px-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60">{standsStep}</p>
          <h3 className="mt-1 font-serif text-2xl leading-[1.04] tracking-[-0.01em] sm:text-3xl">{text.observations}</h3>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          {result.masks.length === 0 ? <p className="text-base leading-6 text-mute">{text.noMasks}</p> : null}
          {CONCEPTS.some((concept) => result.counts[concept.id] > 0) ? (
            <ul className="flex flex-wrap gap-2">
              {CONCEPTS.filter((concept) => result.counts[concept.id] > 0).map((concept) => (
                <li key={concept.id} className="flex min-h-10 items-center gap-2 rounded-full border border-[#f6b23a]/50 bg-[#f6b23a]/15 px-3 py-2 text-sm font-semibold text-paper">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: concept.swatch }} />
                  {text.concepts[concept.id]} {result.counts[concept.id]}
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="space-y-3">
            {result.observations.map((item) => (
              <li key={item} className="border-l-4 border-[#e0941a] bg-field px-4 py-3 text-base leading-7 text-paper">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {pair ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AdviceList step={causeStep} id="result-causes" title={text.likelyCauses} hint={text.likelyCausesHint} items={result.likelyCauses ?? []} />
          <AdviceList step={mitigateStep} id="result-mitigation" title={text.mitigations} hint={text.mitigationsHint} items={result.mitigations ?? []} words={words} checklist />
        </div>
      ) : (
        <>
          <AdviceList step={causeStep} id="result-causes" title={text.likelyCauses} hint={text.likelyCausesHint} items={result.likelyCauses ?? []} />
          <AdviceList step={mitigateStep} id="result-mitigation" title={text.mitigations} hint={text.mitigationsHint} items={result.mitigations ?? []} words={words} checklist />
        </>
      )}

      <div id="result-checks" style={{ animationDelay: "280ms" }} className="rise rounded-[28px] border border-white/[0.09] bg-card p-4 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.8)] sm:p-5">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-clay">{checkStep}</p>
        <h3 className="mt-1 font-serif text-2xl leading-[1.04] tracking-[-0.01em] text-paper sm:text-3xl">{text.actions}</h3>
        <p className="mt-2 text-base leading-6 text-mute">{text.actionsHint}</p>
        <ol className="mt-4 space-y-3">
          {result.actions.map((action, index) => (
            <li key={action} className="flex items-start gap-3 rounded-2xl border border-white/[0.09] bg-field px-3 py-3 sm:px-4 sm:py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soil font-serif text-xl text-paper">
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

      <aside className="rounded-[28px] border border-beet/40 bg-beet/10 px-4 py-4 sm:px-5">
        <h3 className="font-serif text-2xl leading-[1.04] tracking-[-0.01em] text-beet">{text.askAgronomist}</h3>
        <p className="mt-2 text-base leading-7 text-paper">{result.agronomistCallout}</p>
      </aside>

      {result.note === "local-fallback" ? <p className="text-base leading-6 text-mute">{text.backupNote}</p> : null}

      <div>
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-dusk">{text.beforeYouAct}</h3>
        <p className="mt-2 text-base leading-7 text-paper/85">{result.disclaimer}</p>
      </div>
    </section>
  );
}

function CheckProgress({ text, step }: { text: Copy; step: number }) {
  const clamped = Math.min(2, Math.max(0, step));
  return (
    <div id="check-progress" className="mt-4 rounded-[28px] border-2 border-[#c56a00] bg-[#fff4dc] px-4 py-5 text-ink shadow-sm" role="status" aria-live="polite" aria-busy="true">
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
                  state === "wait" ? "bg-ink/10 text-ink/50" : "bg-soil text-paper"
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

function AdviceList({
  id,
  step,
  title,
  hint,
  items,
  words,
  checklist = false,
}: {
  id: string;
  step?: string;
  title: string;
  hint: string;
  items: readonly string[];
  words?: UiWords;
  checklist?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div id={id} style={{ animationDelay: "200ms" }} className="rise rounded-[28px] border border-white/[0.09] bg-card p-4 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.8)] transition-[border-color,box-shadow] duration-500 ease-out-soft sm:p-5 lg:hover:border-leaf/50 lg:hover:shadow-[0_0_40px_-16px_rgba(31,157,85,0.45)]">
      {step ? <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-clay">{step}</p> : null}
      <h3 className="mt-1 font-serif text-2xl leading-[1.04] tracking-[-0.01em] text-paper sm:text-3xl">{title}</h3>
      <p className="mt-2 text-base leading-6 text-mute">{hint}</p>
      {checklist && words ? (
        <Checklist id={`${id}-list`} items={items} words={words} />
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li key={item} style={{ animationDelay: `${240 + index * 100}ms` }} className="rise rounded-[20px] border border-white/[0.09] bg-field px-4 py-3 text-base leading-7">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChemicalCard({ text, advice }: { text: Copy; advice: ChemicalAdvice }) {
  return (
    <div className="space-y-4">
      <div id="result-chemicals" className="rounded-[28px] border border-leaf/30 bg-card px-4 py-5 sm:px-5">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-leaf">{text.chemicalsTitle}</h3>
        <p className="mt-2 text-base leading-7">
          <span className="font-semibold">{text.chemicalsSuspect}. </span>
          {advice.suspect}
        </p>
        <p className="mt-2 text-base leading-7 text-paper/85">{advice.verifyNote}</p>
        <ul className="mt-4 space-y-3">
          {advice.products.map((product) => (
            <li key={product.activeIngredient} className="rounded-2xl border border-white/[0.09] bg-field px-4 py-3">
              <p className="text-base font-semibold">{product.activeIngredient}</p>
              <p className="text-sm leading-6 text-mute">{product.productClass}</p>
              <p className="mt-1 text-base leading-7">{product.useNote}</p>
            </li>
          ))}
        </ul>
      </div>

      <div id="result-shops" className="rounded-[28px] border border-leaf/30 bg-card px-4 py-5 sm:px-5">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-leaf">{text.chemicalsWhere}</h3>
        <ul className="mt-3 space-y-3">
          {advice.products.map((product) => (
            <li key={product.activeIngredient} className="rounded-2xl border border-white/[0.09] bg-field px-4 py-3">
              <p className="text-base font-semibold">{product.activeIngredient}</p>
              {product.offers.length === 0 ? <p className="mt-1 text-base leading-6">{text.chemicalsNoShop}</p> : null}
              <ul className="mt-2 space-y-2">
                {orderedOffers(product.offers).map((offer) => (
                  <li key={`${product.activeIngredient}-${offer.quality}-${offer.brand}`} className="rounded-xl border border-white/[0.09] bg-card px-3 py-3 text-base leading-6">
                    <span className="font-semibold text-[#f6b23a]">{text.quality[offer.quality]}</span>
                    <span className="text-mute"> · {offer.brand} · {offer.pack}</span>
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
        <p className="mt-3 text-base leading-6 text-mute">{advice.priceNote}</p>
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
    <section id="home-context" className="rounded-[28px] border border-clay/40 bg-card p-5 transition-[border-color,box-shadow] duration-500 ease-out-soft sm:p-6 lg:hover:border-clay">
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
            <span className="mt-1 block text-base leading-6 text-mute">{filled ? previewText : text.contextHint}</span>
          )}
        </span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-clay/40 bg-clay/15 text-lg font-semibold text-clay">
          {open ? "–" : "+"}
        </span>
      </button>
      {ask ? (
        <p className="mt-3 rounded-2xl border border-beet/40 bg-beet/10 px-4 py-3 text-base leading-6 text-paper" role="status">
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
            placeholder={text.contextHint}
            aria-labelledby="context-title"
            aria-describedby="context-guide"
            onChange={(event) => onChange({ ...emptyFarmerContext(), notes: event.target.value })}
            className="min-h-32 w-full rounded-2xl border border-white/[0.18] bg-field px-4 py-3 text-base leading-7 font-normal text-paper placeholder:text-mute"
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
              className="press min-h-14 w-full rounded-full bg-leaf px-4 text-base font-semibold text-paper disabled:opacity-60"
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
      <div role="alertdialog" aria-label={ask} className="flex w-44 flex-col justify-between gap-3 rounded-[28px] border border-beet/50 bg-card p-3 lg:w-full">
        <p className="text-sm leading-5 text-paper">{ask}</p>
        <div className="grid grid-cols-1 gap-2">
          <button type="button" autoFocus onClick={() => setConfirm(false)} className="min-h-11 rounded-xl bg-soil px-3 text-sm font-semibold text-paper">
            {keepLabel}
          </button>
          <button type="button" onClick={onDelete} className="min-h-11 rounded-xl border border-beet/60 px-3 text-sm font-semibold text-beet">
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
        className={`w-full touch-manipulation overflow-hidden rounded-[28px] border bg-field text-left select-none transition-[border-color,box-shadow] duration-500 ease-out-soft ${current ? "border-onion lg:group-hover:border-clay" : "border-white/[0.09] lg:group-hover:border-leaf/50"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.thumbnail} alt="" className="h-28 w-full object-cover" />
        <span className="block px-3 py-3 text-sm font-semibold leading-5 text-paper">
          {label}
          <span className="mt-1 block font-normal text-mute">{confidence}</span>
          {current ? <span className="mt-1 hidden font-serif text-sm text-onion lg:group-hover:block">{currentLabel}</span> : null}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="absolute top-2 right-2 hidden min-h-11 rounded-xl bg-page/90 px-3 text-sm font-semibold text-paper lg:inline-flex lg:items-center lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
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
