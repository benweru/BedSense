import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase, supabaseConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only same-site paths may be used as the post-sign-in destination. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/profile";
  return value;
}

/**
 * Landing for the Supabase email sign-in link. The link carries a one-time
 * `code`; exchanging it here writes the session cookie, then we send the
 * farmer to their profile. Without this route the link dead-ends.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const fail = NextResponse.redirect(new URL(`/profile?auth_error=1`, url.origin));

  if (!supabaseConfigured()) return fail;
  const code = url.searchParams.get("code");
  if (!code) return fail;

  const client = await serverSupabase();
  if (!client) return fail;
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return fail;

  return NextResponse.redirect(new URL(next, url.origin));
}
