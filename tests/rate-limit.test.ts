import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import { checkRateLimit, clientKey, resetRateLimits } from "@/lib/server/rate-limit";
import { pngDataUrl } from "@/tests/sam-fixture";

afterEach(() => {
  resetRateLimits();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("rate limiter", () => {
  it("allows requests within the window and blocks excess with retryAfterSeconds", () => {
    const t0 = 1_000_000;
    expect(checkRateLimit("analyze:1.2.3.4", { limit: 2, windowMs: 10_000, now: t0 }).allowed).toBe(true);
    expect(checkRateLimit("analyze:1.2.3.4", { limit: 2, windowMs: 10_000, now: t0 + 1000 }).allowed).toBe(true);
    const blocked = checkRateLimit("analyze:1.2.3.4", { limit: 2, windowMs: 10_000, now: t0 + 2000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(8);

    // Different client IP is unaffected
    expect(checkRateLimit("analyze:5.6.7.8", { limit: 2, windowMs: 10_000, now: t0 + 2000 }).allowed).toBe(true);

    // After the sliding window passes, requests are allowed again
    expect(checkRateLimit("analyze:1.2.3.4", { limit: 2, windowMs: 10_000, now: t0 + 10_001 }).allowed).toBe(true);
  });

  it("extracts the first IP from x-forwarded-for", () => {
    const req = new Request("http://localhost/api/analyze", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientKey(req, "analyze")).toBe("analyze:203.0.113.9");
  });

  it("returns 429 on /api/analyze in live mode once the per-IP limit is exceeded", async () => {
    vi.stubEnv("MOCK_META", "0");
    vi.stubEnv("MODEL_API_KEY", "");
    for (let i = 0; i < 6; i += 1) vi.stubEnv(`MODEL_API_KEY_${i}`, "");

    const makeRequest = () =>
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
        body: JSON.stringify({ image: pngDataUrl(), locale: "en" }),
      });

    for (let i = 0; i < 20; i += 1) {
      const res = await analyzePOST(makeRequest());
      expect(res.status).toBe(503);
    }
    const limited = await analyzePOST(makeRequest());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    const body = (await limited.json()) as { error: string; message: string };
    expect(body.error).toBe("rate_limited");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("never rate-limits /api/analyze in demo mode", async () => {
    vi.stubEnv("MOCK_META", "1");
    for (let i = 0; i < 25; i += 1) {
      const req = new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.9" },
        body: JSON.stringify({ image: pngDataUrl(), locale: "en" }),
      });
      const res = await analyzePOST(req);
      expect(res.status).toBe(200);
    }
  });
});
