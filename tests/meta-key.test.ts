import { afterEach, describe, expect, it, vi } from "vitest";
import { isMockMode, readApiKey } from "@/lib/server/meta";

const COMPLETE = "a".repeat(40);

function stubChunks(parts: readonly string[]) {
  for (let index = 0; index < 6; index += 1) {
    vi.stubEnv(`MODEL_API_KEY_${index}`, parts[index] ?? "");
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readApiKey", () => {
  it("returns a trimmed MODEL_API_KEY of at least 40 characters", () => {
    vi.stubEnv("MODEL_API_KEY", `  ${COMPLETE}  `);
    stubChunks(["bbbbbbbb", "cccccccc", "dddddddd", "eeeeeeee", "ffffffff", "gggggggg"]);
    expect(readApiKey()).toBe(COMPLETE);
  });

  it("joins trimmed chunks in order when MODEL_API_KEY is missing or short", () => {
    vi.stubEnv("MODEL_API_KEY", "a".repeat(39));
    stubChunks([" aaaaaaaa ", "bbbbbbbb", "", "dddddddd", "eeeeeeee", "  ffffffff"]);
    expect(readApiKey()).toBe("aaaaaaaabbbbbbbbddddddddeeeeeeeeffffffff");

    vi.stubEnv("MODEL_API_KEY", "");
    stubChunks(["11111111", "22222222", "33333333", "44444444", "55555555", "66666666"]);
    expect(readApiKey()).toBe("111111112222222233333333444444445555555566666666");
  });

  it("returns null when the key and every chunk are empty", () => {
    vi.stubEnv("MODEL_API_KEY", "   ");
    stubChunks([" ", "\t", "", "", "", ""]);
    expect(readApiKey()).toBeNull();
  });
});

describe("isMockMode", () => {
  it("stays in demo mode when no key or chunks are set", () => {
    vi.stubEnv("MOCK_META", "");
    vi.stubEnv("MODEL_API_KEY", "");
    stubChunks([]);
    expect(isMockMode()).toBe(true);
  });

  it("leaves demo mode when only chunks are set", () => {
    vi.stubEnv("MOCK_META", "");
    vi.stubEnv("MODEL_API_KEY", "truncated");
    stubChunks(["aaaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd", "eeeeeeee", "ffffffff"]);
    expect(isMockMode()).toBe(false);
  });

  it("honors an explicit MOCK_META flag", () => {
    vi.stubEnv("MODEL_API_KEY", COMPLETE);
    stubChunks([]);
    vi.stubEnv("MOCK_META", "1");
    expect(isMockMode()).toBe(true);
    vi.stubEnv("MOCK_META", "0");
    expect(isMockMode()).toBe(false);
  });
});
