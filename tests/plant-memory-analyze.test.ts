import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeBedPhoto } from "@/lib/server/analyze";
import type { PlantMemory, PlantMemoryStore } from "@/lib/server/plant-store";
import type { AnalyzeResult } from "@/lib/types";
import { pngDataUrl } from "@/tests/sam-fixture";

const PLANT_ID = "11111111-2222-4333-8444-555555555555";

function fakeStore(memory: PlantMemory | null) {
  const saved: AnalyzeResult[] = [];
  const store: PlantMemoryStore = {
    load: vi.fn(async () => memory),
    save: vi.fn(async (_plantId, result) => {
      saved.push(result);
    }),
  };
  return { store, saved };
}

const plant = {
  id: PLANT_ID,
  name: "Chili",
  crop: "chili",
  bedLabel: null,
  plantedOn: null,
  location: null,
  createdAt: "2026-10-01T00:00:00Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analyze with a saved plant", () => {
  it("files the check and reports progress when the plant has history", async () => {
    vi.stubEnv("MOCK_META", "1");
    const { store, saved } = fakeStore({
      plant,
      checks: [
        {
          createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          result: { observations: ["curled leaves"], likelyCauses: [], actions: ["a", "b", "c"], qualityHold: null },
        },
      ],
      practices: [],
    });
    const result = await analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: "chili", plantId: PLANT_ID }, store);
    expect(result.plantId).toBe(PLANT_ID);
    expect(result.progress?.growthTrend).toBe("stable");
    expect(saved).toHaveLength(1);
  });

  it("files a first check without progress", async () => {
    vi.stubEnv("MOCK_META", "1");
    const { store, saved } = fakeStore({ plant, checks: [], practices: [] });
    const result = await analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: "chili", plantId: PLANT_ID }, store);
    expect(result.progress ?? null).toBeNull();
    expect(saved).toHaveLength(1);
  });

  it("ignores a plant the session cannot load and bad ids", async () => {
    vi.stubEnv("MOCK_META", "1");
    const { store, saved } = fakeStore(null);
    const signedOut = await analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: "chili", plantId: PLANT_ID }, store);
    expect(signedOut.plantId ?? null).toBeNull();
    await analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: "chili", plantId: "../etc" }, store);
    expect(store.load).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(0);
  });
});
