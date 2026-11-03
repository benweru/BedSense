import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeBedPhoto } from "@/lib/server/analyze";
import { SHARE_SITE_URL, selectShareSummary } from "@/lib/share";
import { pngDataUrl } from "@/tests/sam-fixture";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("share summary", () => {
  it("picks the plant, top finding, and first step from any result", async () => {
    vi.stubEnv("MOCK_META", "1");
    const result = await analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: "chili" });
    const summary = selectShareSummary(result);
    expect(summary.plant).toBe(result.farmerPlant);
    expect(summary.finding).toBe(result.likelyCauses[0] ?? result.observations[0] ?? "");
    expect(summary.action).toBe(result.actions[0] ?? "");
    expect(summary.finding.length).toBeGreaterThan(0);
    expect(summary.action.length).toBeGreaterThan(0);
  });

  it("falls back to the detected plant and empty lines on thin results", async () => {
    vi.stubEnv("MOCK_META", "1");
    const result = await analyzeBedPhoto({ image: pngDataUrl(), locale: "en", plantName: "chili" });
    const thin = { ...result, farmerPlant: "", likelyCauses: [], observations: [], actions: [] as string[] };
    const summary = selectShareSummary(thin);
    expect(summary.plant).toBe(result.detectedPlant);
    expect(summary.finding).toBe("");
    expect(summary.action).toBe("");
  });

  it("points at the public site, overridable per deploy", () => {
    expect(SHARE_SITE_URL).toBe("https://bedsense.vercel.app");
  });
});
