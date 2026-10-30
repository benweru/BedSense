import type { SupabaseClient, User } from "@supabase/supabase-js";
import { sessionUser, supabaseConfigured } from "@/lib/server/supabase";

export type Session = { client: SupabaseClient; user: User };

export async function requireSession(): Promise<Session | Response> {
  if (!supabaseConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });
  const session = await sessionUser();
  if (!session) return Response.json({ error: "signed_out" }, { status: 401 });
  return session;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

export function isoDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
}

export function badRequest(): Response {
  return Response.json({ error: "bad_request" }, { status: 400 });
}

export function failed(): Response {
  return Response.json({ error: "upstream" }, { status: 502 });
}
