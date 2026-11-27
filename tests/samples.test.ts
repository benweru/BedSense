import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_PHOTOS } from "@/lib/samples";
import { scenarioForPlant } from "@/lib/server/mock";

describe("built-in sample farm photos", () => {
  it("ships existing, lightweight JPEGs with English and Kiswahili copy", () => {
    expect(SAMPLE_PHOTOS.length).toBeGreaterThanOrEqual(3);
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

      // Demo mode matches the chili bed photo to the chili scenario (2)
      expect(scenarioForPlant(sample.plantName, bytes)).toBe(2);
    }
  });
});
