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
      "agroveterinary",
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

  it("keeps the home line short and asks for the plant by name", () => {
    const hero = "Photograph any plant on your farm bed. Meta intelligence models read the photo and return diagnoses and practical things to look at or do next.";
    expect(copy.en.lede).toBe(hero);
    expect(copy.en.lede.toLowerCase()).not.toContain("triage steps only");
    expect(copy.en.lede.toLowerCase()).not.toContain("not a diagnosis");
    expect(copy.sw.lede).toContain("Piga picha ya mmea wowote");
    expect(copy.sw.lede).toContain("Modeli za akili za Meta");
    expect(copy.sw.lede).not.toMatch(/Kenya/i);
    expect(copy.sw.lede).not.toContain("Huchagui zao");
    expect(copy.en.actions.toLowerCase()).toContain("three next checks");
    expect(copy.en.actionsHint.toLowerCase()).toContain("not a diagnosis");
    expect(copy.en.plantNameLabel.toLowerCase()).toContain("what plant");
    expect(copy.sw.plantNameLabel).toContain("Mmea gani");
    expect(copy.en.plantNamePlaceholder).toBe("e.g. Onion");
    expect(copy.sw.plantNamePlaceholder).toBe("mf. Kitunguu");
    expect(copy.en.plantNamePlaceholder).not.toMatch(/for example/i);
    expect(copy.sw.plantNamePlaceholder).not.toContain("Kwa mfano");
    expect(copy.en.plantLine({ cropFocus: "mixed", primaryCrop: "onion", detectedPlant: "Onion" }).toLowerCase()).toContain("unusual");
    expect(copy.en.plantLine({ cropFocus: "mixed", primaryCrop: "beetroot", detectedPlant: "Beetroot" }).toLowerCase()).not.toContain("mixed bed");
    expect(copy.sw.actions).toContain("Ukaguzi tatu");
    expect(copy.sw.plantLine({ cropFocus: "mixed", primaryCrop: "onion", detectedPlant: "Kitunguu" })).toContain("si wa kawaida");
    expect(copy.sw.plantLine({ cropFocus: "mixed", primaryCrop: "chili", detectedPlant: "Pilipili" })).not.toContain("kilichochanganyika");

    const removed = ["Works well with onion", "Often used for beetroot and chili", "Each of those crops grows on its own bed", "supportLine", "supportNote"];
    const readme = readFileSync("README.md", "utf8");
    const layout = readFileSync("app/layout.tsx", "utf8");
    const ui = readFileSync("components/bed-sense-app.tsx", "utf8");
    const pkg = readFileSync("package.json", "utf8");
    expect(layout).toContain(hero);
    expect(readme).toContain(hero);
    expect(readme.toLowerCase()).toContain("agroveterinary");
    expect(readme.toLowerCase()).toContain("kenya");
    for (const phrase of removed) {
      expect(readme, phrase).not.toContain(phrase);
      expect(layout, phrase).not.toContain(phrase);
      expect(ui, phrase).not.toContain(phrase);
      expect(pkg, phrase).not.toContain(phrase);
      expect(readFileSync("lib/copy.ts", "utf8"), phrase).not.toContain(phrase);
    }
    expect(ui).toContain("plant-name");
    expect(ui).not.toContain("<select");
    expect(ui).not.toContain("only these crops");
    expect(ui).not.toContain("supported-crops");

    const muse = readFileSync("lib/server/muse.ts", "utf8").toLowerCase();
    expect(muse).toContain("never on the same bed");
    expect(muse).toContain("its own bed");
    expect(muse).toContain("do not invent where the beds are");
    expect(muse).toContain("any farm plant");
    expect(muse).toContain("contextask");
    expect(muse).toContain("activeingredient");
    expect(muse).toContain("agroveterinary");
    expect(muse).toContain("product label");
    expect(muse).not.toContain("do not prescribe");
    const dev = readFileSync("docs/development.md", "utf8").toLowerCase();
    expect(dev).toContain("never on the same bed");
    expect(dev).toContain("unusual multi-crop frame");
    expect(dev).toContain("contextask");
    expect(dev).toContain("livekenyashopoffers");
    expect(dev).toContain("plantname");
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
