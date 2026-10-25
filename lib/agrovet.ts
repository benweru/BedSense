import type { ChemicalOffer, ChemicalQuality, Locale } from "@/lib/types";
import { type IssueId, issueUsesChemicals } from "@/lib/issues";

type OfferCopy = { en: string; sw: string };

type CatalogItem = {
  name: string;
  quality: ChemicalQuality;
  min: number;
  max: number;
  shops: OfferCopy;
  why: OfferCopy;
};

const LOCAL: OfferCopy = { en: "A licensed local agrovet", sw: "Agrovet yenye leseni karibu nawe" };
const STANDARD: OfferCopy = { en: "Agroduka or Elgon Kenya", sw: "Agroduka au Elgon Kenya" };
const PREMIUM: OfferCopy = {
  en: "Elgon Kenya or a Kenya Farmers Association shop",
  sw: "Elgon Kenya au duka la Kenya Farmers Association",
};

/**
 * Indicative Kenyan retail bands for a small pack, by quality.
 * Not a quotation and not a spray rate. The agrovet confirms the label.
 */
const CATALOG: Record<IssueId, readonly CatalogItem[]> = {
  curl: pestOffers("curl"),
  deformity: pestOffers("deformity"),
  insects: pestOffers("insects"),
  spots: [
    {
      name: "Mancozeb",
      quality: "economy",
      min: 700,
      max: 1600,
      shops: LOCAL,
      why: {
        en: "A protectant fungicide for leaf spots when the agrovet agrees the mark looks fungal.",
        sw: "Kiuatilifu cha kinga kwa madoa ya majani ikiwa agrovet anakubali kuwa dalili inaonekana kama kuvu.",
      },
    },
    {
      name: "Metalaxyl + mancozeb",
      quality: "standard",
      min: 1400,
      max: 3200,
      shops: STANDARD,
      why: {
        en: "A common blight mix when spots are spreading after wet leaves.",
        sw: "Mchanganyiko wa kawaida wa blight wakati madoa yanaenea baada ya majani mvua.",
      },
    },
    {
      name: "Azoxystrobin",
      quality: "premium",
      min: 2200,
      max: 4800,
      shops: PREMIUM,
      why: {
        en: "A specialist fungicide when a protectant has already been used and spots continue.",
        sw: "Kiuatilifu maalum ikiwa dawa ya kinga tayari imetumika na madoa yanaendelea.",
      },
    },
  ],
  wilt: [],
  yellowing: [],
};

function pestOffers(kind: "curl" | "deformity" | "insects"): CatalogItem[] {
  const abamectin: OfferCopy =
    kind === "insects"
      ? {
          en: "For mites and thrips. Match it to the insect you can see, not to every chew mark.",
          sw: "Kwa utitiri na thrips. Ilinganishe na mdudu unayemwona, si kila alama ya kutafuna.",
        }
      : kind === "deformity"
        ? {
            en: "For mites and thrips when fruit or new growth is twisted.",
            sw: "Kwa utitiri na thrips wakati tunda au ukuaji mpya umepinda.",
          }
        : {
            en: "For mites and thrips when leaves or fruit are curling.",
            sw: "Kwa utitiri na thrips wakati majani au tunda vinakunjika.",
          };
  const imidacloprid: OfferCopy =
    kind === "insects"
      ? {
          en: "For whitefly and aphids. Ask the agrovet about bees before you use it.",
          sw: "Kwa nzi weupe na vidukari. Uliza agrovet kuhusu nyuki kabla ya kuitumia.",
        }
      : {
          en: "For whitefly and aphids that curl leaves and can spread a virus. Ask the agrovet about bees.",
          sw: "Kwa nzi weupe na vidukari wanaokunja majani na kusambaza virusi. Uliza agrovet kuhusu nyuki.",
        };
  const premium: CatalogItem =
    kind === "insects"
      ? {
          name: "Bacillus thuringiensis",
          quality: "premium",
          min: 900,
          max: 2500,
          shops: PREMIUM,
          why: {
            en: "A caterpillar product when the damage is chewing rather than curling or stippling.",
            sw: "Dawa ya viwavi wakati uharibifu ni kutafuna, si kukunja au madoa madogo.",
          },
        }
      : {
          name: "Spiromesifen",
          quality: "premium",
          min: 1800,
          max: 4500,
          shops: PREMIUM,
          why: {
            en: "A specialist mite and whitefly product when a standard product has already been used.",
            sw: "Dawa maalum ya utitiri na nzi weupe ikiwa dawa ya kawaida tayari imetumika.",
          },
        };
  return [
    {
      name: "Abamectin",
      quality: "economy",
      min: 350,
      max: 900,
      shops: LOCAL,
      why: abamectin,
    },
    {
      name: "Imidacloprid",
      quality: "standard",
      min: 500,
      max: 1400,
      shops: STANDARD,
      why: imidacloprid,
    },
    premium,
  ];
}

export function chemicalOffers(locale: Locale, issue: IssueId): ChemicalOffer[] {
  if (!issueUsesChemicals(issue)) return [];
  return CATALOG[issue].map((item) => ({
    name: item.name,
    quality: item.quality,
    kesBand: `KES ${item.min}–${item.max}`,
    shops: item.shops[locale],
    why: item.why[locale],
  }));
}
