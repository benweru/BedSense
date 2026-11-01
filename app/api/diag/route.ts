import { NextResponse } from "next/server";
import { listMetaModels, readApiKey } from "@/lib/server/meta";

/** Deployment key check: key shape and catalog reachability, never the key itself. */
export async function GET(): Promise<Response> {
  const key = readApiKey();
  if (!key) return NextResponse.json({ ok: false, reason: "missing_key" }, { status: 503 });
  const fingerprint = { length: key.length, prefix: key.slice(0, 4), suffix: key.slice(-4) };
  try {
    const models = await listMetaModels(key, 8_000);
    return NextResponse.json({ ok: true, key: fingerprint, models: models.length });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status: unknown }).status) : 0;
    return NextResponse.json({ ok: false, key: fingerprint, catalogStatus: status }, { status: 503 });
  }
}
