import type { Locale } from "@/lib/types";

export type SamplePhoto = {
  id: string;
  src: string;
  plantName: string;
  copy: Record<Locale, { label: string; detail: string; alt: string }>;
};

export const SAMPLE_PHOTOS: readonly SamplePhoto[] = [
  {
    id: "chili-canopy",
    src: "/samples/chili-canopy.jpg",
    plantName: "Chili",
    copy: {
      en: {
        label: "Chili canopy",
        detail: "Ripe pod & yellow leaves",
        alt: "Sample photo of a chili plant canopy with a ripe red pod and yellow leaves",
      },
      sw: {
        label: "Majani ya pilipili",
        detail: "Pilipili na majani ya njano",
        alt: "Picha ya mfano ya majani ya pilipili yenye pilipili nyekundu na majani ya njano",
      },
    },
  },
  {
    id: "chili-fruit",
    src: "/samples/chili-fruit.jpg",
    plantName: "Chili",
    copy: {
      en: {
        label: "Chili fruit",
        detail: "Pods & flowers close up",
        alt: "Sample photo of green chili pods and white flowers on a farm bed",
      },
      sw: {
        label: "Matunda ya pilipili",
        detail: "Pilipili na maua kwa karibu",
        alt: "Picha ya mfano ya pilipili za kijani na maua meupe shambani",
      },
    },
  },
  {
    id: "chili-bed",
    src: "/samples/chili-bed.jpg",
    plantName: "Chili",
    copy: {
      en: {
        label: "Chili bed",
        detail: "Full plant in bright sun",
        alt: "Sample photo of a full chili plant on a farm bed in bright sunlight",
      },
      sw: {
        label: "Kitanda cha pilipili",
        detail: "Mmea mzima kwenye jua",
        alt: "Picha ya mfano ya mmea mzima wa pilipili shambani kwenye jua",
      },
    },
  },
] as const;
