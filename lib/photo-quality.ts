import jpeg from "jpeg-js";

export type PhotoVerdict = "use" | "too_far" | "unclear";

export type FrameEvidence = {
  masks: readonly { confidence: number | null; areaFraction: number }[];
  /** Laplacian energy on a small gray preview. Null when the file could not be measured. */
  sharpness: number | null;
  /** Share of preview pixels that look like open sky. Null when the file could not be measured. */
  skyFraction: number | null;
};

const BLUR_LIMIT = 0.12;
const SKY_LIMIT = 0.08;

export function isSoftPhoto(sharpness: number | null): boolean {
  return sharpness !== null && sharpness < BLUR_LIMIT;
}

/** A mark large or confident enough to show the plant is near the camera. */
function hasStrongMark(masks: FrameEvidence["masks"]): boolean {
  return masks.some((mask) => (mask.confidence ?? 0) >= 0.35 || mask.areaFraction >= 0.012);
}

/**
 * Accuracy over coverage. A close photo SAM missed still goes through.
 * A sharp wide view with sky and no strong mark is too far.
 * A soft photo with no strong mark is not clear enough, even if a weak mark landed.
 */
export function judgeFrame(evidence: FrameEvidence): PhotoVerdict {
  const strong = hasStrongMark(evidence.masks);
  const blurry = isSoftPhoto(evidence.sharpness);
  const wideSky = evidence.skyFraction !== null && evidence.skyFraction >= SKY_LIMIT;
  if (blurry && !strong) return "unclear";
  if (wideSky && !strong) return "too_far";
  return "use";
}

export function measureJpeg(bytes: Uint8Array): { sharpness: number; skyFraction: number } | null {
  try {
    const decoded = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });
    if (!decoded.width || !decoded.height || decoded.data.length < decoded.width * decoded.height * 4) return null;
    return previewMetrics(decoded.data, decoded.width, decoded.height);
  } catch {
    return null;
  }
}

export function previewMetrics(rgba: Uint8Array, width: number, height: number): { sharpness: number; skyFraction: number } {
  const previewWidth = 64;
  const previewHeight = Math.max(1, Math.round((height * previewWidth) / width));
  const gray = new Float32Array(previewWidth * previewHeight);
  let sky = 0;
  for (let y = 0; y < previewHeight; y += 1) {
    for (let x = 0; x < previewWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / previewWidth));
      const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / previewHeight));
      const index = (sourceY * width + sourceX) * 4;
      const red = rgba[index] ?? 0;
      const green = rgba[index + 1] ?? 0;
      const blue = rgba[index + 2] ?? 0;
      gray[y * previewWidth + x] = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const luma = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
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
  return {
    sharpness: samples > 0 ? energy / samples : 0,
    skyFraction: sky / (previewWidth * previewHeight),
  };
}
