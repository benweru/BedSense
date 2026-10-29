import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLUR_LEVELS,
  blurImage,
  blurLabReport,
  decodeJpeg,
  encodeJpeg,
  featureScore,
  featuresMentioned,
  gradeBlurFrame,
  toUploadSize,
  type BlurGrade,
  type FeatureKey,
} from "@/lib/blur-lab";
import { isSoftPhoto, measureJpeg } from "@/lib/photo-quality";

type Item = { id: string; file: string; key: FeatureKey };

const manifest = JSON.parse(readFileSync(path.join("fixtures", "chili", "manifest.json"), "utf8")) as Item[];

function variants(item: Item) {
  const upload = toUploadSize(decodeJpeg(readFileSync(path.join("fixtures", "chili", item.file))));
  return BLUR_LEVELS.map((level) => ({ level, bytes: encodeJpeg(blurImage(upload, level)) }));
}

describe("blur lab", () => {
  it("reads Muse feature mentions from plain field notes", () => {
    expect(featuresMentioned("Green pods hang under white flowers; one leaf is yellowing.")).toEqual(["pods", "flowers", "yellowLeaf"]);
    expect(featuresMentioned("A healthy chili pepper plant.")).toEqual([]);
    expect(featureScore(["pods", "ripe"], { pods: true, ripe: false, flowers: true, yellowLeaf: false })).toEqual({
      hits: 1,
      total: 2,
      invented: ["ripe"],
    });
  });

  it("measures the blur gate on every photo at every blur level", () => {
    const rows: string[] = [];
    const sharpness: Record<string, number[]> = {};
    for (const item of manifest) {
      const values = variants(item).map(({ bytes }) => measureJpeg(bytes)?.sharpness ?? Number.NaN);
      sharpness[item.id] = values;
      rows.push(`| ${item.id} | ${values.map((value) => `${value.toFixed(3)}${isSoftPhoto(value) ? " (held)" : ""}`).join(" | ")} |`);
    }
    const doc = [
      "# Blur gate on the chili photos (offline)",
      "",
      "Each farm photo is shrunk to the 1280 px upload size, then blurred. The number is the sharpness score the server computes; below 0.2 the photo is held as unclear when SAM has no strong mark.",
      "",
      `| photo | ${BLUR_LEVELS.map((level) => level.label).join(" | ")} |`,
      `| --- | ${BLUR_LEVELS.map(() => "---").join(" | ")} |`,
      ...rows,
      "",
    ].join("\n");
    writeFileSync(path.join("docs", "blur-gate-offline.md"), doc);
    for (const values of Object.values(sharpness)) {
      for (let index = 1; index < values.length - 1; index += 1) expect(values[index]!).toBeLessThanOrEqual(values[0]! + 1e-6);
    }
  }, 120_000);

  it("keeps the live report in step with the saved live grades", () => {
    const saved = path.join("docs", "blur-lab-live.json");
    if (!existsSync(saved)) return;
    const grades = JSON.parse(readFileSync(saved, "utf8")) as BlurGrade[];
    const keys = Object.fromEntries(manifest.map((item) => [item.id, item.key]));
    const report = blurLabReport(grades, keys, BLUR_LEVELS);
    if (process.env.BLUR_LAB_WRITE === "1") writeFileSync(path.join("docs", "blur-lab-live.md"), report);
    expect(readFileSync(path.join("docs", "blur-lab-live.md"), "utf8").replace(/\r\n/g, "\n")).toBe(report);
  });

  it("grades SAM and Muse on clean and blurred photos when a key is set", async () => {
    const apiKey = process.env.BLUR_LAB_KEY?.trim() ?? "";
    if (process.env.MOCK_META !== "0" || apiKey.length < 40) return;
    const grades: BlurGrade[] = [];
    for (const item of manifest) {
      for (const { level, bytes } of variants(item)) {
        grades.push(await gradeBlurFrame({ photo: item.id, level: level.id, bytes, apiKey }));
      }
    }
    writeFileSync(path.join("docs", "blur-lab-live.json"), JSON.stringify(grades, null, 2));
    const keys = Object.fromEntries(manifest.map((item) => [item.id, item.key]));
    writeFileSync(path.join("docs", "blur-lab-live.md"), blurLabReport(grades, keys, BLUR_LEVELS));
    expect(grades).toHaveLength(manifest.length * BLUR_LEVELS.length);
  }, 1_800_000);
});
