import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chiliFailureSummary, gradeChiliPhoto, type ChiliGrade } from "@/lib/messy-chili";
import { BUTTON_OUTPUT } from "@/tests/sam-fixture";

type Plan = {
  id: string;
  quality: string;
  sam: "crop" | "weed-only" | "none";
  muse: "diagnosis" | "fallback" | "missing";
};

const PLANS: Plan[] = [
  { id: "high-res", quality: "High resolution", sam: "crop", muse: "diagnosis" },
  { id: "blurred", quality: "Blurred", sam: "none", muse: "diagnosis" },
  { id: "low-res", quality: "Low resolution", sam: "none", muse: "fallback" },
  { id: "bad-lighting", quality: "Bad lighting", sam: "crop", muse: "diagnosis" },
  { id: "odd-angle", quality: "Odd angle", sam: "weed-only", muse: "diagnosis" },
  { id: "occluded", quality: "Occluded", sam: "none", muse: "missing" },
];

const DIAGNOSIS = {
  detectedPlant: "chili",
  symptom: "curl",
  observations: ["The chili fruit is looped."],
  likelyCauses: ["Sucking pests can curl young chili fruit.", "Uneven water can twist the same fruit."],
  mitigations: ["Take the worst fruit off the bed.", "Keep the water even."],
  actions: ["Check a new leaf for mites.", "Compare a looped fruit with a straight one.", "Photograph again if the next flush loops."],
  confidence: "medium",
  confidenceScore: 0.6,
  contextAsk: "",
  sprayIndicated: false,
  diseaseIndicated: false,
  suspect: "",
  chemicals: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("messy chili photos", () => {
  it("logs SAM marks and Muse diagnosis for every quality", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const grades: ChiliGrade[] = [];
    for (const plan of PLANS) {
      vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => respond(plan, String(url), init)));
      grades.push(
        await gradeChiliPhoto({
          id: plan.id,
          quality: plan.quality,
          imageUrl: `data:image/jpeg;fixture=${plan.id};base64,AAAA`,
          apiKey: "k".repeat(40),
        }),
      );
    }

    expect(grades.map((grade) => [grade.id, grade.samCrop, grade.samMarks > 0, grade.museDiagnosis, grade.failure])).toEqual([
      ["high-res", true, true, true, null],
      ["blurred", false, false, true, null],
      ["low-res", false, false, false, "local-fallback"],
      ["bad-lighting", true, true, true, null],
      ["odd-angle", false, true, true, null],
      ["occluded", false, false, false, "muse_unavailable"],
    ]);

    const summary = chiliFailureSummary(grades, "simulated");
    expect(summary).toContain("SAM named the chili crop: 2/6 (33%)");
    expect(summary).toContain("SAM returned any mark: 3/6 (50%)");
    expect(summary).toContain("Muse returned a real diagnosis (causes, not the local backup): 4/6 (67%)");
    expect(summary).toContain("Muse failed: 2/6 (33%)");
    expect(summary).toContain("No chili crop and no Muse diagnosis: 2/6 (33%)");
    expect(readFileSync(path.join("docs", "messy-chili-summary.md"), "utf8")).toBe(summary);
    expect(JSON.parse(readFileSync(path.join("fixtures", "chili", "manifest.json"), "utf8"))).toHaveLength(6);
  });

  it("grades the fixture bytes against live SAM and Muse when a key is set", async () => {
    const apiKey = process.env.MESSY_CHILI_KEY?.trim() ?? "";
    if (process.env.MOCK_META !== "0" || apiKey.length < 40) {
      expect(apiKey.length).toBeLessThan(40);
      return;
    }
    const manifest = JSON.parse(readFileSync(path.join("fixtures", "chili", "manifest.json"), "utf8")) as {
      id: string;
      file: string;
      quality: string;
    }[];
    const grades: ChiliGrade[] = [];
    for (const item of manifest) {
      const bytes = readFileSync(path.join("fixtures", "chili", item.file));
      grades.push(
        await gradeChiliPhoto({
          id: item.id,
          quality: item.quality,
          imageUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
          apiKey,
        }),
      );
    }
    const summary = chiliFailureSummary(grades, "live");
    console.log(summary);
    expect(grades).toHaveLength(manifest.length);
    expect(summary).toContain("Photos: 6");
  }, 180_000);
});

function respond(plan: Plan, url: string, init?: RequestInit): Response {
  if (url.endsWith("/models")) {
    return Response.json({ data: [{ id: "muse-spark-1.3-contributor" }, { id: "sam-3.1" }] });
  }
  const body = String(init?.body ?? "");
  if (url.endsWith("/responses")) {
    const text = plan.sam === "crop" || (plan.sam === "weed-only" && body.includes('"weed"')) ? BUTTON_OUTPUT : "";
    return Response.json({ output_text: text });
  }
  if (plan.muse === "diagnosis") {
    return Response.json({ choices: [{ message: { content: JSON.stringify(DIAGNOSIS) } }] });
  }
  if (plan.muse === "missing") {
    return Response.json({ error: { code: "model_not_found" } }, { status: 404 });
  }
  return Response.json({ error: { code: "server_error" } }, { status: 503 });
}
