import { describe, expect, it } from "vitest";
import { masksFromOutputText, samOutputText, sourceSizeFromRaw } from "@/lib/server/sam";
import { BUTTON_OUTPUT } from "@/tests/sam-fixture";

describe("SAM 3.1 output", () => {
  it("decodes the documented button fixture into two masks", async () => {
    const parsed = await masksFromOutputText("onion", BUTTON_OUTPUT, 320 * 334);
    expect(sourceSizeFromRaw(BUTTON_OUTPUT)).toEqual({ width: 320, height: 334 });
    expect(parsed.masks).toHaveLength(2);
    expect(parsed.masks[0]?.box.width).toBe(60);
    expect(parsed.masks[0]?.box.height).toBe(27);
    expect(parsed.masks[0]?.grid.rows.length).toBeGreaterThan(0);
    expect(parsed.masks[0]?.areaFraction).toBeGreaterThan(0);
    expect(parsed.masks.every((mask) => mask.conceptId === "onion")).toBe(true);
  });

  it("treats an empty lane as zero matches", async () => {
    const parsed = await masksFromOutputText("chili", "", 100);
    expect(parsed.masks).toEqual([]);
  });

  it("reads output text from a responses json body and from sse deltas", () => {
    expect(samOutputText({ kind: "json", value: { output_text: "<0f>" } })).toBe("<0f>");
    expect(
      samOutputText({
        kind: "sse",
        events: [
          { type: "response.output_text.delta", delta: "<0f>" },
          { type: "response.output_text.delta", delta: "rest" },
          { type: "response.completed" },
        ],
      }),
    ).toBe("<0f>rest");
  });
});
