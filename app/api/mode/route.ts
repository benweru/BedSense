import { isMockMode } from "@/lib/server/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { mode: isMockMode() ? "mock" : "live" },
    { headers: { "cache-control": "no-store" } },
  );
}
