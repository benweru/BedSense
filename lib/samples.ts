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
        label: "Chili bed",
        detail: "Ripe pod & yellow leaves",
        alt: "Sample photo of a chili plant canopy with a ripe red pod and yellow leaves",
      },
      sw: {
        label: "Pilipili",
        detail: "Pilipili na majani ya njano",
        alt: "Picha ya mfano ya mmea wa pilipili yenye pilipili nyekundu na majani ya njano",
      },
    },
  },
  {
    id: "onion-bed",
    src: "/samples/onion-bed.jpg",
    plantName: "Onion",
    copy: {
      en: {
        label: "Onion bed",
        detail: "Yellowing tips & blotches",
        alt: "Sample photo of a green onion bed with yellowing outer leaf tips and purple blotches",
      },
      sw: {
        label: "Kitunguu",
        detail: "Ncha za njano na madoa",
        alt: "Picha ya mfano ya kitanda cha vitunguu yenye ncha za njano na madoa",
      },
    },
  },
  {
    id: "beetroot-bed",
    src: "/samples/beetroot-bed.jpg",
    plantName: "Beetroot",
    copy: {
      en: {
        label: "Beetroot bed",
        detail: "Round spots on outer leaves",
        alt: "Sample photo of a beetroot bed with round pale-centered leaf spots on outer leaves",
      },
      sw: {
        label: "Beetroot",
        detail: "Madoa duara kwenye majani",
        alt: "Picha ya mfano ya kitanda cha beetroot yenye madoa duara kwenye majani ya nje",
      },
    },
  },
] as const;
