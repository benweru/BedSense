import jpeg from "jpeg-js";
import { emptyConceptCounts } from "@/lib/concepts";
import { emptyFarmerContext } from "@/lib/context";
import { judgeFrame, measureJpeg, type PhotoVerdict } from "@/lib/photo-quality";
import { adviseBed } from "@/lib/server/muse";
import { segmentBed } from "@/lib/server/sam";
import { AnalyzeError, type ConceptId } from "@/lib/types";

/** What a person can see in the clean photo. This is the answer key, not a model output. */
export type FeatureKey = {
  pods: boolean;
  ripe: boolean;
  flowers: boolean;
  yellowLeaf: boolean;
};

export type Feature = keyof FeatureKey;

export const FEATURES: readonly Feature[] = ["pods", "ripe", "flowers", "yellowLeaf"];

export type BlurLevel = { id: string; label: string; box: number; motion: number };

/** Radii are pixels on the 1280 px long side the app uploads. */
export const BLUR_LEVELS: readonly BlurLevel[] = [
  { id: "clean", label: "No blur", box: 0, motion: 0 },
  { id: "soft", label: "Slight focus miss (2 px)", box: 2, motion: 0 },
  { id: "blurry", label: "Out of focus (5 px)", box: 5, motion: 0 },
  { id: "very-blurry", label: "Badly out of focus (10 px)", box: 10, motion: 0 },
  { id: "shake", label: "Hand shake (16 px sideways)", box: 0, motion: 16 },
];

const UPLOAD_SIDE = 1280;

export function decodeJpeg(bytes: Uint8Array) {
  const decoded = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 });
  return { data: decoded.data, width: decoded.width, height: decoded.height };
}

/** Area-average downscale to the app's upload size, so blur radii match what the server receives. */
export function toUploadSize(image: { data: Uint8Array; width: number; height: number }) {
  const scale = Math.min(1, UPLOAD_SIDE / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y / scale);
    const y1 = Math.min(image.height, Math.max(y0 + 1, Math.floor((y + 1) / scale)));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x / scale);
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.floor((x + 1) / scale)));
      const sums = [0, 0, 0];
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const index = (sy * image.width + sx) * 4;
          sums[0] += image.data[index] ?? 0;
          sums[1] += image.data[index + 1] ?? 0;
          sums[2] += image.data[index + 2] ?? 0;
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const out = (y * width + x) * 4;
      data[out] = sums[0] / count;
      data[out + 1] = sums[1] / count;
      data[out + 2] = sums[2] / count;
      data[out + 3] = 255;
    }
  }
  return { data, width, height };
}

function boxPass(src: Uint8Array, width: number, height: number, radius: number, horizontal: boolean): Uint8Array {
  const out = new Uint8Array(src.length);
  const span = radius * 2 + 1;
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  for (let a = 0; a < outer; a += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const at = (b: number) => {
        const clamped = Math.min(inner - 1, Math.max(0, b));
        return ((horizontal ? a * width + clamped : clamped * width + a) * 4) + channel;
      };
      let sum = 0;
      for (let b = -radius; b <= radius; b += 1) sum += src[at(b)] ?? 0;
      for (let b = 0; b < inner; b += 1) {
        out[at(b)] = sum / span;
        sum += (src[at(b + radius + 1)] ?? 0) - (src[at(b - radius)] ?? 0);
      }
    }
  }
  for (let index = 3; index < out.length; index += 4) out[index] = 255;
  return out;
}

/** Three box passes approximate a Gaussian focus miss. Motion is one long horizontal box. */
export function blurImage(image: { data: Uint8Array; width: number; height: number }, level: BlurLevel) {
  let data = image.data;
  if (level.box > 0) {
    for (let pass = 0; pass < 3; pass += 1) {
      data = boxPass(data, image.width, image.height, level.box, true);
      data = boxPass(data, image.width, image.height, level.box, false);
    }
  }
  if (level.motion > 0) data = boxPass(data, image.width, image.height, Math.round(level.motion / 2), true);
  return { data, width: image.width, height: image.height };
}

export function encodeJpeg(image: { data: Uint8Array; width: number; height: number }): Uint8Array {
  return jpeg.encode({ data: image.data, width: image.width, height: image.height }, 85).data;
}

export type BlurGrade = {
  photo: string;
  level: string;
  sharpness: number | null;
  gate: PhotoVerdict;
  samConcepts: ConceptId[];
  samChili: boolean;
  museDiagnosis: boolean;
  museSaw: Feature[];
  symptom: string;
  confidence: number | null;
  failure: string | null;
};

const MENTIONS: Record<Feature, RegExp> = {
  pods: /\b(pods?|fruits?|fruiting)\b/i,
  ripe: /\b(red|ripe|ripening|ripened|turning)\b/i,
  flowers: /\b(flowers?|blooms?|blossoms?|flowering)\b/i,
  yellowLeaf: /\b(yellow\w*|chlorotic|chlorosis|pale)\b/i,
};

export function featuresMentioned(text: string): Feature[] {
  return FEATURES.filter((feature) => MENTIONS[feature].test(text));
}

