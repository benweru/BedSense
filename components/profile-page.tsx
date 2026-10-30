"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { SiteChrome } from "@/components/site-chrome";
import { copy } from "@/lib/copy";
import { useLocale } from "@/lib/phone-store";
import { browserSupabase } from "@/lib/supabase-browser";

export function ProfilePage() {
  const locale = useLocale();
  const text = copy[locale];
  const [user, setUser] = useState<User | null>(null);
  const supabase = browserSupabase();

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const phone = user?.phone ? `+${user.phone.replace(/^\+/, "")}` : null;
  const email = user?.email ?? null;

  return (
    <SiteChrome>
      <h1 className="mt-8 font-serif text-4xl tracking-tight text-paper">{text.profile}</h1>
      <section className="mt-6 rounded-[26px] border border-dusk/40 bg-card p-5 sm:p-6">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-dusk">{text.account}</h2>
        {user ? (
          <p className="mt-3 font-serif text-2xl text-paper">{phone || email}</p>
        ) : (
          <p className="mt-3 text-base leading-7 text-mute">{text.signedOut}</p>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/plants" className="min-h-12 rounded-2xl border border-white/10 px-4 py-3 text-base font-semibold text-paper hover:border-leaf hover:text-leaf">
            {locale === "sw" ? "Mimea yangu" : "My plants"}
          </Link>
          {user ? (
            <button
              type="button"
              onClick={() => void supabase?.auth.signOut()}
              className="min-h-12 rounded-2xl bg-soil px-4 text-base font-semibold text-paper hover:bg-beet"
            >
              {text.signOut}
            </button>
          ) : (
            <Link href="/plants" className="min-h-12 rounded-2xl bg-leaf px-4 py-3 text-center text-base font-semibold text-paper hover:bg-soil">
              {locale === "sw" ? "Ingia" : "Sign in"}
            </Link>
          )}
        </div>
      </section>
    </SiteChrome>
  );
}
