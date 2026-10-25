import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|css|svg)$/.test(entry)) files.push(full);
  }
  return files;
}

function shape(value: unknown): unknown {
  if (typeof value === "function") return "fn";
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shape((value as Record<string, unknown>)[key])]),
    );
  }
  return typeof value;
}

describe("public project boundaries", () => {
  it("keeps the model key off the client", () => {
    const files = [...walk("app"), ...walk("components")].filter((file) => !file.includes(`${path.sep}api${path.sep}`));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toContain("MODEL_API_KEY");
      expect(text, file).not.toContain("api.meta.ai");
      expect(text, file).not.toContain("lib/server");
    }
  });

  it("ships an empty key, ignores env files, and stays MIT", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toMatch(/^MODEL_API_KEY=\s*$/m);
    expect(example).toContain("MOCK_META=1");
    expect(readFileSync(".gitignore", "utf8")).toMatch(/\.env\*/);
    expect(readFileSync("LICENSE", "utf8")).toContain("MIT License");

    const readme = readFileSync("README.md", "utf8");
    for (const phrase of [
      "BedSense",
      "Meta Global AI Developer Hackathon",
      "Indie",
      "Build for Your World",
      "Kiswahili",
      "MIT",
      "agronomist",
      "docs/development.md",
    ]) {
      expect(readme).toContain(phrase);
    }
    for (const phrase of [
      "MOCK_META",
      "MODEL_API_KEY",
      ".env.example",
      "muse-spark-1.3",
      "sam-3.1",
      "mask_encoding",
      "localStorage",
      "npm run",
      "/api/analyze",
    ]) {
      expect(readme, phrase).not.toContain(phrase);
    }

    const dev = readFileSync("docs/development.md", "utf8");
    for (const phrase of [
      "MOCK_META",
      "MODEL_API_KEY",
      ".env.example",
      "sam-3.1",
      "muse-spark-1.3-contributor",
      "`muse-spark-1.3`",
      "/api/analyze",
      "localStorage",
      "mask_encoding",
      "npm test",
    ]) {
      expect(dev, phrase).toContain(phrase);
    }
  });

  it("gives English and Swahili the same UI shape", () => {
    expect(shape(copy.en)).toEqual(shape(copy.sw));
  });

  it("speaks to any vegetable bed and explains the three next checks", () => {
    const readme = readFileSync("README.md", "utf8").toLowerCase();
    expect(readme).toContain("any vegetable farm bed");
    expect(readme).toContain("exactly three next checks");
    expect(readme).toContain("not a diagnosis");
    expect(readme).toContain("treatment rate");
    expect(readme).toContain("onion");
    expect(readme).toContain("beetroot");
    expect(readme).toContain("chili");
    expect(readme).toContain("never on the same bed");
    expect(readme).toContain("its own bed");
    expect(readme).toContain("chili is a separate bed");
    expect(readme).toContain("name the plant");
    expect(readme).toContain("kenyan");
    expect(readme).toContain("works well with onion");
    expect(readme).toContain("any other farm plant");
    expect(copy.en.lede.toLowerCase()).toContain("exactly three next checks");
    expect(copy.en.lede.toLowerCase()).toContain("not a treatment rate");
    expect(copy.en.lede.toLowerCase()).toContain("name the plant");
    expect(copy.en.plantNamePlaceholder).toBe("Onion / mf. Kitunguu");
    expect(copy.en.chemicalsTitle.toLowerCase()).toContain("kenyan");
    expect(copy.en.supportLine.toLowerCase()).toContain("works well with");
    expect(copy.en.supportLine.toLowerCase()).toContain("often used for");
    expect(copy.en.supportNote.toLowerCase()).toContain("never on the same bed");
    expect(copy.en.supportNote.toLowerCase()).toContain("its own bed");
    expect(copy.en.supportNote.toLowerCase()).toContain("any other farm plant");
    expect(copy.en.actions.toLowerCase()).toContain("three next checks");
    expect(copy.en.actionsHint.toLowerCase()).toContain("not a diagnosis");
    expect(copy.en.plantLine({ cropFocus: "mixed", primaryCrop: "onion", detectedPlant: "Onion" }).toLowerCase()).toContain("unusual");
    expect(copy.en.plantLine({ cropFocus: "mixed", primaryCrop: "beetroot", detectedPlant: "Beetroot" }).toLowerCase()).not.toContain("mixed bed");
    expect(copy.sw.lede).toContain("ukaguzi tatu");
    expect(copy.sw.lede).toContain("Taja mmea");
    expect(copy.sw.supportNote).toContain("kitanda chake");
    expect(copy.sw.supportNote).toContain("havipandwi kamwe");
    expect(copy.sw.chemicalsTitle).toMatch(/Kenya/);
    expect(copy.sw.actions).toContain("Ukaguzi tatu");
    expect(copy.sw.actionsHint).toContain("kipimo cha tiba");
    expect(copy.sw.plantLine({ cropFocus: "mixed", primaryCrop: "onion", detectedPlant: "Kitunguu" })).toContain("si wa kawaida");
    expect(copy.sw.plantLine({ cropFocus: "mixed", primaryCrop: "chili", detectedPlant: "Pilipili" })).not.toContain("kilichochanganyika");

    const layout = readFileSync("app/layout.tsx", "utf8").toLowerCase();
    expect(layout).toContain("its own bed");
    expect(layout).toContain("works well with");
    const muse = readFileSync("lib/server/muse.ts", "utf8").toLowerCase();
    expect(muse).toContain("never on the same bed");
    expect(muse).toContain("its own bed");
    expect(muse).toContain("do not invent where the beds are");
    expect(muse).toContain("any farm plant");
    expect(muse).toContain("contextask");
    const dev = readFileSync("docs/development.md", "utf8").toLowerCase();
    expect(dev).toContain("never on the same bed");
    expect(dev).toContain("unusual multi-crop frame");
    expect(dev).toContain("contextask");
    const ui = readFileSync("components/bed-sense-app.tsx", "utf8");
    expect(ui).not.toContain("<select");
    expect(ui).not.toContain("only these crops");
    expect(ui).toContain("plantName");
  });

  it("does not describe onion, beetroot, and chili as sharing a bed", () => {
    const files = [
      "README.md",
      "app/layout.tsx",
      "package.json",
      "docs/development.md",
      "lib/copy.ts",
      "lib/crop-focus.ts",
      "lib/types.ts",
      "lib/server/muse.ts",
      "lib/server/mock.ts",
      "components/bed-sense-app.tsx",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/share(?:s|d)? (?:the same |a )?bed/i);
      expect(text, file).not.toMatch(/co-?plant/i);
      expect(text, file).not.toMatch(/mixed bed/i);
      expect(text, file).not.toMatch(/kilichochanganyika/i);
    }
  });
});
