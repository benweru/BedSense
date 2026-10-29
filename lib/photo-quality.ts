import jpeg from "jpeg-js";

export type PhotoVerdict = "use" | "too_far" | "unclear" | "harsh_light";

export type FrameEvidence = {
  masks: readonly { confidence: number | null; areaFraction: number }[];
  /** Laplacian energy on a small gray preview. Null when the file could not be measured. */
  sharpness: number | null;
  /** Share of preview pixels that look like open sky. Null when the file could not be measured. */
  skyFraction: number | null;
  /** p95 luminance minus p5. Null when the file could not be measured. */
  contrastRange?: number | null;
  /** Share of preview pixels that are nearly black. */
  shadowFraction?: number | null;
  /** Share of preview pixels that are blown out. */
  highlightFraction?: number | null;
};

const BLUR_LIMIT = 0.2;
const UNSURE_CONFIDENCE = 0.5;

/** SAM marked nothing and Muse is unsure: the photo is not readable enough to show a diagnosis. */
export function isUnsureRead(markCount: number, confidenceScore: number | null | undefined): boolean {
  return markCount === 0 && typeof confidenceScore === "number" && confidenceScore < UNSURE_CONFIDENCE;
}
const SKY_LIMIT = 0.08;
const CRUSHED_CONTRAST = 0.22;
const DEEP_SHADOW = 0.28;
const BLOWN_HIGHLIGHT = 0.28;
const MARGINAL_CONTRAST = 0.38;
const MARGINAL_SHADOW = 0.16;

export function isSoftPhoto(sharpness: number | null): boolean {
  return sharpness !== null && sharpness < BLUR_LIMIT;
}

/** A mark large or confident enough to show the plant is near the camera. */
function hasStrongMark(masks: FrameEvidence["masks"]): boolean {
  return masks.some((mask) => (mask.confidence ?? 0) >= 0.35 || mask.areaFraction >= 0.012);
}

/** Crushed contrast, a large black region, or blown highlights. A normal hard-sun bed photo is not this. */
export function isExtremeLight(evidence: FrameEvidence): boolean {
  const range = evidence.contrastRange;
  const shadow = evidence.shadowFraction;
  const highlight = evidence.highlightFraction;
  if (range == null || shadow == null || highlight == null) return false;
  const crushed = range < CRUSHED_CONTRAST;
  const blocked = shadow > DEEP_SHADOW || highlight > BLOWN_HIGHLIGHT;
  const split = shadow > 0.15 && highlight > 0.12;
  return crushed || blocked || split;
}

/** Weak marks plus lighting that is poor, but not yet the extreme bar. */
function isMarginalLight(evidence: FrameEvidence): boolean {
  const range = evidence.contrastRange;
  if (range == null) return false;
  return range < MARGINAL_CONTRAST || (evidence.shadowFraction ?? 0) > MARGINAL_SHADOW || (evidence.highlightFraction ?? 0) > MARGINAL_SHADOW;
}

/**
 * Accuracy over coverage. A close photo SAM missed still goes through.
 * A sharp wide view with sky and no strong mark is too far.
 * A soft photo with no strong mark is not clear enough, even if a weak mark landed.
 * Extreme shadow, blown highlights, or crushed contrast hold the frame unless a strong mark locked the plant.
 */
export function judgeFrame(evidence: FrameEvidence): PhotoVerdict {
  const strong = hasStrongMark(evidence.masks);
  const blurry = isSoftPhoto(evidence.sharpness);
  const wideSky = evidence.skyFraction !== null && evidence.skyFraction >= SKY_LIMIT;
  if (blurry && !strong) return "unclear";
  if (wideSky && !strong) return "too_far";
  const weakMarks = evidence.masks.length > 0 && !strong;
  if (!strong && (isExtremeLight(evidence) || (weakMarks && isMarginalLight(evidence)))) return "harsh_light";
  return "use";
}

export type Clarity = {
  sharpness: number;
  skyFraction: number;
  contrastRange: number;
  shadowFraction: number;
  highlightFraction: number;
};

export function measureJpeg(bytes: Uint8Array): Clarity | null {
  try {
    const decoded = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });
    if (!decoded.width || !decoded.height || decoded.data.length < decoded.width * decoded.height * 4) return null;
    return previewMetrics(decoded.data, decoded.width, decoded.height);
  } catch {
    return null;
  }
}

export function previewMetrics(rgba: Uint8Array, width: number, height: number): Clarity {
  const previewWidth = 64;
  const previewHeight = Math.max(1, Math.round((height * previewWidth) / width));
  const gray = new Float32Array(previewWidth * previewHeight);
  let sky = 0;
  let shadow = 0;
  let highlight = 0;
  for (let y = 0; y < previewHeight; y += 1) {
    for (let x = 0; x < previewWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / previewWidth));
      const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / previewHeight));
      const index = (sourceY * width + sourceX) * 4;
      const red = rgba[index] ?? 0;
      const green = rgba[index + 1] ?? 0;
      const blue = rgba[index + 2] ?? 0;
      const luma = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
      gray[y * previewWidth + x] = luma;
      if (luma < 0.08) shadow += 1;
      if (luma > 0.92) highlight += 1;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max === 0 ? 0 : (max - min) / max;
      if (blue > red + 15 && blue > green && luma > 0.45 && saturation > 0.15 && saturation < 0.7) sky += 1;
    }
  }
  let energy = 0;
  let samples = 0;
  for (let y = 1; y < previewHeight - 1; y += 1) {
    for (let x = 1; x < previewWidth - 1; x += 1) {
      const center = gray[y * previewWidth + x] ?? 0;
      const lap = Math.abs(
        4 * center -
          (gray[y * previewWidth + x - 1] ?? 0) -
          (gray[y * previewWidth + x + 1] ?? 0) -
          (gray[(y - 1) * previewWidth + x] ?? 0) -
          (gray[(y + 1) * previewWidth + x] ?? 0),
      );
      energy += lap;
      samples += 1;
    }
  }
  const sorted = Array.from(gray).sort((left, right) => left - right);
  const pick = (quantile: number) => sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))] ?? 0;
  const pixels = previewWidth * previewHeight;
  return {
    sharpness: samples > 0 ? energy / samples : 0,
    skyFraction: sky / pixels,
    contrastRange: pick(0.95) - pick(0.05),
    shadowFraction: shadow / pixels,
    highlightFraction: highlight / pixels,
  };
}
