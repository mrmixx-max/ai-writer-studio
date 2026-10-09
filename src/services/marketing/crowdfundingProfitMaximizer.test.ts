// @vitest-environment jsdom
// CrowdfundingProfitMaximizer Tests (Meilenstein 61.0 / v7.3.0)
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  formatEuro,
  calculateNetProfit,
  TIER_TEMPLATES,
  optimizeTiers,
  checkStretchGoal,
  createSampleCampaign,
  createSampleStretchGoal,
} from "./crowdfundingProfitMaximizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("crowd")).toBe(hashString("crowd"));
  });

  it("unterscheidet verschiedene Strings", () => {
    expect(hashString("kickstarter")).not.toBe(hashString("startnext"));
  });

  it("gibt eine vorzeichenlose 32-Bit-Zahl zurück", () => {
    const h = hashString("Tier");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch", () => {
    const a = createSeededRandom(17);
    const b = createSeededRandom(17);
    expect(a()).toBe(b());
  });

  it("liefert Werte in [0,1)", () => {
    const rng = createSeededRandom(41);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("formatEuro", () => {
  it("formatiert Beträge mit zwei Nachkommastellen", () => {
    expect(formatEuro(85)).toBe("85.00 €");
    expect(formatEuro(1.5)).toBe("1.50 €");
  });
});

describe("calculateNetProfit", () => {
  const input = {
    units: 500,
    pricePerUnit: 25,
    printCostPerUnit: 8.5,
    freightPalletCost: 1200,
    shippingPerUnit: 3.2,
    packagingPerUnit: 0.9,
    platformFeePercent: 5,
    paymentFeePercent: 3,
  };

  it("berechnet Bruttoumsatz und alle Kostenposten", () => {
    const r = calculateNetProfit(input);
    expect(r.grossRevenue).toBe(12500);
    expect(r.platformFees).toBeCloseTo(625, 1);
    expect(r.paymentFees).toBeCloseTo(375, 1);
    expect(r.printCosts).toBeCloseTo(4250, 1);
    expect(r.freightCosts).toBe(1200);
    expect(r.shippingCosts).toBeCloseTo(1600, 1);
    expect(r.packagingCosts).toBeCloseTo(450, 1);
    expect(r.totalCosts).toBeGreaterThan(0);
    expect(r.netProfit).toBeLessThan(r.grossRevenue);
  });

  it("berechnet die Marge als Prozentwert", () => {
    const r = calculateNetProfit(input);
    expect(r.marginPercent).toBeGreaterThan(0);
    expect(r.marginPercent).toBeLessThan(100);
  });

  it("liefert eine Break-even-Stückzahl", () => {
    const r = calculateNetProfit(input);
    expect(r.breakEvenUnits).toBeGreaterThanOrEqual(0);
  });

  it("erzeugt eine nicht-leere Beschreibung", () => {
    const r = calculateNetProfit(input);
    expect(r.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(calculateNetProfit(input).netProfit).toBe(calculateNetProfit(input).netProfit);
  });

  it("behandelt 0 Einheiten ohne Absturz", () => {
    const r = calculateNetProfit({ ...input, units: 0 });
    expect(r.grossRevenue).toBe(0);
    expect(Number.isFinite(r.netProfit)).toBe(true);
  });

  it("deckt Kostenverursachung ab (Gewinn sinkt bei höheren Druckkosten)", () => {
    const cheap = calculateNetProfit(input);
    const expensive = calculateNetProfit({ ...input, printCostPerUnit: 15 });
    expect(expensive.netProfit).toBeLessThan(cheap.netProfit);
  });
});

describe("TIER_TEMPLATES", () => {
  it("enthält mindestens drei Stufen", () => {
    expect(TIER_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it("enthält die erwarteten IDs", () => {
    const ids = TIER_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("hardcover");
    expect(ids).toContain("signedBox");
    expect(ids).toContain("vipPatron");
  });

  it("bildet die Preisstaffelung 25 / 85 / 500 ab", () => {
    const byId = Object.fromEntries(TIER_TEMPLATES.map((t) => [t.id, t]));
    expect(byId.hardcover.price).toBe(25);
    expect(byId.signedBox.price).toBe(85);
    expect(byId.vipPatron.price).toBe(500);
  });

  it("hat gültige Felder und Kosten unter dem Preis", () => {
    for (const t of TIER_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(Array.isArray(t.contents)).toBe(true);
      expect(t.contents.length).toBeGreaterThan(0);
      expect(t.costPerUnit).toBeGreaterThan(0);
      expect(t.costPerUnit).toBeLessThan(t.price);
    }
  });
});

describe("optimizeTiers", () => {
  it("verteilt Unterstützer auf alle Stufen", () => {
    const r = optimizeTiers(400, 42);
    expect(r.tiers).toHaveLength(TIER_TEMPLATES.length);
    for (const t of r.tiers) {
      expect(t.backers).toBeGreaterThanOrEqual(0);
      expect(t.revenue).toBeGreaterThanOrEqual(0);
      expect(t.profit).toBeGreaterThanOrEqual(0);
    }
  });

  it("summiert Umsatz und Gewinn über alle Stufen", () => {
    const r = optimizeTiers(400, 42);
    const revSum = r.tiers.reduce((n, t) => n + t.revenue, 0);
    expect(r.totalRevenue).toBeCloseTo(revSum, 1);
    expect(r.totalProfit).toBeLessThan(r.totalRevenue);
  });

  it("benennt die beste Stufe", () => {
    const r = optimizeTiers(400, 42);
    expect(TIER_TEMPLATES.map((t) => t.id)).toContain(r.bestTierId);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = optimizeTiers(250, 3);
    const b = optimizeTiers(250, 3);
    expect(a.tiers.map((t) => t.backers)).toEqual(b.tiers.map((t) => t.backers));
    expect(a.bestTierId).toBe(b.bestTierId);
  });
});

describe("checkStretchGoal", () => {
  const goal = createSampleStretchGoal();

  it("liefert eine vollständige ROI-Prüfung", () => {
    const r = checkStretchGoal(goal, 8000, 42);
    expect(typeof r.profitable).toBe("boolean");
    expect(r.profitBefore).toBe(8000);
    expect(typeof r.profitAfter).toBe("number");
    expect(typeof r.roiPercent).toBe("number");
    expect(r.recommendation.length).toBeGreaterThan(0);
    expect(r.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = checkStretchGoal(goal, 8000, 5);
    const b = checkStretchGoal(goal, 8000, 5);
    expect(a.profitAfter).toBe(b.profitAfter);
    expect(a.profitable).toBe(b.profitable);
  });

  it("erkennt ein unrentables Stretch-Goal", () => {
    const bad = { name: "Teure Veredelung", additionalCost: 50000, expectedExtraBackers: 2, tierPrice: 25 };
    const r = checkStretchGoal(bad, 8000, 1);
    expect(r.profitable).toBe(false);
    expect(r.profitAfter).toBeLessThan(r.profitBefore);
  });
});

describe("createSampleCampaign", () => {
  it("liefert eine Kopie der Tier-Vorlagen", () => {
    const c = createSampleCampaign();
    expect(c).toHaveLength(TIER_TEMPLATES.length);
    c[0].name = "verändert";
    expect(TIER_TEMPLATES[0].name).not.toBe("verändert");
  });
});

describe("createSampleStretchGoal", () => {
  it("liefert ein gültiges Stretch-Goal", () => {
    const g = createSampleStretchGoal();
    expect(g.name.length).toBeGreaterThan(0);
    expect(g.additionalCost).toBeGreaterThan(0);
    expect(g.expectedExtraBackers).toBeGreaterThan(0);
    expect(g.tierPrice).toBeGreaterThan(0);
  });
});
