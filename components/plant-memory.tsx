"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { VoiceNote } from "@/components/voice-context";
import { daysBetween, recheckDue } from "@/lib/memory";
import { writeHistory } from "@/lib/phone-store";
import { browserSupabase } from "@/lib/supabase-browser";
import {
  PRACTICE_KINDS,
  type GrowthTrend,
  type HistoryEntry,
  type Locale,
  type PlantCheck,
  type PlantProgress,
  type PlantRecord,
  type PracticeKind,
  type PracticeLog,
} from "@/lib/types";

export type SavedPlant = PlantRecord & { lastCheckAt: string | null; checkCount: number };

const WORDS = {
  en: {
    title: "My plants",
    view: "View my plants",
    signInLead: "Create an account with your phone number. Then save a plant and photograph it again in 2 or 3 days.",
    phone: "Phone number",
    phoneHint: "We send a code by SMS. A Safaricom, Airtel, or Telkom number is enough.",
    useEmail: "Use email instead",
    usePhone: "Use a phone number",
    email: "Email",
    sendCode: "Send code",
    code: "Code from the SMS",
    emailCode: "Code from the email",
    verify: "Sign in",
    codeSent: "We sent a code to your phone.",
    emailSent: "We sent a code to your email.",
    signOut: "Sign out",
    authError: "Sign-in did not work. Check the email or number and try again.",
    noPlant: "Don't save this check",
    newPlant: "New plant",
    plantName: "Plant name",
    bedLabel: "Bed (optional)",
    plantedOn: "Planted on (optional)",
    save: "Save plant",
    cancel: "Cancel",
    recheckDue: "Re-check due",
    checks: (count: number) => `${count} check${count === 1 ? "" : "s"}`,
    lastChecked: (days: number) => (days === 0 ? "Checked today" : `Last check ${days} day${days === 1 ? "" : "s"} ago`),
    never: "No checks yet",
    none: "No plants yet",
    timeline: "Timeline",
    emptyTimeline: "Photograph this plant to start its timeline.",
    practiceTitle: "What did you do since last time?",
    practiceNote: "For example: watered every morning, removed curled leaves",
    practiceVoice: "Talk",
    practiceListening: "Tap to finish",
    logIt: "Log it",
    kinds: { watering: "Watering", fertilizer: "Feeding", spray: "Spray", pruning: "Pruning", other: "Other" } as Record<PracticeKind, string>,
    importButton: "Add from recent checks",
    importLead: "Which of these checks are this plant? Ones already saved on another plant are left out.",
    importYes: "Add selected",
    importNone: "Select at least one check.",
    importNo: "Not now",
    deletePlant: "Delete plant",
    removeCheck: "Remove",
    confirmDelete: "Delete this plant and its photos?",
    loadError: "Could not load your plants. Try again.",
    working: "Saving",
  },
  sw: {
    title: "Mimea yangu",
    view: "Ona mimea yangu",
    signInLead: "Fungua akaunti kwa nambari yako ya simu. Kisha hifadhi mmea na uupige picha tena baada ya siku 2 au 3.",
    phone: "Nambari ya simu",
    phoneHint: "Tunatuma nambari kwa SMS. Nambari ya Safaricom, Airtel, au Telkom inatosha.",
    useEmail: "Tumia barua pepe badala yake",
    usePhone: "Tumia nambari ya simu",
    email: "Barua pepe",
    sendCode: "Tuma nambari",
    code: "Nambari kutoka kwa SMS",
    emailCode: "Nambari kutoka kwa barua pepe",
    verify: "Ingia",
    codeSent: "Tumetuma nambari kwenye simu yako.",
    emailSent: "Tumetuma nambari kwenye barua pepe yako.",
    signOut: "Toka",
    authError: "Kuingia hakukufaulu. Kagua barua pepe au nambari ujaribu tena.",
    noPlant: "Usihifadhi ukaguzi huu",
    newPlant: "Mmea mpya",
    plantName: "Jina la mmea",
    bedLabel: "Kitalu (si lazima)",
    plantedOn: "Tarehe ya kupanda (si lazima)",
    save: "Hifadhi mmea",
    cancel: "Ghairi",
    recheckDue: "Wakati wa kukagua tena",
    checks: (count: number) => `Ukaguzi ${count}`,
    lastChecked: (days: number) => (days === 0 ? "Umekaguliwa leo" : `Ukaguzi wa mwisho siku ${days} zilizopita`),
    never: "Bado hakuna ukaguzi",
    none: "Bado hakuna mimea",
    timeline: "Historia",
    emptyTimeline: "Piga picha ya mmea huu kuanza historia yake.",
    practiceTitle: "Ulifanya nini tangu mara ya mwisho?",
    practiceNote: "Mfano: nilimwagilia kila asubuhi, niliondoa majani yaliyojikunja",
    practiceVoice: "Sema",
    practiceListening: "Gusa kumaliza",
    logIt: "Hifadhi",
    kinds: { watering: "Kumwagilia", fertilizer: "Mbolea", spray: "Dawa", pruning: "Kupogoa", other: "Nyingine" } as Record<PracticeKind, string>,
    importButton: "Ongeza kutoka ukaguzi wa karibuni",
    importLead: "Ni ukaguzi upi wa mmea huu? Uliowekwa kwenye mmea mwingine hauonyeshwi.",
    importYes: "Ongeza uliochagua",
    importNone: "Chagua angalau ukaguzi mmoja.",
    importNo: "Si sasa",
    deletePlant: "Futa mmea",
    removeCheck: "Ondoa",
    confirmDelete: "Futa mmea huu na picha zake?",
    loadError: "Imeshindwa kupakia mimea yako. Jaribu tena.",
    working: "Inahifadhi",
  },
} as const;

