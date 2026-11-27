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
    id: "tomato-leaf",
    src: "/samples/tomato-leaf.jpg",
    plantName: "Tomato",
    copy: {
      en: {
        label: "Tomato leaf",
        detail: "Yellowing & dark spots",
        alt: "Real photo of a tomato leaf held in a hand showing yellowing and dark spots with green tomatoes behind",
      },
      sw: {
        label: "Nyanya",
        detail: "Njano na madoa meusi",
        alt: "Picha halisi ya jani la nyanya mkononi lenye njano na madoa meusi",
      },
    },
  },
  {
    id: "potato-tubers",
    src: "/samples/potato-tubers.jpg",
    plantName: "Potato",
    copy: {
      en: {
        label: "Potato tubers",
        detail: "Dark circular skin spots",
        alt: "Real photo of harvested potato tubers covered in dark circular sunken spots",
      },
      sw: {
        label: "Viazi",
        detail: "Madoa meusi kwenye ganda",
        alt: "Picha halisi ya viazi vilivyovunwa vyenye madoa meusi ya duara kwenye ganda",
      },
    },
  },
] as const;
