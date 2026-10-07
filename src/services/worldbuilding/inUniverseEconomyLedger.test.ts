// @vitest-environment jsdom
/** Tests: InUniverseEconomyLedger (WP 90.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createCurrencySystem,
  generatePrices,
  calculateDailyWage,
  simulateInflation,
  checkPlausibility,
  createEconomyLedger,
  formatLedger,
  createSampleLedger,
  createSampleInflationLedger,
  type CurrencySystem as _CurrencySystem,
  type PriceEntry as _PriceEntry,
  type EconomyLedger as _EconomyLedger,
} from "./inUniverseEconomyLedger";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("createCurrencySystem", () => {
  it("erzeugt Fantasy-System mit 3 Stufen", () => {
    const sys = createCurrencySystem("fantasy", 123);
    expect(sys.name).toBe("Klassisches Fantasy-System");
    expect(sys.baseUnit).toBe("Kupferheller");
    expect(sys.tiers.length).toBe(3);
    expect(sys.tiers[0].name).toBe("Goldkrone");
    expect(sys.tiers[1].name).toBe("Silberschilling");
    expect(sys.tiers[2].name).toBe("Kupferheller");
  });

  it("erzeugt Sci-Fi-System", () => {
    const sys = createCurrencySystem("scifi", 123);
    expect(sys.name).toBe("Sci-Fi Credits");
    expect(sys.baseUnit).toBe("Micro-Credit");
  });

  it("erzeugt Historisches System", () => {
    const sys = createCurrencySystem("historical", 123);
    expect(sys.name).toBe("Historisch (Mittelalterlich)");
    expect(sys.baseUnit).toBe("Pfennig");
  });

  it("ist deterministisch", () => {
    const s1 = createCurrencySystem("fantasy", 42);
    const s2 = createCurrencySystem("fantasy", 42);
    expect(s1).toEqual(s2);
  });
});

describe("generatePrices", () => {
  it("erzeugt Preise für alle Kategorien", () => {
    const sys = createCurrencySystem("fantasy", 1);
    const prices = generatePrices(sys, 1);
    expect(prices.length).toBeGreaterThan(20);
    const cats = new Set(prices.map(p => p.category));
    expect(cats.has("food")).toBe(true);
    expect(cats.has("lodging")).toBe(true);
    expect(cats.has("wages")).toBe(true);
    expect(cats.has("equipment")).toBe(true);
    expect(cats.has("transport")).toBe(true);
  });

  it("Preise sind positiv", () => {
    const sys = createCurrencySystem("fantasy", 1);
    const prices = generatePrices(sys, 1);
    expect(prices.every(p => p.price > 0)).toBe(true);
  });
});

describe("calculateDailyWage", () => {
  it("findet Tagelöhner-Lohn", () => {
    const sys = createCurrencySystem("fantasy", 1);
    const prices = generatePrices(sys, 1);
    const wage = calculateDailyWage(prices);
    expect(wage).toBeGreaterThan(0);
  });
});

describe("simulateInflation", () => {
  it("erhöht Preise bei positiver Inflation", () => {
    const sys = createCurrencySystem("fantasy", 1);
    const prices = generatePrices(sys, 1);
    const inflated = simulateInflation(prices, 100, 30); // 100% über 30 Tage = Verdopplung
    inflated.forEach((p, i) => {
      expect(p.price).toBeGreaterThanOrEqual(prices[i].price);
    });
  });

  it("bei 0% Inflation bleiben Preise gleich", () => {
    const sys = createCurrencySystem("fantasy", 1);
    const prices = generatePrices(sys, 1);
    const inflated = simulateInflation(prices, 0, 30);
    expect(inflated).toEqual(prices);
  });
});

describe("checkPlausibility", () => {
  it("bestätigt plausibles System", () => {
    const ledger = createSampleLedger();
    const result = checkPlausibility(ledger);
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it("erkennt Probleme bei extremer Inflation", () => {
    const ledger = createSampleInflationLedger();
    const result = checkPlausibility(ledger);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("createEconomyLedger", () => {
  it("erzeugt vollständiges Hauptbuch", () => {
    const ledger = createEconomyLedger("fantasy", 42);
    expect(ledger.currency).toBeDefined();
    expect(ledger.prices.length).toBeGreaterThan(20);
    expect(ledger.dailyWage).toBeGreaterThan(0);
    expect(ledger.plausibility).toBeDefined();
  });

  it("unterstützt verschiedene Währungssysteme", () => {
    const fantasy = createEconomyLedger("fantasy", 1);
    const scifi = createEconomyLedger("scifi", 1);
    const hist = createEconomyLedger("historical", 1);
    expect(fantasy.currency.baseUnit).toBe("Kupferheller");
    expect(scifi.currency.baseUnit).toBe("Micro-Credit");
    expect(hist.currency.baseUnit).toBe("Pfennig");
  });

  it("simuliert Inflation", () => {
    const ledger = createEconomyLedger("fantasy", 1, 50);
    expect(ledger.inflationRate).toBe(50);
  });
});

describe("formatLedger", () => {
  it("formatiert als lesbaren Text", () => {
    const ledger = createSampleLedger();
    const text = formatLedger(ledger);
    expect(text).toContain("WIRTSCHAFTS-HAUPBUCH");
    expect(text).toContain("WÄHRUNGSSTUFEN");
    expect(text).toContain("PREISE & LÖHNE");
  });
});

describe("createSampleLedger", () => {
  it("erzeugt Beispiel-Hauptbuch", () => {
    const ledger = createSampleLedger();
    expect(ledger.currency.name).toBe("Klassisches Fantasy-System");
    expect(ledger.inflationRate).toBe(0);
  });
});

describe("createSampleInflationLedger", () => {
  it("erzeugt Belagerungs-Szenario", () => {
    const ledger = createSampleInflationLedger();
    expect(ledger.inflationRate).toBe(150);
    expect(ledger.plausibility.valid).toBe(false);
  });
});