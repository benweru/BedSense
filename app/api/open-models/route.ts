import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/server/meta";
import {
  completeOpenModels,
  isOpenModelsConfigured,
  openModelsBaseUrl,
  openModelsModel,
  OpenModelsError,
  readOpenModelsKey,
} from "@/lib/server/open-models";

/**
 * Open-weights path check in the /api/diag style: config resolution plus a
 * 1-token probe against the partner endpoint. Never the key itself. Partners
 * verify the live path in their own endpoint logs; this shows it resolving.
 */
export async function GET(): Promise<Response> {
  const mock = isMockMode();
  const base = openModelsBaseUrl();
  const model = openModelsModel();
  const configured = isOpenModelsConfigured();
  const started = Date.now();
  if (mock) {
    await completeOpenModels([{ role: "user", content: "Reply with the single word ok." }], {
      maxTokens: 16,
      timeoutMs: 10_000,
    });
    return NextResponse.json({ ok: true, mock, base, model, configured, latencyMs: Date.now() - started });
  }
  const key = readOpenModelsKey();
  if (!key) {
    return NextResponse.json({ ok: false, mock, base, model, configured, reason: "missing_key" }, { status: 503 });
  }
  const fingerprint = { length: key.length, prefix: key.slice(0, 4), suffix: key.slice(-4) };
  try {
    await completeOpenModels([{ role: "user", content: "Reply with the single word ok." }], {
      maxTokens: 16,
      timeoutMs: 10_000,
    });
    return NextResponse.json({ ok: true, mock, base, model, configured, key: fingerprint, latencyMs: Date.now() - started });
  } catch (error) {
    const reason = error instanceof OpenModelsError ? error.code : "upstream";
    return NextResponse.json({ ok: false, mock, base, model, configured, key: fingerprint, reason }, { status: 503 });
  }
}
