import { containsDosage } from "@/lib/triage";
import { badRequest, failed, readJson, requireSession, text } from "@/lib/server/plant-api";
import { isUuid, PRACTICE_COLUMNS, practiceFromRow } from "@/lib/server/plant-store";
import { PRACTICE_KINDS, type PracticeKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** What the farmer did on this plant since the last check: watering, feeding, spraying, pruning. */
export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const session = await requireSession();
  if (session instanceof Response) return session;
  const body = await readJson(request);
  const note = text(body?.note, 500);
  const kind = (PRACTICE_KINDS as readonly string[]).includes(String(body?.kind)) ? (body?.kind as PracticeKind) : "other";
  if (!note) return badRequest();
  const { data, error } = await session.client
    .from("practice_logs")
    .insert({ plant_id: id, user_id: session.user.id, kind, note })
    .select(PRACTICE_COLUMNS)
    .single();
  if (error || !data) return error?.code === "42501" ? Response.json({ error: "not_found" }, { status: 404 }) : failed();
  // Kept verbatim for the farmer's own log; the memory prompt drops any line with a dose.
  return Response.json({ practice: practiceFromRow(data), dosageNoted: containsDosage(note) }, { status: 201 });
}