type Words = (typeof WORDS)[Locale];

const TREND_LABEL: Record<Locale, Record<GrowthTrend, string>> = {
  en: { improving: "Improving", stable: "About the same", declining: "Getting worse" },
  sw: { improving: "Unaendelea vizuri", stable: "Hali ileile", declining: "Unazidi kudhoofika" },
};

export function ProgressNote({ locale, progress }: { locale: Locale; progress: PlantProgress }) {
  const flowering = progress.flowering === null ? null : locale === "sw" ? (progress.flowering ? "Unatoa maua" : "Bado hautoi maua") : progress.flowering ? "Flowering" : "Not flowering yet";
  return (
    <div id="plant-progress" className="rounded-2xl border border-leaf/50 bg-leaf/10 px-4 py-3" role="status">
      <p className="flex flex-wrap gap-2 text-sm font-semibold text-paper">
        {progress.growthTrend ? <span className="rounded-full bg-leaf/25 px-3 py-1">{TREND_LABEL[locale][progress.growthTrend]}</span> : null}
        {flowering ? <span className="rounded-full bg-white/10 px-3 py-1">{flowering}</span> : null}
      </p>
      {progress.sinceLastCheck ? <p className="mt-2 text-base leading-6 text-paper">{progress.sinceLastCheck}</p> : null}
    </div>
  );
}

/** Home card. The plant list and a new check for one plant live on /plants. */
export function PlantsHomeCard({ locale }: { locale: Locale }) {
  const words = WORDS[locale];
  const [plants, setPlants] = useState<SavedPlant[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    if (!browserSupabase()) return;
    void fetch("/api/plants", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          setSignedOut(true);
          setPlants([]);
          return;
        }
        if (!response.ok) return;
        const body = (await response.json()) as { plants: SavedPlant[] };
        setPlants(body.plants);
      })
      .catch(() => undefined);
  }, []);
  if (!browserSupabase()) return null;
  return (
    <Link href="/plants" className="block rounded-[26px] border border-dusk/40 bg-card p-5 transition-colors hover:border-dusk sm:p-6">
      <h2 className="font-serif text-2xl leading-tight text-paper">{words.view}</h2>
      {signedOut ? <p className="mt-2 text-sm leading-6 text-mute">{words.signInLead}</p> : null}
      {plants && plants.length === 0 && !signedOut ? <p className="mt-2 text-sm leading-6 text-mute">{words.none}</p> : null}
      <ul className="mt-3 space-y-1">
        {(plants ?? []).map((plant) => {
          const days = plant.lastCheckAt ? daysBetween(plant.lastCheckAt, new Date()) : null;
          return (
            <li key={plant.id} className="text-sm leading-6 text-mute">
              <span className="font-semibold text-paper">{plant.name}</span>
              {plant.bedLabel ? ` · ${plant.bedLabel}` : ""} · {days === null ? words.never : words.lastChecked(days)}
            </li>
          );
        })}
      </ul>
    </Link>
  );
}

