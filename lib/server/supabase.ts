import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Request-scoped client. Row-level security limits every query to the signed-in farmer. */
export async function serverSupabase(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) store.set(name, value, options);
        } catch {
          // Read-only during render. proxy.ts refreshes the session cookie.
        }
      },
    },
  });
}

export async function sessionUser(): Promise<{ client: SupabaseClient; user: User } | null> {
  const client = await serverSupabase();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ? { client, user: data.user } : null;
}
