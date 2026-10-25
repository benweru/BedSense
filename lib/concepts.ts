import type { ConceptId, ConceptKind, CropId } from "@/lib/types";

export type ConceptSpec = {
  id: ConceptId;
  phrase: string;
  kind: ConceptKind;
  crop: CropId | null;
  color: string;
  swatch: string;
};

export const CONCEPTS: readonly ConceptSpec[] = [
  {
    id: "onion",
    phrase: "onion plant",
    kind: "crop",
    crop: "onion",
    color: "rgba(226, 163, 34, 0.62)",
    swatch: "#e2a322",
  },
  {
    id: "beetroot",
    phrase: "beetroot plant",
    kind: "crop",
    crop: "beetroot",
    color: "rgba(142, 47, 74, 0.58)",
    swatch: "#8e2f4a",
  },
  {
    id: "chili",
    phrase: "chili pepper plant",
    kind: "crop",
    crop: "chili",
    color: "rgba(196, 69, 54, 0.58)",
    swatch: "#c44536",
  },
  {
    id: "yellow-leaf",
    phrase: "yellow leaf",
    kind: "symptom",
    crop: null,
    color: "rgba(214, 192, 74, 0.72)",
    swatch: "#d6c04a",
  },
  {
    id: "weed",
    phrase: "weed",
    kind: "other",
    crop: null,
    color: "rgba(93, 122, 69, 0.55)",
    swatch: "#5d7a45",
  },
];

export function conceptById(id: ConceptId): ConceptSpec {
  const found = CONCEPTS.find((concept) => concept.id === id);
  if (!found) {
    throw new Error(`unknown concept ${id}`);
  }
  return found;
}