export async function gradeBlurFrame(options: {
  photo: string;
  level: string;
  bytes: Uint8Array;
  apiKey: string;
}): Promise<BlurGrade> {
  const imageUrl = `data:image/jpeg;base64,${Buffer.from(options.bytes).toString("base64")}`;
  const clarity = measureJpeg(options.bytes);
  const segmented = await segmentBed(imageUrl, options.apiKey, 960 * 1280, "chili", 25_000);
  const gate = judgeFrame({
    masks: segmented.masks,
    sharpness: clarity?.sharpness ?? null,
    skyFraction: clarity?.skyFraction ?? null,
    contrastRange: clarity?.contrastRange ?? null,
    shadowFraction: clarity?.shadowFraction ?? null,
    highlightFraction: clarity?.highlightFraction ?? null,
  });
  const samConcepts = [...new Set(segmented.masks.map((mask) => mask.conceptId))].sort();
  const samChili = samConcepts.includes("chili");
  const base = {
    photo: options.photo,
    level: options.level,
    sharpness: clarity?.sharpness ?? null,
    gate,
    samConcepts,
    samChili,
  };
  try {
    const counts = emptyConceptCounts();
    for (const mask of segmented.masks) counts[mask.conceptId] += 1;
    const advice = await adviseBed({
      imageUrl,
      apiKey: options.apiKey,
      locale: "en",
      counts,
      context: emptyFarmerContext(),
      primaryCrop: samChili ? "chili" : null,
      farmerPlant: "chili",
      deadline: Date.now() + 45_000,
    });
    const museDiagnosis = advice.triageSource === "muse" && advice.likelyCauses.length > 0;
    return {
      ...base,
      museDiagnosis,
      museSaw: featuresMentioned(advice.observations.join(" ")),
      symptom: advice.likelyCauses[0] ?? "",
      confidence: advice.confidenceScore ?? null,
      failure: museDiagnosis ? null : advice.triageSource,
    };
  } catch (error) {
    return {
      ...base,
      museDiagnosis: false,
      museSaw: [],
      symptom: "",
      confidence: null,
      failure: error instanceof AnalyzeError ? error.code : "upstream",
    };
  }
}

export function blurLabReport(grades: readonly BlurGrade[], keys: Record<string, FeatureKey>, levels: readonly BlurLevel[]): string {
  const pct = (count: number, total: number) => (total === 0 ? "n/a" : `${count}/${total} (${Math.round((count / total) * 100)}%)`);
  const levelRows = levels.map((level) => {
    const rows = grades.filter((grade) => grade.level === level.id);
    const clean = (photo: string) => grades.find((grade) => grade.photo === photo && grade.level === "clean");
    let hits = 0;
    let total = 0;
    let invented = 0;
    let sameConcepts = 0;
    for (const grade of rows) {
      const key = keys[grade.photo];
      if (key) {
        const score = featureScore(grade.museSaw, key);
        hits += score.hits;
        total += score.total;
        invented += score.invented.length;
      }
      if (clean(grade.photo)?.samConcepts.join(",") === grade.samConcepts.join(",")) sameConcepts += 1;
    }
    const held = rows.filter((grade) => grade.gate !== "use").length;
    const diagnosedPastGate = rows.filter((grade) => grade.gate === "use" && grade.museDiagnosis).length;
    return `| ${level.label} | ${pct(rows.filter((grade) => grade.samChili).length, rows.length)} | ${pct(sameConcepts, rows.length)} | ${pct(hits, total)} | ${invented} | ${pct(held, rows.length)} | ${pct(diagnosedPastGate, rows.length)} |`;
  });
  const detail = grades.map(
    (grade) =>
      `| ${grade.photo} | ${grade.level} | ${grade.sharpness?.toFixed(3) ?? ""} | ${grade.gate} | ${grade.samConcepts.join(", ") || "(none)"} | ${grade.museSaw.join(", ") || "(none)"} | ${grade.confidence ?? ""} | ${grade.failure ?? ""} |`,
  );
  return [
    "# Blur lab: plant features on clean and blurred chili photos (live)",
    "",
    "Each farm photo is shrunk to the 1280 px upload size and blurred at four levels, then sent to SAM 3.1 and Muse with plant name Chili and no notes. Features Muse named are read from its observations and compared with a hand-made answer key (green pods, red or ripe pods, flowers, yellow leaves) in fixtures/chili/manifest.json.",
    "",
    "| blur | SAM found chili | SAM labels same as clean | Muse named real features | Muse named absent features | gate held | gate passed and Muse diagnosed |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...levelRows,
    "",
    "| photo | blur | sharpness | gate | SAM labels | Muse named | confidence | failure |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...detail,
    "",
  ].join("\n");
}

/** Share of answer-key features Muse named, and features it named that are not in the photo. */
export function featureScore(saw: readonly Feature[], key: FeatureKey) {
  const truth = FEATURES.filter((feature) => key[feature]);
  const hits = truth.filter((feature) => saw.includes(feature)).length;
  const invented = saw.filter((feature) => !key[feature]);
  return { hits, total: truth.length, invented };
}
