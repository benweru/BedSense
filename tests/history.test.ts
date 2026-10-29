import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, forgetCheck, parseHistory, rememberCheck, serializeHistory } from "@/lib/history";
import type { AnalyzeResult, HistoryEntry } from "@/lib/types";

function entry(id: string): HistoryEntry {
  const result = {
    id,
    actions: ["one", "two", "three"],
  } as AnalyzeResult;
  return {
    id,
    createdAt: "2026-10-25T12:00:00.000Z",
    thumbnail: "data:image/jpeg;base64,aaaa",
    result,
  };
}

describe("recent checks", () => {
  it("keeps the newest five", () => {
    let history: HistoryEntry[] = [];
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      history = rememberCheck(history, entry(id));
    }
    expect(history.map((item) => item.id)).toEqual(["f", "e", "d", "c", "b"]);
    expect(history).toHaveLength(HISTORY_LIMIT);
  });

  it("moves a repeated id to the front", () => {
    const history = rememberCheck([entry("a"), entry("b")], entry("a"));
    expect(history.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("removes one check and leaves the rest", () => {
    const history = rememberCheck([entry("a")], entry("b"));
    expect(forgetCheck(history, "a").map((item) => item.id)).toEqual(["b"]);
    expect(forgetCheck(history, "missing")).toHaveLength(2);
  });

  it("drops corrupt storage", () => {
    expect(parseHistory("not-json")).toEqual([]);
    expect(parseHistory(JSON.stringify([{ id: 1 }]))).toEqual([]);
    const raw = serializeHistory([entry("a")]);
    expect(parseHistory(raw)).toHaveLength(1);
  });
});
