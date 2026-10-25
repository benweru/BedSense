import { describe, expect, it } from "vitest";
import { AGROVET_CATALOG } from "@/lib/agrovet-catalog";
import { adviseChemicals, liveKenyaShopOffers, matchCatalog } from "@/lib/agrovet";
import { containsDosage } from "@/lib/triage";
import { QUALITY_BANDS } from "@/lib/types";

describe("Kenya agrovet catalog", () => {
  it("gives every active three KES quality bands and no spray rate", () => {
    expect(liveKenyaShopOffers("mancozeb")).toBeNull();
    for (const entry of AGROVET_CATALOG) {
      expect(entry.offers.map((offer) => offer.quality)).toEqual([...QUALITY_BANDS]);
      expect(containsDosage(entry.useNote.en)).toBe(false);
      expect(containsDosage(entry.useNote.sw)).toBe(false);
      for (const offer of entry.offers) {
        expect(offer.priceMinKes).toBeGreaterThan(0);
        expect(offer.priceMinKes).toBeLessThanOrEqual(offer.priceMaxKes);
        expect(offer.shopName.length).toBeGreaterThan(0);
        expect(offer.place.length).toBeGreaterThan(0);
        expect(offer.shopKind.en.length).toBeGreaterThan(0);
        expect(offer.shopKind.sw.length).toBeGreaterThan(0);
      }
    }
  });

  it("matches actives to the longer catalog name and attaches shops", () => {
    expect(matchCatalog("mancozeb")?.id).toBe("mancozeb");
    expect(matchCatalog("Dithane M-45")?.id).toBe("mancozeb");
    expect(matchCatalog("metalaxyl-M + mancozeb")?.id).toBe("metalaxyl-mancozeb");
    expect(matchCatalog("Ridomil Gold")?.id).toBe("metalaxyl-mancozeb");
    expect(matchCatalog("unobtainium")).toBeNull();

    const advice = adviseChemicals({
      locale: "en",
      diseaseIndicated: true,
      suspect: "purple blotch",
      chemicals: [
        { activeIngredient: "mancozeb", productClass: "fungicide", useNote: "Spray 20 ml per 20 L tonight." },
        { activeIngredient: "mystery dust", productClass: "fungicide", useNote: "Ask the agrovet to match this name." },
      ],
    });
    expect(advice?.lookup).toBe("catalog");
    expect(advice?.suspect).toBe("purple blotch");
    expect(advice?.verifyNote.toLowerCase()).toContain("agroveterinary");
    expect(advice?.products[0]?.activeIngredient).toBe("Mancozeb");
    expect(advice?.products[0]?.useNote.toLowerCase()).not.toMatch(/\d+\s*ml/);
    expect(advice?.products[0]?.useNote.toLowerCase()).toContain("product label");
    expect(advice?.products[0]?.offers[1]?.shopName).toBe("Elgon Kenya");
    expect(advice?.products[0]?.offers[1]?.priceMaxKes).toBeGreaterThan(advice?.products[0]?.offers[0]?.priceMaxKes ?? 0);
    expect(advice?.products[1]?.offers).toEqual([]);
    expect(advice?.priceNote).toContain("KES");
  });

  it("stays quiet when no disease is indicated", () => {
    expect(
      adviseChemicals({
        locale: "sw",
        diseaseIndicated: false,
        suspect: "",
        chemicals: [],
      }),
    ).toBeNull();
  });

  it("uses Kiswahili shop kinds from the same catalog", () => {
    const advice = adviseChemicals({
      locale: "sw",
      diseaseIndicated: true,
      suspect: "Thrips kwenye pilipili",
      chemicals: [{ activeIngredient: "lambda-cyhalothrin" }],
    });
    expect(advice?.products[0]?.productClass).toBe("dawa ya wadudu");
    expect(advice?.products[0]?.offers[0]?.shopKind).toBe("duka la agrovet");
    expect(advice?.products[0]?.offers[0]?.priceMinKes).toBeLessThan(advice?.products[0]?.offers[2]?.priceMinKes ?? 0);
  });
});