export function PlantMemory({
  locale,
  selected,
  onSelect,
  history,
  refreshKey,
  disabled,
}: {
  locale: Locale;
  selected: SavedPlant | null;
  onSelect: (plant: SavedPlant | null) => void;
  history: readonly HistoryEntry[];
  /** Bumped after a check finishes so the list and timeline reload. */
  refreshKey: number;
  disabled: boolean;
}) {
  const supabase = browserSupabase();
  const words = WORDS[locale];
  const [user, setUser] = useState<User | null>(null);
  const [plants, setPlants] = useState<SavedPlant[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const loadPlants = useCallback(async () => {
    setPlantsLoading(true);
    const response = await fetch("/api/plants", { cache: "no-store" });
    setPlantsLoading(false);
    if (!response.ok) {
      setError(words.loadError);
      return;
    }
    const body = (await response.json()) as { plants: SavedPlant[] };
    setError(null);
    setPlants(body.plants);
  }, [words.loadError]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch result lands in state
    void loadPlants();
  }, [user, refreshKey, loadPlants]);

  useEffect(() => {
    if (!selected) return;
    const fresh = plants.find((plant) => plant.id === selected.id);
    if (!fresh) return;
    if (fresh.lastCheckAt !== selected.lastCheckAt || fresh.checkCount !== selected.checkCount) onSelect(fresh);
  }, [plants, selected, onSelect]);

  if (!supabase) return null;

  if (!user) return <SignIn words={words} />;

  return (
    <section id="plant-memory" className="rounded-[26px] border border-dusk/40 bg-card p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.7)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl leading-tight text-paper">{words.title}</h2>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            void supabase.auth.signOut();
          }}
          className="min-h-11 rounded-full px-3 text-sm font-semibold text-mute hover:text-paper"
        >
          {words.signOut}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-base text-beet" role="alert">
          {error}
        </p>
      ) : null}

      {plantsLoading && plants.length === 0 ? <p className="mt-4"><Spinner /></p> : null}
      <div role="radiogroup" aria-label={words.title} className="mt-3 flex flex-col gap-2">
        {plants.map((plant) => {
          const due = recheckDue(plant.lastCheckAt, new Date());
          const days = plant.lastCheckAt ? daysBetween(plant.lastCheckAt, new Date()) : null;
          const active = selected?.id === plant.id;
          return (
            <button
              key={plant.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onSelect(active ? null : plant)}
              className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left ${
                active ? "border-leaf bg-leaf/15" : "border-white/15 bg-field"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-paper">
                  {plant.name}
                  {plant.bedLabel ? <span className="font-normal text-mute"> · {plant.bedLabel}</span> : null}
                </span>
                <span className="block text-sm text-mute">
                  {days === null ? words.never : words.lastChecked(days)} · {words.checks(plant.checkCount)}
                </span>
              </span>
              {due ? <span className="shrink-0 rounded-full bg-[#f6b23a] px-3 py-1 text-xs font-semibold text-ink">{words.recheckDue}</span> : null}
            </button>
          );
        })}
        {selected ? (
          <button type="button" disabled={disabled} onClick={() => onSelect(null)} className="min-h-11 text-left text-sm font-semibold text-mute hover:text-paper">
            {words.noPlant}
          </button>
        ) : null}
      </div>

      {!selected && creating ? (
        <NewPlantForm
          words={words}
          onCancel={() => setCreating(false)}
          onCreated={(plant) => {
            setCreating(false);
            setPlants((current) => [plant, ...current]);
            onSelect(plant);
          }}
        />
      ) : null}
      {!selected && !creating ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCreating(true)}
          className="mt-3 min-h-12 w-full rounded-2xl border border-dashed border-leaf/60 text-base font-semibold text-paper"
        >
          + {words.newPlant}
        </button>
      ) : null}

      {selected ? (
        <Timeline
          key={`${selected.id}-${refreshKey}`}
          locale={locale}
          words={words}
          plant={selected}
          history={history}
          onImported={() => void loadPlants()}
          onDeleted={() => {
            onSelect(null);
            void loadPlants();
          }}
        />
      ) : null}
    </section>
  );
}

