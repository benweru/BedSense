"use client";

import { useSyncExternalStore } from "react";
import { HISTORY_KEY, LOCALE_KEY, parseHistory, serializeHistory } from "@/lib/history";
import type { HistoryEntry, Locale } from "@/lib/types";

const EMPTY_HISTORY: HistoryEntry[] = [];
const STORE_EVENT = "bedsense-storage";

let historyRaw: string | null | undefined;
let historySnapshot: HistoryEntry[] = EMPTY_HISTORY;

function emit(): void {
  window.dispatchEvent(new Event(STORE_EVENT));
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(STORE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(STORE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readLocale(): Locale {
  try {
    return window.localStorage.getItem(LOCALE_KEY) === "sw" ? "sw" : "en";
  } catch {
    return "en";
  }
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (raw === historyRaw) return historySnapshot;
    historyRaw = raw;
    historySnapshot = parseHistory(raw);
    return historySnapshot;
  } catch {
    return EMPTY_HISTORY;
  }
}

export function writeLocale(locale: Locale): void {
  window.localStorage.setItem(LOCALE_KEY, locale);
  emit();
}

export function writeHistory(entries: readonly HistoryEntry[]): void {
  const raw = serializeHistory(entries);
  window.localStorage.setItem(HISTORY_KEY, raw);
  historyRaw = raw;
  historySnapshot = entries.slice(0, 5);
  emit();
}

export function clearHistoryStore(): void {
  window.localStorage.removeItem(HISTORY_KEY);
  historyRaw = null;
  historySnapshot = EMPTY_HISTORY;
  emit();
}

function serverLocale(): Locale {
  return "en";
}

function serverHistory(): HistoryEntry[] {
  return EMPTY_HISTORY;
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, serverLocale);
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, readHistory, serverHistory);
}
