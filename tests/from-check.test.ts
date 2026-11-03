import { afterEach, describe, expect, it, vi } from "vitest";

const { insert, save, getUser } = vi.hoisted(() => ({
  insert: vi.fn(),
  save: vi.fn(async () => {}),
  getUser: vi.fn(),
}));

vi.mock("@/lib/server/supabase", () => {
  const client = { auth: { getUser }, from: () => ({ insert }) };
  return {
    supabaseConfigured: () => true,
    serverSupabase: async () => client,
    sessionUser: async () => {
      const { data } = await getUser();
      return data.user ? { client, user: data.user } : null;
    },
  };
});

vi.mock("@/lib/server/plant-store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/plant-store")>();
  return { ...original, supabasePlantStore: { load: async () => null, save } };
});

import { POST } from "@/app/api/plants/from-check/route";
import { pngDataUrl } from "@/tests/sam-fixture";

const RESULT = {
  id: "22222222-3333-4444-8555-666666666666",
  createdAt: "2026-11-03T10:00:00.000Z",
  detectedPlant: "Tomato",
  farmerPlant: "",
  actions: ["a", "b", "c"],
  observations: ["Spots on the leaves"],
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/plants/from-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockInsertSuccess() {
  insert.mockImplementation(() => ({
    select: () => ({
      single: async () => ({
        data: {
          id: "11111111-2222-4333-8444-555555555555",
          name: "Tomato",
          crop: null,
          bed_label: null,
          planted_on: null,
          location: null,
          created_at: "2026-11-03T10:00:01.000Z",
        },
        error: null,
      }),
    }),
  }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("save to plant profile", () => {
  it("creates a plant from the detected name and files the check", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.c", phone: "" } } });
    mockInsertSuccess();
    const response = await POST(post({ result: RESULT, thumbnail: pngDataUrl() }));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { plant: { id: string; name: string; checkCount: number } };
    expect(body.plant.name).toBe("Tomato");
    expect(body.plant.checkCount).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
    const [plantId, filed] = save.mock.calls[0] as unknown as [string, { plantId?: string }];
    expect(plantId).toBe(body.plant.id);
    expect(filed.plantId).toBe(body.plant.id);
  });

  it("rejects signed-out farmers", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(post({ result: RESULT, thumbnail: pngDataUrl() }));
    expect(response.status).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects a body without a usable check or photo", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.c", phone: "" } } });
    expect((await POST(post({ result: { id: "x" }, thumbnail: pngDataUrl() }))).status).toBe(400);
    expect((await POST(post({ result: RESULT, thumbnail: "not-a-photo" }))).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
});
