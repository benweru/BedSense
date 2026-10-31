"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AccountSignIn } from "@/components/plant-memory";
import { SiteChrome } from "@/components/site-chrome";
import { copy } from "@/lib/copy";
import { useLocale } from "@/lib/phone-store";
import { browserSupabase } from "@/lib/supabase-browser";

export function ProfilePage() {
  const locale = useLocale();
  const text = copy[locale];
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const supabase = browserSupabase();

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
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
        {!ready ? null : user ? (
          <>
            <p className="mt-3 font-serif text-2xl text-paper">{phone || email}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/plants" className="flex min-h-12 items-center rounded-2xl border border-white/10 px-4 text-base font-semibold text-paper hover:border-leaf hover:text-leaf">
                {locale === "sw" ? "Mimea yangu" : "My plants"}
              </Link>
              <button
                type="button"
                onClick={() => void supabase?.auth.signOut()}
                className="min-h-12 rounded-2xl bg-soil px-4 text-base font-semibold text-paper hover:bg-beet"
              >
                {text.signOut}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-base leading-7 text-mute">{text.signedOut}</p>
            <div className="mt-6">
              <AccountSignIn locale={locale} heading={false} />
            </div>
          </>
        )}
      </section>
    </SiteChrome>
  );
}
