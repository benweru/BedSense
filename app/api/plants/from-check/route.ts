import { decodeDataUrl } from "@/lib/image";
import { badRequest, failed, readJson, requireSession, text } from "@/lib/server/plant-api";
import { PLANT_COLUMNS, plantFromRow, supabasePlantStore } from "@/lib/server/plant-store";
import type { AnalyzeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Save to plant profile" on a finished check: creates a plant named from
 * the photo and files this check under it, so it appears in My plants.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  const body = await readJson(request);
  if (!body) return badRequest();

  const result = body.result as Partial<AnalyzeResult> | undefined;
  if (!result || typeof result.id !== "string" || typeof result.createdAt !== "string" || !Array.isArray(result.actions)) {
    return badRequest();
  }
  const name = text(result.farmerPlant || result.detectedPlant, 80) ?? text(body.name, 80);
  if (!name) return badRequest();

  let photo: { bytes: Uint8Array; mime: string };
  try {
    photo = decodeDataUrl(typeof body.thumbnail === "string" ? body.thumbnail : "");
  } catch {
    return badRequest();
  }

  const { data, error } = await session.client
    .from("plants")
    .insert({ user_id: session.user.id, name })
    .select(PLANT_COLUMNS)
    .single();
  if (error || !data) return failed();

  const plant = plantFromRow(data);
  await supabasePlantStore.save(plant.id, { ...(result as AnalyzeResult), plantId: plant.id }, photo);
  return Response.json(
    { plant: { ...plant, lastCheckAt: result.createdAt, checkCount: 1, nextRecheckAt: null, recheckReason: null } },
    { status: 201 },
  );
}