/** Kenyan mobile numbers: 07…, 01…, 254…, or +254…. */
function kenyaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  const local = digits.startsWith("254") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[17]\d{8}$/.test(local) ? `+254${local}` : null;
}

function Spinner() {
  return (
    <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-leaf" role="status" aria-label="Loading" />
  );
}

export function AccountSignIn({ locale, heading = true }: { locale: Locale; heading?: boolean }) {
  return <SignIn words={WORDS[locale]} heading={heading} />;
}

function SignIn({ words, heading = true }: { words: Words; heading?: boolean }) {
  const supabase = browserSupabase();
  const [byEmail, setByEmail] = useState(false);
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const phone = byEmail ? null : kenyaPhone(target);

  async function send() {
    if (!supabase) return;
    const contact = byEmail ? (target.includes("@") ? { email: target.trim() } : null) : phone ? { phone } : null;
    if (!contact) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    const { error: failure } = await supabase.auth.signInWithOtp({ ...contact, options: { shouldCreateUser: true } });
    setBusy(false);
    if (failure) setError(true);
    else setSent(true);
  }

  async function verify() {
    if (!supabase || !code.trim()) return;
    setBusy(true);
    setError(false);
    const { error: failure } = byEmail
      ? await supabase.auth.verifyOtp({ email: target.trim(), token: code.trim(), type: "email" })
      : phone
        ? await supabase.auth.verifyOtp({ phone, token: code.trim(), type: "sms" })
        : { error: new Error("phone") };
    setBusy(false);
    if (failure) setError(true);
  }

  return (
    <section id="plant-memory" className="rounded-[26px] border border-dusk/40 bg-card p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.7)] sm:p-6">
      {heading ? <h2 className="font-serif text-2xl leading-tight text-paper">{words.title}</h2> : null}
      <p className={`text-base leading-6 text-mute ${heading ? "mt-2" : ""}`}>{words.signInLead}</p>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void (sent ? verify() : send());
        }}
      >
        <label className="text-sm font-semibold text-paper" htmlFor="account-contact">
          {byEmail ? words.email : words.phone}
        </label>
        <input
          id="account-contact"
          aria-label={byEmail ? words.email : words.phone}
          placeholder={byEmail ? "you@email.com" : "0712 345 678"}
          value={target}
          inputMode={byEmail ? "email" : "tel"}
          autoComplete={byEmail ? "email" : "tel"}
          onChange={(event) => {
            setTarget(event.target.value);
            setSent(false);
            setError(false);
          }}
          className="min-h-12 rounded-2xl border border-white/15 bg-field px-4 text-base text-paper placeholder:text-mute"
        />
        {byEmail ? null : <p className="text-sm leading-6 text-mute">{words.phoneHint}</p>}
        {sent ? (
          <>
            <p className="text-sm text-mute">{byEmail ? words.emailSent : words.codeSent}</p>
            <input
              aria-label={byEmail ? words.emailCode : words.code}
              placeholder={byEmail ? words.emailCode : words.code}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(event) => setCode(event.target.value)}
              className="min-h-12 rounded-2xl border border-white/15 bg-field px-4 text-base text-paper placeholder:text-mute"
            />
          </>
        ) : null}
        <button type="submit" disabled={busy} className="min-h-12 rounded-2xl bg-leaf px-4 text-base font-semibold text-paper disabled:opacity-60">
          {sent ? words.verify : words.sendCode}
        </button>
        <button
          type="button"
          onClick={() => {
            setByEmail((current) => !current);
            setTarget("");
            setCode("");
            setSent(false);
            setError(false);
          }}
          className="min-h-11 text-sm font-semibold text-mute hover:text-paper"
        >
          {byEmail ? words.usePhone : words.useEmail}
        </button>
        {error ? (
          <p className="text-base text-beet" role="alert">
            {words.authError}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function NewPlantForm({ words, onCancel, onCreated }: { words: Words; onCancel: () => void; onCreated: (plant: SavedPlant) => void }) {
  const [name, setName] = useState("");
  const [bedLabel, setBedLabel] = useState("");
  const [plantedOn, setPlantedOn] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const response = await fetch("/api/plants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, bedLabel, plantedOn: plantedOn || null }),
    });
    setBusy(false);
    if (!response.ok) return;
    const body = (await response.json()) as { plant: SavedPlant };
    onCreated(body.plant);
  }

  const field = "min-h-12 rounded-2xl border border-white/15 bg-field px-4 text-base text-paper placeholder:text-mute";
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input aria-label={words.plantName} placeholder={words.plantName} value={name} required onChange={(event) => setName(event.target.value)} className={field} />
      <input aria-label={words.bedLabel} placeholder={words.bedLabel} value={bedLabel} onChange={(event) => setBedLabel(event.target.value)} className={field} />
      <label className="text-sm text-mute">
        {words.plantedOn}
        <input type="date" value={plantedOn} onChange={(event) => setPlantedOn(event.target.value)} className={`mt-1 w-full ${field}`} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !name.trim()} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-leaf px-4 text-base font-semibold text-paper disabled:opacity-60">
          {busy ? <Spinner /> : words.save}
        </button>
        <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl border border-white/15 px-4 text-base font-semibold text-paper">
          {words.cancel}
        </button>
      </div>
    </form>
  );
}

