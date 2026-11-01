"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { useLocale, writeLocale } from "@/lib/phone-store";
import type { Locale } from "@/lib/types";

export function SiteChrome({ children, pad }: { children: ReactNode; pad?: string }) {
  const locale = useLocale();
  const text = copy[locale];
  const pathname = usePathname();
  const router = useRouter();
  const home = pathname === "/";

  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-5 sm:px-6 sm:pt-8 lg:max-w-6xl lg:px-8 ${pad ?? "pb-12"}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {home ? null : (
            <button
              type="button"
              onClick={() => router.back()}
              className="min-h-11 rounded-full px-3 text-sm font-semibold text-mute hover:bg-ink/5 hover:text-paper"
            >
              {text.back}
            </button>
          )}
          <Link href="/" className="truncate font-serif text-2xl tracking-tight text-paper hover:text-leaf">
            {text.title}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => writeLocale((locale === "en" ? "sw" : "en") as Locale)}
            aria-label={text.language}
            className="press min-h-11 rounded-full border border-ink/10 bg-card px-4 text-sm font-semibold text-paper hover:text-leaf"
          >
            {locale === "en" ? "SW" : "EN"}
          </button>
          <Link
            href="/profile"
            aria-label={text.profile}
            className={`press flex min-h-11 items-center gap-2 rounded-full border px-3 hover:border-leaf hover:text-leaf ${pathname === "/profile" ? "border-leaf text-leaf" : "border-ink/10 text-paper"}`}
          >
            <ProfileIcon />
            <span className="hidden text-sm font-semibold sm:inline">{text.profile}</span>
          </Link>
        </div>
      </header>
      {children}
      <footer className="mt-10 space-y-1 text-center text-sm leading-6 text-mute">
        <p className="eyebrow">{text.kicker}</p>
        <p>{text.footer}</p>
      </footer>
    </div>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19.2c1.4-3 3.8-4.5 7-4.5s5.6 1.5 7 4.5" strokeLinecap="round" />
    </svg>
  );
}
