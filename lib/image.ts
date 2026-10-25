export type ImageSize = { width: number; height: number };

export type DecodedImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
  size: ImageSize | null;
};

const MAX_BYTES = 7_500_000;

export function decodeDataUrl(input: string): DecodedImage {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(input.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error("unsupported_image");
  }
  const mime = match[1].toLowerCase() as DecodedImage["mime"];
  const bytes = Uint8Array.from(Buffer.from(match[2].replace(/\s/g, ""), "base64"));
  if (bytes.length < 16) {
    throw new Error("unsupported_image");
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error("image_too_large");
  }
  return { mime, bytes, size: imageSize(bytes, mime) };
}

export function imageSize(bytes: Uint8Array, mime: DecodedImage["mime"]): ImageSize | null {
  if (mime === "image/png") return pngSize(bytes);
  if (mime === "image/jpeg") return jpegSize(bytes);
  return webpSize(bytes);
}

export function pngSize(bytes: Uint8Array): ImageSize | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !sig.every((value, index) => bytes[index] === value)) return null;
  const width = readU32BE(bytes, 16);
  const height = readU32BE(bytes, 20);
  if (!width || !height) return null;
  return { width, height };
}

export function jpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0);
      const width = ((bytes[offset + 7] ?? 0) << 8) + (bytes[offset + 8] ?? 0);
      if (width > 0 && height > 0) return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

export function webpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null;
  const riff = ascii(bytes, 0, 4);
  const webp = ascii(bytes, 8, 12);
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16);
    const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16);
    if (width > 0 && height > 0) return { width, height };
  }
  if (chunk === "VP8 " && bytes.length > 30) {
    const width = ((bytes[26] ?? 0) | ((bytes[27] ?? 0) << 8)) & 0x3fff;
    const height = ((bytes[28] ?? 0) | ((bytes[29] ?? 0) << 8)) & 0x3fff;
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

export function clampDeclaredSize(width: unknown, height: unknown): ImageSize | null {
  const w = typeof width === "number" ? width : Number.NaN;
  const h = typeof height === "number" ? height : Number.NaN;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  const roundedW = Math.round(w);
  const roundedH = Math.round(h);
  if (roundedW < 1 || roundedH < 1 || roundedW > 8000 || roundedH > 8000) return null;
  return { width: roundedW, height: roundedH };
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