function Timeline({
  locale,
  words,
  plant,
  history,
  onImported,
  onDeleted,
}: {
  locale: Locale;
  words: Words;
  plant: SavedPlant;
  history: readonly HistoryEntry[];
  onImported: () => void;
  onDeleted: () => void;
}) {
  const [checks, setChecks] = useState<PlantCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [practices, setPractices] = useState<PracticeLog[]>([]);
  const [note, setNote] = useState("");
  const [importable, setImportable] = useState<HistoryEntry[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(plant.checkCount === 0);
  const [importHint, setImportHint] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plants/${plant.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { checks: PlantCheck[]; practices: PracticeLog[] };
      setChecks(body.checks);
      setPractices(body.practices);
    } finally {
      setLoading(false);
    }
  }, [plant.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch result lands in state
    void load();
  }, [load]);

  useEffect(() => {
    const filed = new Set(checks.map((check) => check.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from local history
    setImportable(
      history.filter((entry) => {
        const owner = entry.result.plantId;
        return !filed.has(entry.id) && (!owner || owner === plant.id);
      }),
    );
  }, [history, checks, plant.id]);

  function claimLocal(ids: string[]) {
    const next = history.map((entry) =>
      ids.includes(entry.id) ? { ...entry, result: { ...entry.result, plantId: plant.id } } : entry,
    );
    writeHistory(next);
    setPicked((current) => current.filter((id) => !ids.includes(id)));
  }

  async function importLocal() {
    const entries = importable.filter((entry) => picked.includes(entry.id));
    if (entries.length === 0) {
      setImportHint(true);
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/plants/${plant.id}/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    setSaving(false);
    if (!response.ok) return;
    claimLocal(entries.map((entry) => entry.id));
    setImportOpen(false);
    await load();
    onImported();
  }

  async function logPractice() {
    if (!note.trim()) return;
    setSaving(true);
    const response = await fetch(`/api/plants/${plant.id}/practices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "other", note }),
    });
    setSaving(false);
    if (!response.ok) return;
    const body = (await response.json()) as { practice: PracticeLog };
    setPractices((current) => [body.practice, ...current]);
    setNote("");
  }

  async function removeCheck(checkId: string) {
    setRemovingId(checkId);
    const response = await fetch(`/api/plants/${plant.id}/checks/${checkId}`, { method: "DELETE" });
    setRemovingId(null);
    if (!response.ok) return;
    setChecks((current) => current.filter((check) => check.id !== checkId));
    onImported();
  }

  async function remove() {
    const response = await fetch(`/api/plants/${plant.id}`, { method: "DELETE" });
    if (response.ok) onDeleted();
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "sw" ? "sw-KE" : "en-KE", { day: "numeric", month: "short" });
  const events = [
    ...checks.map((check) => ({ at: check.createdAt, check, practice: null as PracticeLog | null })),
    ...practices.map((practice) => ({ at: practice.loggedAt, check: null as PlantCheck | null, practice })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div id="plant-timeline" className="mt-5 border-t border-white/10 pt-5">
      {loading || saving ? <p className="mb-3"><Spinner /></p> : null}
      {importable.length > 0 && !importOpen ? (
        <button type="button" onClick={() => setImportOpen(true)} className="mb-4 min-h-12 w-full rounded-2xl border border-dashed border-leaf/60 text-base font-semibold text-paper">
          {words.importButton}
        </button>
      ) : null}
      {importOpen && importable.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-white/15 bg-field p-3">
          <p className="text-base text-paper">{words.importLead}</p>
          <ul className="mt-3 space-y-2">
            {importable.map((entry) => {
              const on = picked.includes(entry.id);
              const name = entry.result.farmerPlant || entry.result.detectedPlant;
              return (
                <li key={entry.id}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-2 py-2 ${on ? "border-leaf bg-leaf/15" : "border-white/10"}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        setImportHint(false);
                        setPicked((current) => (on ? current.filter((id) => id !== entry.id) : [...current, entry.id]));
                      }}
                      className="h-5 w-5 shrink-0 accent-leaf"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- local check thumbnail */}
                    <img src={entry.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-paper">{dateFormat.format(new Date(entry.createdAt))}</span>
                      <span className="block truncate text-sm text-mute">{name}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {importHint ? <p className="mt-2 text-sm text-beet">{words.importNone}</p> : null}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void importLocal()} className="min-h-11 rounded-full bg-leaf px-4 text-sm font-semibold text-paper">
              {words.importYes}
            </button>
            <button type="button" onClick={() => setImportOpen(false)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-mute">
              {words.importNo}
            </button>
          </div>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void logPractice();
        }}
      >
        <p className="text-base font-semibold text-paper">{words.practiceTitle}</p>
        <textarea
          aria-label={words.practiceTitle}
          placeholder={words.practiceNote}
          value={note}
          maxLength={500}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-24 w-full rounded-2xl border border-white/15 bg-field px-4 py-3 text-base text-paper placeholder:text-mute"
        />
        <div className="flex flex-wrap items-center gap-2">
          <VoiceNote
            locale={locale}
            disabled={false}
            label={words.practiceVoice}
            listeningLabel={words.practiceListening}
            onTranscript={(transcript) => setNote((current) => (current ? `${current} ${transcript}` : transcript).slice(0, 500))}
          />
          <button type="submit" disabled={!note.trim() || saving} className="min-h-12 rounded-2xl bg-leaf px-4 text-base font-semibold text-paper disabled:opacity-60">
            {words.logIt}
          </button>
        </div>
      </form>

      <h3 className="mt-5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-mute">{words.timeline}</h3>
      {events.length === 0 ? <p className="mt-2 text-base text-mute">{words.emptyTimeline}</p> : null}
      <ol className="mt-2 space-y-2">
        {events.map((event) => {
          const check = event.check;
          return check ? (
            <li key={`c-${check.id}`} className="flex gap-3 rounded-2xl bg-field p-2">
              {check.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={check.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="h-16 w-16 shrink-0 rounded-xl bg-white/5" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-paper">
                  {dateFormat.format(new Date(check.createdAt))}
                  {check.result.progress?.growthTrend ? ` · ${TREND_LABEL[locale][check.result.progress.growthTrend]}` : ""}
                </span>
                <span className="line-clamp-2 block text-sm leading-5 text-mute">{check.summary ?? check.result.actions[0]}</span>
                {removingId === check.id ? (
                  <span className="mt-2 inline-flex"><Spinner /></span>
                ) : (
                  <button type="button" onClick={() => void removeCheck(check.id)} className="mt-1 min-h-10 text-sm font-semibold text-mute hover:text-beet">
                    {words.removeCheck}
                  </button>
                )}
              </span>
            </li>
          ) : event.practice ? (
            <li key={`p-${event.practice.id}`} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-mute">
              <span className="font-semibold text-paper">{dateFormat.format(new Date(event.practice.loggedAt))}</span> · {words.kinds[event.practice.kind]}: {event.practice.note}
            </li>
          ) : null;
        })}
      </ol>

      <div className="mt-4">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-paper">{words.confirmDelete}</span>
            <button type="button" onClick={() => void remove()} className="min-h-11 rounded-full bg-beet px-4 text-sm font-semibold text-paper">
              {words.deletePlant}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-mute">
              {words.cancel}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-sm font-semibold text-mute hover:text-beet">
            {words.deletePlant}
          </button>
        )}
      </div>
    </div>
  );
}
