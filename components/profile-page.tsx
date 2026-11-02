"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountSignIn } from "@/components/plant-memory";
import { SiteChrome } from "@/components/site-chrome";
import { copy } from "@/lib/copy";
import { useLocale } from "@/lib/phone-store";
import { authAction, fetchSession, onAuthChanged, type AuthUser } from "@/lib/auth-client";

export function ProfilePage() {
  const locale = useLocale();
  const text = copy[locale];
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () =>
      void fetchSession().then((session) => {
        setUser(session.user);
        setReady(true);
      });
    load();
    return onAuthChanged(load);
  }, []);

  const phone = user?.phone ? `+${user.phone.replace(/^\+/, "")}` : null;
  const email = user?.email ?? null;

  return (
    <SiteChrome>
      <h1 className="mt-8 text-4xl tracking-tight text-paper">{text.profile}</h1>
      <section className="mt-6 rounded-xl border border-ink/10 bg-card p-5 sm:p-6">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-mute">{text.account}</h2>
        {!ready ? null : user ? (
          <>
            <p className="mt-3 text-2xl text-paper">{phone || email}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/plants" className="flex min-h-12 items-center rounded-lg border border-ink/10 px-4 text-base font-semibold text-paper hover:border-leaf hover:text-leaf">
                {locale === "sw" ? "Mimea yangu" : "My plants"}
              </Link>
              <button
                type="button"
                onClick={() => void authAction({ action: "signout" })}
                className="press min-h-12 rounded-[10px] bg-leaf px-4 text-base font-semibold text-cream hover:bg-danger"
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
