import { NextResponse } from "next/server";
import { listMetaModels, MUSE_MODELS, postMeta, readApiKey } from "@/lib/server/meta";

/** Deployment key check: key shape, catalog reachability, and a 1-token chat probe. Never the key itself. */
export async function GET(): Promise<Response> {
  const key = readApiKey();
  if (!key) return NextResponse.json({ ok: false, reason: "missing_key" }, { status: 503 });
  const fingerprint = { length: key.length, prefix: key.slice(0, 4), suffix: key.slice(-4) };
  let models = -1;
  try {
    models = (await listMetaModels(key, 8_000)).length;
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status: unknown }).status) : 0;
    return NextResponse.json({ ok: false, key: fingerprint, catalogStatus: status }, { status: 503 });
  }
  let probe: { model: string; status: number; reason: string } | null = null;
  for (const model of MUSE_MODELS) {
    try {
      await postMeta(
        "/chat/completions",
        { model, messages: [{ role: "user", content: "Reply with the single word ok." }], max_tokens: 1 },
        key,
        15_000,
      );
      probe = { model, status: 200, reason: "ok" };
      break;
    } catch (error) {
      const status = error instanceof Error && "status" in error ? Number((error as { status: unknown }).status) : 0;
      const reason = error instanceof Error ? error.message : "error";
      probe = { model, status, reason };
      if (status !== 404) break;
    }
  }
  return NextResponse.json({ ok: probe?.status === 200, key: fingerprint, models, probe });
}
