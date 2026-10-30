import type { SupabaseClient } from "@supabase/supabase-js";
import { MEMORY_CHECKS, MEMORY_PRACTICES, type MemoryCheck } from "@/lib/memory";
import { sessionUser } from "@/lib/server/supabase";
import { PRACTICE_KINDS, type AnalyzeResult, type PlantCheck, type PlantRecord, type PracticeKind, type PracticeLog } from "@/lib/types";

export const PHOTO_BUCKET = "plant-photos";
const SIGNED_URL_SECONDS = 60 * 60;

export type PlantMemory = {
  plant: PlantRecord;
  checks: MemoryCheck[];
  practices: PracticeLog[];
};

/** Analyze talks to saved plants through this, so tests can run without Supabase. */
export type PlantMemoryStore = {
  load(plantId: string): Promise<PlantMemory | null>;
  save(plantId: string, result: AnalyzeResult, photo: { bytes: Uint8Array; mime: string }): Promise<void>;
};

type PlantRow = {
  id: string;
  name: string;
  crop: string | null;
  bed_label: string | null;
  planted_on: string | null;
  location: string | null;
  created_at: string;
};

type CheckRow = {
  id: string;
  plant_id: string;
  created_at: string;
  photo_path: string | null;
  result_json: AnalyzeResult;
  growth_stage: string | null;
  flowering: boolean | null;
  summary: string | null;
};

type PracticeRow = { id: string; plant_id: string; logged_at: string; kind: string; note: string };

export const PLANT_COLUMNS = "id,name,crop,bed_label,planted_on,location,created_at";
export const CHECK_COLUMNS = "id,plant_id,created_at,photo_path,result_json,growth_stage,flowering,summary";
export const PRACTICE_COLUMNS = "id,plant_id,logged_at,kind,note";

export function plantFromRow(row: PlantRow): PlantRecord {
  return {
    id: row.id,
    name: row.name,
    crop: row.crop,
    bedLabel: row.bed_label,
    plantedOn: row.planted_on,
    location: row.location,
    createdAt: row.created_at,
  };
}

export function practiceFromRow(row: PracticeRow): PracticeLog {
  const kind = (PRACTICE_KINDS as readonly string[]).includes(row.kind) ? (row.kind as PracticeKind) : "other";
  return { id: row.id, plantId: row.plant_id, loggedAt: row.logged_at, kind, note: row.note };
}

export async function checksWithPhotos(client: SupabaseClient, rows: readonly CheckRow[]): Promise<PlantCheck[]> {
  const paths = rows.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const item of data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  return rows.map((row) => ({
    id: row.id,
    plantId: row.plant_id,
    createdAt: row.created_at,
    photoUrl: row.photo_path ? (signed.get(row.photo_path) ?? null) : null,
    summary: row.summary,
    growthStage: row.growth_stage,
    flowering: row.flowering,
    result: row.result_json,
  }));
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export const supabasePlantStore: PlantMemoryStore = {
  async load(plantId) {
    const session = await sessionUser();
    if (!session) return null;
    const { client } = session;
    const { data: plant } = await client.from("plants").select(PLANT_COLUMNS).eq("id", plantId).maybeSingle<PlantRow>();
    if (!plant) return null;
    const [checks, practices] = await Promise.all([
      client
        .from("checks")
        .select("created_at,result_json")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false })
        .limit(MEMORY_CHECKS + 2)
        .returns<{ created_at: string; result_json: AnalyzeResult }[]>(),
      client
        .from("practice_logs")
        .select(PRACTICE_COLUMNS)
        .eq("plant_id", plantId)
        .order("logged_at", { ascending: false })
        .limit(MEMORY_PRACTICES * 2)
        .returns<PracticeRow[]>(),
    ]);
    return {
      plant: plantFromRow(plant),
      checks: (checks.data ?? []).map((row) => ({ createdAt: row.created_at, result: row.result_json })),
      practices: (practices.data ?? []).map(practiceFromRow),
    };
  },

  async save(plantId, result, photo) {
    const session = await sessionUser();
    if (!session) return;
    const { client, user } = session;
    const extension = photo.mime === "image/png" ? "png" : photo.mime === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${plantId}/${result.id}.${extension}`;
    const upload = await client.storage.from(PHOTO_BUCKET).upload(path, photo.bytes, { contentType: photo.mime, upsert: false });
    const { error } = await client.from("checks").insert({
      id: result.id,
      plant_id: plantId,
      user_id: user.id,
      created_at: result.createdAt,
      photo_path: upload.error ? null : path,
      result_json: result,
      flowering: result.progress?.flowering ?? null,
      summary: result.progress?.sinceLastCheck ?? result.observations[0] ?? null,
    });
    if (error) console.error(`plant check save ${error.code ?? "error"}`);
  },
};
