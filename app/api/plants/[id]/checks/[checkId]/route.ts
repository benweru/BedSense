import { failed, requireSession } from "@/lib/server/plant-api";
import { isUuid, PHOTO_BUCKET } from "@/lib/server/plant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; checkId: string }> };

/** Removes one saved check and its photo. Recent checks on the phone are separate. */
export async function DELETE(_request: Request, { params }: Params): Promise<Response> {
  const { id, checkId } = await params;
  if (!isUuid(id) || !isUuid(checkId)) return Response.json({ error: "not_found" }, { status: 404 });
  const session = await requireSession();
  if (session instanceof Response) return session;
  const { client } = session;
  const { data: row, error: readError } = await client.from("checks").select("photo_path").eq("id", checkId).eq("plant_id", id).maybeSingle();
  if (readError) return failed();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.photo_path) await client.storage.from(PHOTO_BUCKET).remove([row.photo_path]);
  const { error } = await client.from("checks").delete().eq("id", checkId).eq("plant_id", id);
  if (error) return failed();
  return new Response(null, { status: 204 });
}
