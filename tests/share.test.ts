import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeBedPhoto } from "@/lib/server/analyze";
import { buildShareIntent, SHARE_SITE_URL, selectShareSummary } from "@/lib/share";
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
    const thin = { ...result, farmerPlant: "", likelyCauses: [], observations: [], actions: [] as unknown as [string, string, string] };
    const summary = selectShareSummary(thin);
    expect(summary.plant).toBe(result.detectedPlant);
    expect(summary.finding).toBe("");
    expect(summary.action).toBe("");
  });

  it("points at the public site, overridable per deploy", () => {
    expect(SHARE_SITE_URL).toBe("https://bedsense.vercel.app");
  });

  it("builds an encoded X intent that round-trips", () => {
    const summary = { plant: "Tomato & friends", finding: "Madoa ya njano? Yes & no", action: "Ondoa majani 100%" };
    for (const locale of ["en", "sw"] as const) {
      const href = buildShareIntent(locale, summary);
      expect(href.startsWith("https://x.com/intent/post?")).toBe(true);
      const params = new URL(href).searchParams;
      expect(params.get("url")).toBe("https://bedsense.vercel.app");
      const text = params.get("text") ?? "";
      expect(text).toContain("Tomato & friends");
      expect(text.length).toBeLessThanOrEqual(240);
    }
    const sw = new URL(buildShareIntent("sw", summary)).searchParams.get("text") ?? "";
    expect(sw.startsWith("Ukaguzi wa")).toBe(true);
  });

  it("truncates long summaries to one post", () => {
    const summary = { plant: "Kale", finding: "spot ".repeat(100), action: "water ".repeat(100) };
    const text = new URL(buildShareIntent("en", summary)).searchParams.get("text") ?? "";
    expect(text.length).toBeLessThanOrEqual(240);
    expect(text.endsWith("…")).toBe(true);
    expect(text).toContain("Kale");
  });
});
