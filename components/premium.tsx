"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Severity } from "@/lib/severity";
import { INTRO_KEY, UI, type UiWords } from "@/lib/ui-copy";
import { writeLocale } from "@/lib/phone-store";
import type { Locale } from "@/lib/types";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Ticks through the three scan labels while SAM and Muse run. */
export function ScanStatus({ words }: { words: UiWords }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => Math.min(current + 1, words.scanSteps.length - 1)), 2600);
    return () => window.clearInterval(timer);
  }, [words.scanSteps.length]);
  return (
    <div id="check-progress" className="mt-4 rounded-lg border border-sun/50 bg-card px-4 py-4" role="status" aria-live="polite" aria-busy="true">
      <p key={step} className="tick-label text-2xl font-semibold leading-tight text-paper">
        {words.scanSteps[step]}
      </p>
      <ol className="mt-4 space-y-2.5">
        {words.scanSteps.map((label, index) => {
          const state = index < step ? "done" : index === step ? "current" : "next";
          return (
            <li key={label} className={`flex items-center gap-3 text-base leading-6 ${state === "next" ? "text-mute/70" : "text-paper"}`}>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  state === "done"
                    ? "border-leaf bg-leaf text-cream"
                    : state === "current"
                      ? "border-sun bg-sun/20"
                      : "border-ink/20"
                }`}
              >
                {state === "done" ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : state === "current" ? (
                  <span className="scan-pulse block h-2.5 w-2.5 rounded-[10px] bg-sun" />
                ) : null}
              </span>
              <span className={state === "current" ? "font-semibold" : ""}>{label.replace(/…$/, "")}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <span className="bedsense-indeterminate block h-full w-1/2 rounded-[10px] bg-sun" />
      </div>
    </div>
  );
}

/** Content-sized placeholder for the result column so nothing jumps when it lands. */
export function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="rounded-xl hairline surface-2 p-5 sm:p-6">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton mt-4 h-9 w-3/4" />
        <div className="skeleton mt-3 h-4 w-1/2" />
      </div>
      <div className="rounded-xl hairline surface-2 p-5 sm:p-6">
        <div className="skeleton h-6 w-40" />
        {[0, 1, 2].map((row) => (
          <div key={row} className="skeleton mt-3 h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

const TONE: Record<Severity, string> = {
  healthy: "border-l-leaf",
  watch: "border-l-sun",
  act: "border-l-danger",
};

/** Left-border tone for the diagnosis card. */
export function severityBorder(severity: Severity | null): string {
  return severity ? `border-l-[3px] ${TONE[severity]}` : "";
}

/** Quiet uppercase line, muted text, no pill or dot. */
export function SeverityLine({ severity, words }: { severity: Severity; words: UiWords }) {
  return (
    <p id="severity-line" data-severity={severity} className="eyebrow text-mute">
      {words.severityLine[severity]}
    </p>
  );
}

export function CheckMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Leaf sprouting into a check. Shown once on save; static under reduced motion. */
export function SavedBurst({ label }: { label: string }) {
  return (
    <span className="pop inline-flex items-center gap-2 text-base font-semibold text-leaf" role="status">
      <svg viewBox="0 0 32 32" className="sprout h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M16 28V14" strokeLinecap="round" />
        <path d="M16 16c0-6 4-9 10-9 0 6-4 9-10 9z" strokeLinejoin="round" />
        <path d="M16 19c0-4-3-7-8-7 0 4 3 7 8 7z" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

export function buzz() {
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(18);
  } catch {
    /* vibration is optional */
  }
}

/** Original vs masked photo toggle. */
export function MaskToggle({ showMasks, onChange, words }: { showMasks: boolean; onChange: (next: boolean) => void; words: UiWords }) {
  return (
    <div role="group" aria-label={`${words.original} / ${words.masked}`} className="mt-3 inline-flex rounded-full hairline surface-3 p-1">
      {[
        { on: false, label: words.original },
        { on: true, label: words.masked },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={showMasks === option.on}
          onClick={() => onChange(option.on)}
          className={`press min-h-11 rounded-full px-4 text-sm font-semibold ${showMasks === option.on ? "bg-leaf text-paper" : "text-mute hover:text-paper"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyIllustration() {
  return (
    <svg viewBox="0 0 160 120" className="h-28 w-36" aria-hidden="true">
      <defs>
        <linearGradient id="bs-soil" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5b3a26" />
          <stop offset="1" stopColor="#2a1a10" />
        </linearGradient>
        <linearGradient id="bs-leaf" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#4fd08a" />
          <stop offset="1" stopColor="#0b7a47" />
        </linearGradient>
      </defs>
      <circle cx="122" cy="26" r="12" fill="#e0941a" opacity="0.85" />
      <path d="M8 92c30-10 114-10 144 0v20H8z" fill="url(#bs-soil)" />
      <path d="M80 92V54" stroke="#1f9d55" strokeWidth="4" strokeLinecap="round" />
      <path d="M80 62c0-16 10-24 28-24 0 16-10 24-28 24z" fill="url(#bs-leaf)" />
      <path d="M80 72c0-12-8-19-22-19 0 12 8 19 22 19z" fill="url(#bs-leaf)" opacity="0.85" />
      <rect x="44" y="20" width="72" height="80" rx="14" fill="none" stroke="#f4f4f1" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />
    </svg>
  );
}

function subscribeIntro(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("bedsense-intro", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("bedsense-intro", callback);
  };
}

function introSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return true;
  }
}

/** Reopen the first-visit intro on demand (the seen flag survives a cache clear, so testers need this). */
export function replayIntro(): void {
  try {
    window.localStorage.removeItem(INTRO_KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("bedsense-intro"));
}

/** First-visit intro, shown once. Ends with a language picker on first visit. */
export function FirstVisitIntro({ locale }: { locale: Locale }) {
  const words = UI[locale];
  const seen = useSyncExternalStore(subscribeIntro, introSeen, () => true);
  const [card, setCard] = useState(0);
  const [picking, setPicking] = useState(false);
  if (seen) return null;
  const finish = () => {
    try {
      window.localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event("bedsense-intro"));
  };
  const choose = (next: Locale) => {
    writeLocale(next);
    finish();
  };
  const item = words.intro[card];
  const last = card === words.intro.length - 1;
  return createPortal(
    <div id="first-visit-intro" className="fade-in fixed inset-0 z-40 flex items-end justify-center bg-page/80 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={picking ? "Choose your language" : item.title}>
      {picking ? (
        <div className="rise w-full max-w-md rounded-xl hairline-strong surface-2 bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] ">
          <p className="eyebrow text-leaf">Language · Lugha</p>
          <h2 className="font-semibold mt-2 text-4xl leading-[1.04] text-paper">
            Choose your language<span className="text-mute">.</span>
          </h2>
          <p className="mt-3 text-base leading-7 text-mute">
            Chagua lugha yako.
            <span className="mt-1 block text-sm leading-6">Change it any time with the EN / SW button at the top · Badilisha wakati wowote kwa kitufe cha EN / SW kilicho juu.</span>
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" autoFocus onClick={() => choose("en")} className="press min-h-14 rounded-[10px] bg-leaf px-5 text-base font-semibold text-cream">
              English
            </button>
            <button type="button" onClick={() => choose("sw")} className="press min-h-14 rounded-[10px] bg-sun px-5 text-base font-semibold text-ink">
              Kiswahili
            </button>
          </div>
          <button type="button" onClick={finish} className="press mt-4 min-h-12 w-full rounded-full px-4 text-base font-semibold text-mute hover:text-paper">
            {words.skip}
          </button>
        </div>
      ) : (
      <div key={card} className="rise w-full max-w-md rounded-xl hairline-strong surface-2 bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] ">
        <p className="eyebrow text-leaf">
          {String(card + 1).padStart(2, "0")} / {String(words.intro.length).padStart(2, "0")}
        </p>
        <h2 className="font-semibold mt-2 text-4xl leading-[1.04] text-paper">
          {item.title}
          <span className="text-mute">.</span>
        </h2>
        <p className="mt-3 text-base leading-7 text-mute">{item.body}</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={finish} className="press min-h-12 rounded-full px-4 text-base font-semibold text-mute hover:text-paper">
            {words.skip}
          </button>
          <div className="h-px w-16 overflow-hidden bg-white/15" aria-hidden="true">
            <span className="block h-full origin-left bg-paper/70" style={{ transform: `scaleX(${(card + 1) / words.intro.length})`, transition: "transform 300ms cubic-bezier(.22,1,.36,1)" }} />
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => (last ? setPicking(true) : setCard(card + 1))}
            className="press min-h-12 rounded-[10px] bg-leaf px-5 text-base font-semibold text-cream"
          >
            {last ? words.start : words.next}
          </button>
        </div>
      </div>
      )}
    </div>,
    document.body,
  );
}

/** Live bars from the microphone level while a voice note records. */
export function Waveform({ levels }: { levels: readonly number[] }) {
  return (
    <span className="flex h-8 items-center gap-[3px]" aria-hidden="true">
      {levels.map((level, index) => (
        <span key={index} className="w-[3px] rounded-full bg-ink/70" style={{ height: `${Math.max(12, Math.min(100, level * 100))}%` }} />
      ))}
    </span>
  );
}
