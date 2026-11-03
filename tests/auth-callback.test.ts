import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchange = vi.fn();
vi.mock("@/lib/server/supabase", () => ({
  supabaseConfigured: () => true,
  serverSupabase: async () => ({ auth: { exchangeCodeForSession: exchange } }),
}));

import { GET, safeNext } from "@/app/api/auth/callback/route";

afterEach(() => {
  vi.clearAllMocks();
});

function request(url: string): NextRequest {
  return new NextRequest(url);
}

describe("email sign-in callback", () => {
  it("exchanges the code and redirects to the profile", async () => {
    exchange.mockResolvedValue({ error: null });
    const response = await GET(request("https://bedsense.vercel.app/api/auth/callback?code=abc123&next=/profile"));
    expect(exchange).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://bedsense.vercel.app/profile");
  });

  it("sends a failed or expired link back with an error flag", async () => {
    exchange.mockResolvedValue({ error: { message: "expired" } });
    const response = await GET(request("https://bedsense.vercel.app/api/auth/callback?code=old"));
    expect(response.headers.get("location")).toBe("https://bedsense.vercel.app/profile?auth_error=1");
  });

  it("does not call Supabase when the code is missing", async () => {
    const response = await GET(request("https://bedsense.vercel.app/api/auth/callback"));
    expect(exchange).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://bedsense.vercel.app/profile?auth_error=1");
  });

  it("only allows same-site redirect targets", () => {
    expect(safeNext("/plants")).toBe("/plants");
    expect(safeNext("https://evil.example/phish")).toBe("/profile");
    expect(safeNext("//evil.example/phish")).toBe("/profile");
    expect(safeNext(null)).toBe("/profile");
  });
});
