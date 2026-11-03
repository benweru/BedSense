import { badRequest, failed, readJson, text } from "@/lib/server/plant-api";
import { serverSupabase, sessionUser, supabaseConfigured } from "@/lib/server/supabase";

/** Auth state for the browser. The Supabase key never leaves the server. */
export async function GET(): Promise<Response> {
  if (!supabaseConfigured()) return Response.json({ configured: false, user: null });
  const session = await sessionUser();
  const user = session?.user;
  return Response.json({
    configured: true,
    user: user ? { email: user.email ?? null, phone: user.phone ?? null } : null,
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!supabaseConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });
  const body = await readJson(request);
  if (!body) return badRequest();
  const action = text(body.action, 16);
  const client = await serverSupabase();
  if (!client) return failed();

  if (action === "signout") {
    await client.auth.signOut();
    return Response.json({ ok: true });
  }

  const email = text(body.email, 254);
  const phone = text(body.phone, 32);
  const contact = email ? { email } : phone ? { phone } : null;
  if (!contact) return badRequest();

  if (action === "send") {
    // The confirmation link in the email must land on the domain the farmer
    // is actually using, not the project's default Site URL.
    const origin = new URL(request.url).origin;
    const { error } = await client.auth.signInWithOtp({
      ...contact,
      options: { shouldCreateUser: true, ...(email ? { emailRedirectTo: `${origin}/profile` } : {}) },
    });
    if (!error) return Response.json({ ok: true });
    return error.status === 429
      ? Response.json({ error: "rate_limited" }, { status: 429 })
      : Response.json({ error: "upstream", status: error.status ?? 0 }, { status: 502 });
  }

  if (action === "verify") {
    const code = text(body.code, 16);
    if (!code) return badRequest();
    const { error } = email
      ? await client.auth.verifyOtp({ email, token: code, type: "email" })
      : await client.auth.verifyOtp({ phone: phone as string, token: code, type: "sms" });
    if (!error) return Response.json({ ok: true });
    return error.status === 429
      ? Response.json({ error: "rate_limited" }, { status: 429 })
      : Response.json({ error: "upstream", status: error.status ?? 0 }, { status: 502 });
  }

  return badRequest();
}
