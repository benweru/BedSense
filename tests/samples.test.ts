import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as modeGET } from "@/app/api/mode/route";
import { SAMPLE_PHOTOS } from "@/lib/samples";
import { scenarioForPlant } from "@/lib/server/mock";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("built-in sample farm photos", () => {
  it("ships three distinct crop JPEGs (chili, tomato, potato) with English and Kiswahili copy", () => {
    expect(SAMPLE_PHOTOS).toHaveLength(3);
    const scenarios = new Set<number>();
    for (const sample of SAMPLE_PHOTOS) {
      expect(sample.src.startsWith("/samples/")).toBe(true);
      const diskPath = path.join("public", sample.src.replace(/^\/+/, ""));
      const stat = statSync(diskPath);
      expect(stat.size, sample.id).toBeGreaterThan(5_000);
      expect(stat.size, sample.id).toBeLessThan(300_000);

      const bytes = readFileSync(diskPath);
      // JPEG magic bytes FF D8
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);

      expect(sample.copy.en.label.trim().length).toBeGreaterThan(0);
      expect(sample.copy.en.detail.trim().length).toBeGreaterThan(0);
      expect(sample.copy.en.alt.trim().length).toBeGreaterThan(0);
      expect(sample.copy.sw.label.trim().length).toBeGreaterThan(0);
      expect(sample.copy.sw.detail.trim().length).toBeGreaterThan(0);
      expect(sample.copy.sw.alt.trim().length).toBeGreaterThan(0);

      scenarios.add(scenarioForPlant(sample.plantName, bytes));
    }
    // Each sample covers a different built-in demo crop scenario (chili=2, tomato=3, potato=4)
    expect([...scenarios].sort()).toEqual([2, 3, 4]);
  });
});

describe("/api/mode", () => {
  it("reports mock in zero-env or MOCK_META=1 and live in MOCK_META=0", async () => {
    vi.stubEnv("MOCK_META", "1");
    expect((await modeGET().json()) as { mode: string }).toEqual({ mode: "mock" });

    vi.stubEnv("MOCK_META", "0");
    expect((await modeGET().json()) as { mode: string }).toEqual({ mode: "live" });
  });
});
