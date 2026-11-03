import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import { POST as askPOST } from "@/app/api/ask/route";
import { GET as diagGET } from "@/app/api/diag/route";
import { POST as illustratePOST } from "@/app/api/illustrate/route";
import { GET as plantsGET } from "@/app/api/plants/route";
import { serverSupabase, sessionUser, supabaseConfigured } from "@/lib/server/supabase";
import { browserSupabase } from "@/lib/supabase-browser";
import { pngDataUrl } from "@/tests/sam-fixture";

/**
 * Zero-env path: no Meta key, no Supabase project. Every route must answer
 * with a useful state and never throw. Judges run the app exactly like this.
 */
function clearEnv() {
  vi.stubEnv("MODEL_API_KEY", "");
  for (let index = 0; index < 6; index += 1) vi.stubEnv(`MODEL_API_KEY_${index}`, "");
  vi.stubEnv("MOCK_META", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
}

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const grounding = {
  plant: "Tomato",
  observations: ["Raised blisters cover the underside of several tomato leaves."],
  likelyCauses: ["Blister mites or a water mark can raise blisters like these."],
  mitigations: ["Take the worst blistered leaves off the bed."],
  actions: ["Photograph the underside of one blistered leaf.", "Compare old and new growth.", "Show both photos to an agrovet."],
  suspect: null,
  actives: [],
  needsInfo: true,
  followUp: "Add a close photo of the underside of one affected leaf.",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("zero-env API routes", () => {
  it("answers /api/ask from the demo reading with empty env", async () => {
    clearEnv();
    const fetchMock = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await askPOST(post("http://localhost/api/ask", { locale: "en", question: "Is it spreading?", grounding, thread: [] }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { answer: string; demo: boolean };
    expect(body.demo).toBe(true);
    expect(body.answer.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers /api/ask with missing_key when live mode has no key", async () => {
    clearEnv();
    vi.stubEnv("MOCK_META", "0");
    const response = await askPOST(post("http://localhost/api/ask", { locale: "en", question: "Is it spreading?", grounding, thread: [] }));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("missing_key");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("answers /api/diag with a missing_key shape and never the key", async () => {
    clearEnv();
    const response = await diagGET();
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("missing_key");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("answers /api/illustrate with mock art and empty env", async () => {
    clearEnv();
    const fetchMock = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await illustratePOST(
      post("http://localhost/api/illustrate", {
        plant: "Tomato",
        suspect: "early blight",
        symptom: "dark ringed spots on the lower leaves",
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { demo: boolean; mime: string; image: string };
    expect(body.demo).toBe(true);
    expect(body.mime).toBe("image/svg+xml");
    expect(body.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers /api/diag with JSON when the catalog read fails", async () => {
    clearEnv();
    vi.stubEnv("MODEL_API_KEY", "k".repeat(48));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    const response = await diagGET();
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean; key: { length: number; prefix: string; suffix: string } };
    expect(body.ok).toBe(false);
    expect(body.key.length).toBe(48);
    expect(JSON.stringify(body).length).toBeLessThan(200);
  });

  it("runs /api/analyze in demo mode with fully empty env", async () => {
    clearEnv();
    const fetchMock = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await analyzePOST(post("http://localhost/api/analyze", { image: pngDataUrl(), locale: "en" }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode: string; actions: string[] };
    expect(body.mode).toBe("mock");
    expect(body.actions).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers /api/plants with not_configured and never throws", async () => {
    clearEnv();
    const response = await plantsGET();
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("not_configured");
  });
});

describe("zero-env Supabase helpers", () => {
  it("reports unconfigured clients as null", async () => {
    clearEnv();
    expect(supabaseConfigured()).toBe(false);
    expect(browserSupabase()).toBeNull();
    expect(await serverSupabase()).toBeNull();
    expect(await sessionUser()).toBeNull();
  });
});

describe("zero-env pages", () => {
  it("imports /, /plants and /profile modules without touching env-gated clients", async () => {
    clearEnv();
    const home = await import("@/app/page");
    const plants = await import("@/app/plants/page");
    const profile = await import("@/app/profile/page");
    expect(typeof home.default).toBe("function");
    expect(typeof plants.default).toBe("function");
    expect(typeof profile.default).toBe("function");
  });
});
