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
      "MOCK_META",
      "MODEL_API_KEY",
      "sam-3.1",
      "muse-spark-1.3-contributor",
      "muse-spark-1.3",
      "MIT",
      "/api/analyze",
      "agronomist",
    ]) {
      expect(readme).toContain(phrase);
    }
  });

  it("gives English and Swahili the same UI shape", () => {
    expect(shape(copy.en)).toEqual(shape(copy.sw));
  });
});
