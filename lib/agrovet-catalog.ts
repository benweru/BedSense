import type { Locale, QualityBand } from "@/lib/types";

/**
 * Curated example catalog of fungicides and insecticides commonly sold
 * through Kenyan agrovets. KES figures are wide demo bands, not a live
 * quote and not a spray rate. There is no free public price API on this
 * path; `liveKenyaShopOffers` is the swap point.
 */
export type CatalogOffer = {
  quality: QualityBand;
  brand: string;
  pack: string;
  shopName: string;
  shopKind: Record<Locale, string>;
  place: string;
  priceMinKes: number;
  priceMaxKes: number;
};

export type CatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  productClass: Record<Locale, string>;
  useNote: Record<Locale, string>;
  offers: CatalogOffer[];
};

const agrovet = { en: "agrovet shop", sw: "duka la agrovet" };
const distributor = { en: "input distributor", sw: "msambazaji wa pembejeo" };
const stockist = { en: "input stockist", sw: "duka la pembejeo" };

export const AGROVET_CATALOG: readonly CatalogEntry[] = [
  {
    id: "mancozeb",
    name: "Mancozeb",
    aliases: ["mancozeb", "dithane", "oshothane"],
    productClass: { en: "fungicide", sw: "dawa ya ukungu" },
    useNote: {
      en: "Protectant fungicide for leaf spots and blights on a vegetable bed. The rate must follow the product label.",
      sw: "Dawa ya ukungu ya kinga dhidi ya madoa na ukungu kwenye kitanda cha mboga. Kipimo kifuate kibandiko cha bidhaa.",
    },
    offers: [
      {
        quality: "economy",
        brand: "Mancozeb 80 WP",
        pack: "500 g",
        shopName: "Independent agrovet",
        shopKind: agrovet,
        place: "Nakuru",
        priceMinKes: 450,
        priceMaxKes: 800,
      },
      {
        quality: "mid",
        brand: "Oshothane",
        pack: "500 g",
        shopName: "Elgon Kenya",
        shopKind: distributor,
        place: "Nairobi, Nakuru, Eldoret",
        priceMinKes: 900,
        priceMaxKes: 1500,
      },
      {
        quality: "premium",
        brand: "Dithane M-45",
        pack: "1 kg",
        shopName: "Amiran Kenya",
        shopKind: stockist,
        place: "Nairobi",
        priceMinKes: 2200,
        priceMaxKes: 3600,
      },
    ],
  },
  {
    id: "metalaxyl-mancozeb",
    name: "Metalaxyl-M + mancozeb",
    aliases: ["metalaxyl-m + mancozeb", "metalaxyl", "mefenoxam", "ridomil"],
    productClass: { en: "fungicide", sw: "dawa ya ukungu" },
    useNote: {
      en: "Fungicide used when downy mildew or a wet leaf blight is suspected. It pairs a systemic active with mancozeb. The rate must follow the product label.",
      sw: "Dawa ya ukungu inapotokea shaka ya downy mildew au ukungu wa majani yenye unyevu. Ina kemikali ya ndani pamoja na mancozeb. Kipimo kifuate kibandiko cha bidhaa.",
    },
    offers: [
      {
        quality: "economy",
        brand: "Metalaxyl + mancozeb 72 WP",
        pack: "250 g",
        shopName: "Independent agrovet",
        shopKind: agrovet,
        place: "Kisumu",
        priceMinKes: 650,
        priceMaxKes: 1100,
      },
      {
        quality: "mid",
        brand: "Ridomil Gold MZ",
        pack: "250 g",
        shopName: "Elgon Kenya",
        shopKind: distributor,
        place: "Nairobi, Eldoret",
        priceMinKes: 1800,
        priceMaxKes: 3200,
      },
      {
        quality: "premium",
        brand: "Ridomil Gold MZ",
        pack: "1 kg",
        shopName: "Amiran Kenya",
        shopKind: stockist,
        place: "Nairobi",
        priceMinKes: 6000,
        priceMaxKes: 9500,
      },
    ],
  },
  {
    id: "copper-oxychloride",
    name: "Copper oxychloride",
    aliases: ["copper oxychloride", "cupravit", "coprox", "copper"],
    productClass: { en: "fungicide", sw: "dawa ya ukungu" },
    useNote: {
      en: "Contact fungicide often used when leaf spots are spreading. The rate must follow the product label.",
      sw: "Dawa ya ukungu ya mguso, hutumika madoa ya majani yanapoenea. Kipimo kifuate kibandiko cha bidhaa.",
    },
    offers: [
      {
        quality: "economy",
        brand: "Copper oxychloride 50 WP",
        pack: "500 g",
        shopName: "Independent agrovet",
        shopKind: agrovet,
        place: "Nyeri",
        priceMinKes: 400,
        priceMaxKes: 750,
      },
      {
        quality: "mid",
        brand: "Cupravit",
        pack: "500 g",
        shopName: "Twiga stockist",
        shopKind: stockist,
        place: "Nairobi",
        priceMinKes: 850,
        priceMaxKes: 1400,
      },
      {
        quality: "premium",
        brand: "Cupravit",
        pack: "1 kg",
        shopName: "Amiran Kenya",
        shopKind: stockist,
        place: "Nairobi",
        priceMinKes: 1600,
        priceMaxKes: 2600,
      },
    ],
  },
  {
    id: "lambda-cyhalothrin",
    name: "Lambda-cyhalothrin",
    aliases: ["lambda-cyhalothrin", "lambda cyhalothrin", "karate"],
    productClass: { en: "insecticide", sw: "dawa ya wadudu" },
    useNote: {
      en: "Insecticide for sucking insects such as thrips on a vegetable bed. The rate must follow the product label.",
      sw: "Dawa ya wadudu wanaofyonza kama thrips kwenye kitanda cha mboga. Kipimo kifuate kibandiko cha bidhaa.",
    },
    offers: [
      {
        quality: "economy",
        brand: "Lambda-cyhalothrin 5 EC",
        pack: "100 ml",
        shopName: "Independent agrovet",
        shopKind: agrovet,
        place: "Meru",
        priceMinKes: 280,
        priceMaxKes: 550,
      },
      {
        quality: "mid",
        brand: "Karate 5 EC",
        pack: "100 ml",
        shopName: "Elgon Kenya",
        shopKind: distributor,
        place: "Nairobi, Nakuru",
        priceMinKes: 650,
        priceMaxKes: 1200,
      },
      {
        quality: "premium",
        brand: "Karate Zeon",
        pack: "250 ml",
        shopName: "Amiran Kenya",
        shopKind: stockist,
        place: "Nairobi",
        priceMinKes: 1500,
        priceMaxKes: 2600,
      },
    ],
  },
  {
    id: "abamectin",
    name: "Abamectin",
    aliases: ["abamectin", "dynamec"],
    productClass: { en: "insecticide", sw: "dawa ya wadudu" },
    useNote: {
      en: "Insecticide and miticide used when thrips or mites are suspected. The rate must follow the product label.",
      sw: "Dawa ya wadudu na utitiri inapotokea shaka ya thrips au utitiri. Kipimo kifuate kibandiko cha bidhaa.",
    },
    offers: [
      {
        quality: "economy",
        brand: "Abamectin 1.8 EC",
        pack: "50 ml",
        shopName: "Independent agrovet",
        shopKind: agrovet,
        place: "Thika",
        priceMinKes: 350,
        priceMaxKes: 700,
      },
      {
        quality: "mid",
        brand: "Dynamec",
        pack: "100 ml",
        shopName: "Osho stockist",
        shopKind: stockist,
        place: "Nairobi",
        priceMinKes: 800,
        priceMaxKes: 1500,
      },
      {
        quality: "premium",
        brand: "Dynamec",
        pack: "250 ml",
        shopName: "Amiran Kenya",
        shopKind: stockist,
        place: "Nairobi",
        priceMinKes: 1800,
        priceMaxKes: 3200,
      },
    ],
  },
];
