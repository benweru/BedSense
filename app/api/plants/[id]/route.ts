import { failed, requireSession } from "@/lib/server/plant-api";
import { CHECK_COLUMNS, checksWithPhotos, isUuid, PHOTO_BUCKET, PLANT_COLUMNS, plantFromRow, PRACTICE_COLUMNS, practiceFromRow } from "@/lib/server/plant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMELINE_LIMIT = 30;

type Params = { params: Promise<{ id: string }> };

/** One plant with its checks and practice log, newest first. */
export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const session = await requireSession();
  if (session instanceof Response) return session;
  const { client } = session;
  const { data: plant, error } = await client.from("plants").select(PLANT_COLUMNS).eq("id", id).maybeSingle();
  if (error) return failed();
  if (!plant) return Response.json({ error: "not_found" }, { status: 404 });
  const [checks, practices] = await Promise.all([
    client.from("checks").select(CHECK_COLUMNS).eq("plant_id", id).order("created_at", { ascending: false }).limit(TIMELINE_LIMIT),
    client.from("practice_logs").select(PRACTICE_COLUMNS).eq("plant_id", id).order("logged_at", { ascending: false }).limit(TIMELINE_LIMIT),
  ]);
  if (checks.error || practices.error) return failed();
  return Response.json({
    plant: plantFromRow(plant),
    checks: await checksWithPhotos(client, checks.data ?? []),
    practices: (practices.data ?? []).map(practiceFromRow),
  });
}

export async function DELETE(_request: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const session = await requireSession();
  if (session instanceof Response) return session;
  const { client, user } = session;
  const { data: files } = await client.storage.from(PHOTO_BUCKET).list(`${user.id}/${id}`);
  if (files && files.length > 0) {
    await client.storage.from(PHOTO_BUCKET).remove(files.map((file) => `${user.id}/${id}/${file.name}`));
  }
  const { error } = await client.from("plants").delete().eq("id", id);
  if (error) return failed();
  return new Response(null, { status: 204 });
}
