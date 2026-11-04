"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useHistory, useLocale } from "@/lib/phone-store";
import { SHARE_SITE_URL, selectShareSummary } from "@/lib/share";

const WORDS = {
  en: {
    finding: "Finding",
    nextStep: "Next step",
    emptyTitle: "No check saved yet",
    emptyBody: "Run a check first, then share it from here.",
    missingTitle: "That check is not on this phone",
    missingBody: "It may have been deleted, or saved on another device.",
    runCheck: "Run a check",
    back: "Back to BedSense",
  },
  sw: {
    finding: "Ugunduzi",
    nextStep: "Hatua inayofuata",
    emptyTitle: "Hakuna ukaguzi uliohifadhiwa bado",
    emptyBody: "Fanya ukaguzi kwanza, kisha ushiriki kutoka hapa.",
    missingTitle: "Ukaguzi huo haupo kwenye simu hii",
    missingBody: "Huenda ulifutwa, au ulihifadhiwa kwenye kifaa kingine.",
    runCheck: "Fanya ukaguzi",
    back: "Rudi BedSense",
  },
} as const;

/** Screenshot-clean summary of one stored check. Renders from phone history, so mock and live results share it. */
export function ShareView() {
  const locale = useLocale();
  const history = useHistory();
  const words = WORDS[locale];
  const requestedId = useSearchParams().get("id");
  const entry = requestedId ? history.find((item) => item.id === requestedId) ?? null : (history[0] ?? null);

  if (!entry) {
    const missing = Boolean(requestedId) && history.length > 0;
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-5 px-4 py-10">
        <div className="rounded-lg border border-ink/20 bg-card p-6 text-center">
          <p className="font-serif text-2xl leading-tight tracking-[-0.02em] text-paper">{missing ? words.missingTitle : words.emptyTitle}</p>
          <p className="mt-2 text-base leading-7 text-mute">{missing ? words.missingBody : words.emptyBody}</p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-leaf px-5 text-base font-semibold text-cream"
          >
            {words.runCheck}
          </Link>
        </div>
        <p className="text-center">
          <Link href="/" className="text-sm font-semibold text-mute">
            {words.back}
          </Link>
        </p>
      </main>
    );
  }

  const summary = selectShareSummary(entry.result);
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-5 px-4 py-10">
      <div className="rounded-lg border border-ink/20 bg-card p-6 text-center">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-mute">BedSense</p>
        <p className="mt-2 font-serif text-3xl leading-tight tracking-[-0.02em] text-paper [overflow-wrap:anywhere]">
          {summary.plant}
        </p>
        <div className="my-4 h-px bg-ink/10" aria-hidden="true" />
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-mute">{words.finding}</p>
        <p className="mt-1 text-base leading-7 text-paper [overflow-wrap:anywhere]">{summary.finding || "–"}</p>
        <div className="my-4 h-px bg-ink/10" aria-hidden="true" />
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-mute">{words.nextStep}</p>
        <p className="mt-1 text-base font-semibold leading-7 text-paper [overflow-wrap:anywhere]">{summary.action || "–"}</p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-mute">{SHARE_SITE_URL.replace(/^https?:\/\//, "")}</p>
      </div>
      <p className="text-center">
        <Link href="/" className="text-sm font-semibold text-mute">
          {words.back}
        </Link>
      </p>
    </main>
  );
}
