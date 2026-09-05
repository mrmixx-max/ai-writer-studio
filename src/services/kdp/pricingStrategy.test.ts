// Tests: Preisstrategien (Sprint 5, Agent 3) — deterministische Preislogik.
import { describe, it, expect } from "vitest";
import {
  PRICING_STRATEGIES,
  computePrices,
  describePricingStrategy,
  parsePricingConfig,
} from "./pricingStrategy";

describe("Preisstrategien: Registry", () => {
  it("liefert benannte Strategien mit Beschreibung", () => {
    const ids = PRICING_STRATEGIES.map((s) => s.id);
    expect(ids).toContain("standard");
    expect(ids).toContain("launch");
    expect(ids).toContain("premium");
    expect(ids).toContain("series-loss-leader");
  });

  it("jede Strategie definiert Preise für USD/EUR/GBP", () => {
    for (const s of PRICING_STRATEGIES) {
      expect(s.prices.USD).toBeGreaterThan(0);
      expect(s.prices.EUR).toBeGreaterThan(0);
      expect(s.prices.GBP).toBeGreaterThan(0);
    }
  });
});

describe("Preisstrategien: computePrices", () => {
  it("liefert die Preise der gewählten Strategie", () => {
    const p = computePrices("premium");
    expect(p.USD).toBe(7.99);
    expect(p.EUR).toBe(7.99);
    expect(p.GBP).toBe(6.99);
  });

  it("Standard-Strategie, wenn keine angegeben", () => {
    expect(computePrices(undefined).USD).toBe(computePrices("standard").USD);
  });

  it("unbekannte Strategie wirft", () => {
    expect(() => computePrices("mega-premium" as never)).toThrow(/Unbekannte Preisstrategie/);
  });
});

describe("Preisstrategien: Overrides & KDP-Grenzen", () => {
  it("Overrides überschreiben Strategie-Preise", () => {
    const p = computePrices("standard", { USD: 5.49 });
    expect(p.USD).toBe(5.49);
    expect(p.EUR).toBe(4.99); // aus Strategie
  });

  it("Preise unter KDP-Minimum (0.99) werden auf 0.99 gehoben", () => {
    const p = computePrices("standard", { USD: 0.3 });
    expect(p.USD).toBe(0.99);
  });

  it("Preise über KDP-Maximum (200) werden auf 200 gedeckelt", () => {
    const p = computePrices("standard", { EUR: 300 });
    expect(p.EUR).toBe(200);
  });
});

describe("Preisstrategien: Konfiguration", () => {
  it("describePricingStrategy liefert beschreibenden Text", () => {
    const text = describePricingStrategy("launch");
    expect(text).toContain("Launch");
  });

  it("parsePricingConfig akzeptiert 'standard|launch|premium|series-loss-leader'", () => {
    expect(parsePricingConfig("premium")).toBe("premium");
    expect(parsePricingConfig(" series-loss-leader ")).toBe("series-loss-leader");
  });

  it("parsePricingConfig wirft bei unbekanntem String", () => {
    expect(() => parsePricingConfig("irgendwas")).toThrow(/Unbekannte Preisstrategie/);
  });
});
