import { badRequest, failed, isoDate, readJson, requireSession, text } from "@/lib/server/plant-api";
import { PLANT_COLUMNS, plantFromRow } from "@/lib/server/plant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saved plants, newest first, each with the time of its last check. */
export async function GET(): Promise<Response> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  const { client } = session;
  const { data, error } = await client.from("plants").select(`${PLANT_COLUMNS},checks(created_at)`).order("created_at", { ascending: false });
  if (error) return failed();
  const plants = (data ?? []).map((row) => {
    const checks = (row.checks ?? []) as { created_at: string }[];
    const lastCheckAt = checks.map((check) => check.created_at).sort().at(-1) ?? null;
    return { ...plantFromRow(row), lastCheckAt, checkCount: checks.length };
  });
  return Response.json({ plants });
}

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  const body = await readJson(request);
  const name = text(body?.name, 80);
  if (!body || !name) return badRequest();
  const { data, error } = await session.client
    .from("plants")
    .insert({
      user_id: session.user.id,
      name,
      crop: text(body.crop, 40),
      bed_label: text(body.bedLabel, 80),
      planted_on: isoDate(body.plantedOn),
      location: text(body.location, 120),
    })
    .select(PLANT_COLUMNS)
    .single();
  if (error || !data) return failed();
  return Response.json({ plant: { ...plantFromRow(data), lastCheckAt: null, checkCount: 0 } }, { status: 201 });
}
