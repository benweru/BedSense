import { decodeDataUrl } from "@/lib/image";
import { badRequest, readJson, requireSession } from "@/lib/server/plant-api";
import { isUuid, supabasePlantStore } from "@/lib/server/plant-store";
import type { AnalyzeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_LIMIT = 5;

type Params = { params: Promise<{ id: string }> };

/** Files checks kept on the phone before sign-in under a saved plant. */
export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const session = await requireSession();
  if (session instanceof Response) return session;
  const body = await readJson(request);
  if (!body || !Array.isArray(body.entries)) return badRequest();
  const { data: plant } = await session.client.from("plants").select("id").eq("id", id).maybeSingle();
  if (!plant) return Response.json({ error: "not_found" }, { status: 404 });

  let imported = 0;
  for (const raw of body.entries.slice(0, IMPORT_LIMIT)) {
    const entry = raw as { thumbnail?: unknown; result?: Partial<AnalyzeResult> };
    const result = entry.result;
    if (!result || !isUuid(result.id) || typeof result.createdAt !== "string" || !Array.isArray(result.actions)) continue;
    if (typeof entry.thumbnail !== "string") continue;
    let photo;
    try {
      photo = decodeDataUrl(entry.thumbnail);
    } catch {
      continue;
    }
    await supabasePlantStore.save(id, { ...(result as AnalyzeResult), plantId: id }, photo);
    imported += 1;
  }
  return Response.json({ imported });
}
