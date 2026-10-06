/**
 * Tests: GlobalRoyaltyAggregator (WP 83.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  convertToEUR,
  calculateRoyalty,
  generateRoyaltyReport,
  formatRoyaltyReport,
  createSampleReport,
  PLATFORM_CONDITIONS,
  PLATFORM_LABELS,
  type Sale,
} from "./globalRoyaltyAggregator";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("convertToEUR", () => {
  it("rechnet USD in EUR um", () => {
    const eur = convertToEUR(100, "USD");
    expect(eur).toBeGreaterThan(0);
  });

  it("rechnet EUR in EUR um", () => {
    expect(convertToEUR(100, "EUR")).toBe(100);
  });
});

describe("calculateRoyalty", () => {
  it("berechnet Tantiemen", () => {
    const sale: Sale = { platform: "kdp", amount: 100, currency: "USD", date: "1970-01-01T00:00:00.000Z" };
    const line = calculateRoyalty(sale);
    expect(line.grossAmount).toBeGreaterThan(0);
    expect(line.netAmount).toBeGreaterThan(0);
  });

  it("verwendet richtigen Satz", () => {
    const sale: Sale = { platform: "direct", amount: 100, currency: "EUR", date: "1970-01-01T00:00:00.000Z" };
    const line = calculateRoyalty(sale);
    expect(line.royaltyRate).toBe(0.92);
  });
});

describe("generateRoyaltyReport", () => {
  it("erstellt Bericht", () => {
    const sales: Sale[] = [
      { platform: "kdp", amount: 100, currency: "USD", date: "1970-01-01T00:00:00.000Z" },
      { platform: "apple", amount: 50, currency: "EUR", date: "1970-01-01T00:00:00.000Z" },
    ];
    const report = generateRoyaltyReport(sales);
    expect(report.lines).toHaveLength(2);
    expect(report.totalGross).toBeGreaterThan(0);
    expect(report.totalNet).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const sales: Sale[] = [
      { platform: "kdp", amount: 100, currency: "USD", date: "1970-01-01T00:00:00.000Z" },
    ];
    const r1 = generateRoyaltyReport(sales);
    const r2 = generateRoyaltyReport(sales);
    expect(r1).toEqual(r2);
  });
});

describe("formatRoyaltyReport", () => {
  it("formatiert Bericht als Text", () => {
    const report = createSampleReport();
    const text = formatRoyaltyReport(report);
    expect(text).toContain("TANTIEMEN-ABRECHNUNG");
  });
});

describe("createSampleReport", () => {
  it("erstellt Beispiel-Bericht", () => {
    const report = createSampleReport();
    expect(report.lines.length).toBeGreaterThan(0);
  });
});

describe("PLATFORM_CONDITIONS", () => {
  it("hat alle Plattformen", () => {
    expect(Object.keys(PLATFORM_CONDITIONS)).toHaveLength(5);
  });
});

describe("PLATFORM_LABELS", () => {
  it("hat alle Labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
  });
});
