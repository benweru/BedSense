/** Browser-side auth state, served by /api/auth. The Supabase key stays on the server. */

export type AuthUser = { email: string | null; phone: string | null };

export type AuthSession = { configured: boolean; user: AuthUser | null };

const AUTH_EVENT = "bedsense-auth";

export async function fetchSession(): Promise<AuthSession> {
  try {
    const response = await fetch("/api/auth", { cache: "no-store" });
    if (!response.ok) return { configured: false, user: null };
    return (await response.json()) as AuthSession;
  } catch {
    return { configured: false, user: null };
  }
}

/** HTTP status of the call, or 0 when it never reached the server. */
export async function authAction(body: Record<string, unknown>): Promise<number> {
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) notifyAuthChanged();
    return response.status;
  } catch {
    return 0;
  }
}

export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function onAuthChanged(callback: () => void): () => void {
  window.addEventListener(AUTH_EVENT, callback);
  return () => window.removeEventListener(AUTH_EVENT, callback);
}
