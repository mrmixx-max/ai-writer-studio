// @vitest-environment jsdom
// DirectSalesProductBundler Tests (Meilenstein 61.0 / v7.3.0)
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  PRICE_TIERS,
  compareMargins,
  generateShopifyCsv,
  generateWooCommerceCsv,
  generateProductCopy,
  createSamplePriceTier,
  createSampleBundle,
} from "./directSalesProductBundler";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("bundle")).toBe(hashString("bundle"));
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    expect(hashString("standard")).not.toBe(hashString("deluxe"));
  });

  it("gibt eine vorzeichenlose 32-Bit-Zahl zurück", () => {
    const h = hashString("Shopify");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch", () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it("liefert Werte in [0,1)", () => {
    const rng = createSeededRandom(11);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("PRICE_TIERS", () => {
  it("enthält drei Stufen", () => {
    expect(PRICE_TIERS).toHaveLength(3);
  });

  it("bildet die 3-Stufen-Preistreppe ab (7,99 / 19,99 / 49,00)", () => {
    expect(PRICE_TIERS[0].price).toBeCloseTo(7.99, 2);
    expect(PRICE_TIERS[1].price).toBeCloseTo(19.99, 2);
    expect(PRICE_TIERS[2].price).toBeCloseTo(49.0, 2);
  });

  it("bildet die Reingewinne ab (7,50 / 18,90 / 46,50)", () => {
    expect(PRICE_TIERS[0].netProfit).toBeCloseTo(7.5, 2);
    expect(PRICE_TIERS[1].netProfit).toBeCloseTo(18.9, 2);
    expect(PRICE_TIERS[2].netProfit).toBeCloseTo(46.5, 2);
  });

  it("hat gültige Felder für jede Stufe", () => {
    for (const t of PRICE_TIERS) {
      expect(typeof t.id).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.price).toBeGreaterThan(0);
      expect(Array.isArray(t.contents)).toBe(true);
      expect(t.contents.length).toBeGreaterThan(0);
      expect(t.netProfit).toBeGreaterThan(0);
      expect(t.netProfit).toBeLessThan(t.price);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it("hat steigende Preise", () => {
    expect(PRICE_TIERS[1].price).toBeGreaterThan(PRICE_TIERS[0].price);
    expect(PRICE_TIERS[2].price).toBeGreaterThan(PRICE_TIERS[1].price);
  });
});

describe("compareMargins", () => {
  it("stellt Direktvertrieb gegen Amazon gegenüber", () => {
    const result = compareMargins("deluxe", 7.99, 0.7);
    expect(result.directNet).toBeGreaterThan(0);
    expect(result.amazonNet).toBeGreaterThan(0);
    expect(typeof result.advantage).toBe("number");
    expect(typeof result.advantagePercent).toBe("number");
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const a = compareMargins("standard", 9.99, 0.7);
    const b = compareMargins("standard", 9.99, 0.7);
    expect(a.advantage).toBe(b.advantage);
  });

  it("wirft bei unbekannter tierId", () => {
    expect(() => compareMargins("gibtsnicht", 9.99)).toThrow();
  });
});

describe("generateShopifyCsv", () => {
  it("liefert eine CSV mit Header und Datenzeile", () => {
    const result = generateShopifyCsv("standard", 1);
    expect(result.csv).toContain("Handle");
    expect(result.csv).toContain("Title");
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
    expect(result.platform).toBe("Shopify");
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(generateShopifyCsv("deluxe", 2).csv).toBe(generateShopifyCsv("deluxe", 2).csv);
  });
});

describe("generateWooCommerceCsv", () => {
  it("liefert eine WooCommerce-CSV", () => {
    const result = generateWooCommerceCsv("collector", 1);
    expect(result.csv.length).toBeGreaterThan(0);
    expect(result.platform).toBe("WooCommerce");
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });
});

describe("generateProductCopy", () => {
  it("liefert Headline, Bullet Points und Beschreibung", () => {
    const copy = generateProductCopy("deluxe", 1);
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(Array.isArray(copy.bulletPoints)).toBe(true);
    expect(copy.bulletPoints.length).toBeGreaterThan(0);
    expect(copy.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    expect(generateProductCopy("standard", 5).headline).toBe(
      generateProductCopy("standard", 5).headline,
    );
  });
});

describe("createSamplePriceTier", () => {
  it("liefert eine gültige Preisstufe", () => {
    const t = createSamplePriceTier();
    expect(t.id.length).toBeGreaterThan(0);
    expect(t.price).toBeGreaterThan(0);
    expect(t.netProfit).toBeLessThan(t.price);
  });
});

describe("createSampleBundle", () => {
  it("liefert ein gültiges Bundle", () => {
    const b = createSampleBundle();
    expect(b.name.length).toBeGreaterThan(0);
    expect(b.price).toBeGreaterThan(0);
    expect(b.contents.length).toBeGreaterThan(0);
    expect(b.tags.length).toBeGreaterThan(0);
    expect(b.tierId.length).toBeGreaterThan(0);
  });
});
