import { describe, expect, it } from "vitest";
import { decodeDataUrl, jpegSize, pngSize } from "@/lib/image";
import { TINY_PNG_BASE64, pngDataUrl } from "@/tests/sam-fixture";

describe("image bytes", () => {
  it("reads a png data url", () => {
    const decoded = decodeDataUrl(pngDataUrl());
    expect(decoded.mime).toBe("image/png");
    expect(decoded.size).toEqual({ width: 1, height: 1 });
    expect(pngSize(decoded.bytes)).toEqual({ width: 1, height: 1 });
    expect(TINY_PNG_BASE64.length).toBeGreaterThan(20);
  });

  it("rejects files that are not photos", () => {
    expect(() => decodeDataUrl("data:text/plain;base64,aGVsbG8=")).toThrow("unsupported_image");
  });

  it("reads a jpeg start-of-frame marker", () => {
    const bytes = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01,
      0x03, 0x11, 0x01, 0xff, 0xd9,
    ]);
    expect(jpegSize(bytes)).toEqual({ width: 32, height: 16 });
  });
});
