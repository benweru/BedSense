import { containsDosage } from "@/lib/triage";

/** Farmer-typed plant name. Letters, numbers, spaces, hyphen, and apostrophe. */
export function parseFarmerPlant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 2 || text.length > 80) return null;
  if (containsDosage(text)) return null;
  return text;
}
