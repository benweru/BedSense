import { emptyConceptCounts } from "@/lib/concepts";
import { emptyFarmerContext } from "@/lib/context";
import { adviseBed } from "@/lib/server/muse";
import { segmentBed } from "@/lib/server/sam";
import { AnalyzeError, type ConceptId } from "@/lib/types";

export type ChiliGrade = {
  id: string;
  quality: string;
  samMarks: number;
  samCrop: boolean;
  museDiagnosis: boolean;
  museModel: string | null;
  failure: string | null;
};

export async function gradeChiliPhoto(options: {
  id: string;
  quality: string;
  imageUrl: string;
  apiKey: string;
}): Promise<ChiliGrade> {
  const segmented = await segmentBed(options.imageUrl, options.apiKey, 960 * 1280, "chili", 20_000);
  const samMarks = segmented.masks.length;
  const samCrop = segmented.masks.some((mask) => mask.crop === "chili" || mask.conceptId === "chili");
  try {
    const advice = await adviseBed({
      imageUrl: options.imageUrl,
      apiKey: options.apiKey,
      locale: "en",
      counts: countsFromMasks(segmented.masks),
      context: emptyFarmerContext(),
      primaryCrop: samCrop ? "chili" : null,
      farmerPlant: "chili",
      deadline: Date.now() + 40_000,
    });
    const museDiagnosis = advice.triageSource === "muse" && advice.likelyCauses.length > 0;
    return {
      id: options.id,
      quality: options.quality,
      samMarks,
      samCrop,
      museDiagnosis,
      museModel: advice.model,
      failure: museDiagnosis ? null : advice.triageSource,
    };
  } catch (error) {
    const failure = error instanceof AnalyzeError ? error.code : "upstream";
    return {
      id: options.id,
      quality: options.quality,
      samMarks,
      samCrop,
      museDiagnosis: false,
      museModel: null,
      failure,
    };
  }
}

function countsFromMasks(masks: readonly { conceptId: ConceptId }[]) {
  const counts = emptyConceptCounts();
  for (const mask of masks) counts[mask.conceptId] += 1;
  return counts;
}

export function chiliFailureSummary(grades: readonly ChiliGrade[], source: "simulated" | "live"): string {
  const total = grades.length;
  const samCrop = grades.filter((grade) => grade.samCrop).length;
  const samMarks = grades.filter((grade) => grade.samMarks > 0).length;
  const muse = grades.filter((grade) => grade.museDiagnosis).length;
  const bothMiss = grades.filter((grade) => !grade.samCrop && !grade.museDiagnosis).length;
  const rate = (count: number) => (total === 0 ? "n/a" : `${count}/${total} (${Math.round((count / total) * 100)}%)`);
  const rows = grades.map(
    (grade) =>
      `| ${grade.id} | ${grade.quality} | ${grade.samCrop ? "crop" : grade.samMarks > 0 ? "marks only" : "none"} | ${grade.samMarks} | ${grade.museDiagnosis ? "diagnosis" : "fail"} | ${grade.failure ?? ""} | ${grade.museModel ?? ""} |`,
  );
  return [
    source === "simulated"
      ? "# Chili messy-photo summary (simulated)"
      : "# Chili messy-photo summary (live)",
    "",
    source === "simulated"
      ? "These rates come from the harness with scripted SAM and Muse replies, one per fixture. They are not a live Meta run. Grade the same files against SAM 3.1 and Muse with `MOCK_META=0 MESSY_CHILI_KEY=... npm run messy-chili`."
      : "These rates are from SAM 3.1 and Muse on the fixture bytes, using the key in the environment.",
    "",
    `Photos: ${total}`,
    "",
    `- SAM named the chili crop: ${rate(samCrop)}`,
    `- SAM returned any mark: ${rate(samMarks)}`,
    `- Muse returned a real diagnosis (causes, not the local backup): ${rate(muse)}`,
    `- Muse failed: ${rate(total - muse)}`,
    `- No chili crop and no Muse diagnosis: ${rate(bothMiss)}`,
    "",
    "| id | quality | SAM | marks | Muse | failure | model |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}
