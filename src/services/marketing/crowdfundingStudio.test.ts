// crowdfundingStudio.test.ts — Tests für das Crowdfunding-Studio (WP 46.1).
// Deterministisch, keine Netzwerk-/LLM-Aufrufe.
import { describe, it, expect } from "vitest";
import {
  createCampaign,
  calculateCosts,
  calculateNetProfit,
  calculateGrossRevenue,
  calculateTotalBackers,
  exportCampaignMarkdown,
  exportCampaignHtml,
  PLATFORM_FEE_RATE,
  PAYMENT_PROCESSING_FEE_RATE,
  TOTAL_FEE_RATE,
  type CampaignConfig,
} from "./crowdfundingStudio";

// ---------------------------------------------------------------------------
// Test-Helpers
// ---------------------------------------------------------------------------

function sampleConfig(overrides: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    title: "Der Turm der Raben",
    goalAmount: 10000,
    currency: "EUR",
    tiers: [
      {
        id: "t1",
        name: "E-Book",
        price: 10,
        description: "Digitale Ausgabe",
        estimatedBackers: 100,
      },
      {
        id: "t2",
        name: "Hardcover",
        price: 30,
        description: "Gedruckte Ausgabe",
        estimatedBackers: 50,
      },
    ],
    stretchGoals: [
      {
        id: "s1",
        amount: 15000,
        title: "Landkarte",
        description: "Gedruckte Weltkarte",
      },
    ],
    printCostPerUnit: 5,
    packagingCostPerUnit: 2,
    shippingZones: [
      { id: "z1", name: "Deutschland", costPerUnit: 3 },
      { id: "z2", name: "EU", costPerUnit: 6 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createCampaign
// ---------------------------------------------------------------------------

describe("createCampaign", () => {
  it("erzeugt eine Kampagne mit allen Feldern", () => {
    const campaign = createCampaign(sampleConfig());
    expect(campaign.title).toBe("Der Turm der Raben");
    expect(campaign.goalAmount).toBe(10000);
    expect(campaign.currency).toBe("EUR");
    expect(campaign.tiers).toHaveLength(2);
    expect(campaign.stretchGoals).toHaveLength(1);
    expect(campaign.shippingZones).toHaveLength(2);
    expect(campaign.printCostPerUnit).toBe(5);
    expect(campaign.packagingCostPerUnit).toBe(2);
  });

  it("leitet eine deterministische ID ab (gleiche Eingabe → gleiche ID)", () => {
    const a = createCampaign(sampleConfig());
    const b = createCampaign(sampleConfig());
    expect(a.id).toBe(b.id);
    expect(a.id.startsWith("campaign-")).toBe(true);
  });

  it("vergibt für unterschiedliche Titel unterschiedliche IDs", () => {
    const a = createCampaign(sampleConfig());
    const b = createCampaign(sampleConfig({ title: "Ein anderer Titel" }));
    expect(a.id).not.toBe(b.id);
  });

  it("fällt bei null-Config defensiv auf Defaults zurück", () => {
    const campaign = createCampaign(null);
    expect(campaign.title).toBe("Ohne Titel");
    expect(campaign.currency).toBe("EUR");
    expect(campaign.goalAmount).toBe(0);
    expect(campaign.tiers).toEqual([]);
    expect(campaign.stretchGoals).toEqual([]);
    expect(campaign.shippingZones).toEqual([]);
  });

  it("normalisiert ungültige Zahlen und fehlende Tier-IDs", () => {
    const campaign = createCampaign(
      sampleConfig({
        goalAmount: -100,
        printCostPerUnit: Number.NaN,
        packagingCostPerUnit: Infinity as unknown as number,
        tiers: [
          {
            id: "",
            name: "",
            price: -5,
            description: "",
            estimatedBackers: -3,
          },
        ],
      }),
    );
    expect(campaign.goalAmount).toBe(0);
    expect(campaign.printCostPerUnit).toBe(0);
    expect(campaign.packagingCostPerUnit).toBe(0);
    expect(campaign.tiers[0].id).toBe("tier-1");
    expect(campaign.tiers[0].name).toBe("Stufe 1");
    expect(campaign.tiers[0].price).toBe(0);
    expect(campaign.tiers[0].estimatedBackers).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalBackers / calculateGrossRevenue
// ---------------------------------------------------------------------------

describe("calculateTotalBackers", () => {
  it("summiert die geschätzten Backer über alle Tiers", () => {
    expect(calculateTotalBackers(createCampaign(sampleConfig()))).toBe(150);
  });

  it("begrenzt Backer durch ein gesetztes Limit", () => {
    const campaign = createCampaign(
      sampleConfig({
        tiers: [
          {
            id: "t1",
            name: "Limitiert",
            price: 20,
            description: "Nur wenige Plätze",
            estimatedBackers: 100,
            limit: 40,
          },
        ],
      }),
    );
    expect(calculateTotalBackers(campaign)).toBe(40);
  });
});

describe("calculateGrossRevenue", () => {
  it("berechnet Preis × Backer über alle Tiers (10×100 + 30×50)", () => {
    expect(calculateGrossRevenue(createCampaign(sampleConfig()))).toBe(2500);
  });
});

// ---------------------------------------------------------------------------
// calculateCosts
// ---------------------------------------------------------------------------

describe("calculateCosts", () => {
  it("berechnet Druck- und Verpackungskosten aus Gesamt-Backern", () => {
    const costs = calculateCosts(createCampaign(sampleConfig()));
    // 150 Backer × 5 = 750 Druck, × 2 = 300 Verpackung
    expect(costs.printCosts).toBe(750);
    expect(costs.packagingCosts).toBe(300);
  });

  it("berechnet Versandkosten je Zone (Backer × costPerUnit)", () => {
    const costs = calculateCosts(createCampaign(sampleConfig()));
    // 150 × 3 = 450, 150 × 6 = 900
    expect(costs.shippingCosts).toEqual([
      { zone: "Deutschland", cost: 450 },
      { zone: "EU", cost: 900 },
    ]);
  });

  it("berechnet Plattform- und Zahlungsgebühren als 5 % bzw. 3 % der Einnahmen", () => {
    const costs = calculateCosts(createCampaign(sampleConfig()));
    // Einnahmen 2500 → 5 % = 125, 3 % = 75
    expect(costs.platformFees).toBe(125);
    expect(costs.paymentProcessingFees).toBe(75);
  });

  it("summiert alle Kosten korrekt (750+300+1350+125+75 = 2600)", () => {
    const costs = calculateCosts(createCampaign(sampleConfig()));
    expect(costs.totalCosts).toBe(2600);
  });

  it("liefert bei null-Kampagne eine Null-Aufschlüsselung", () => {
    const costs = calculateCosts(null);
    expect(costs.printCosts).toBe(0);
    expect(costs.packagingCosts).toBe(0);
    expect(costs.shippingCosts).toEqual([]);
    expect(costs.platformFees).toBe(0);
    expect(costs.paymentProcessingFees).toBe(0);
    expect(costs.totalCosts).toBe(0);
  });

  it("hält die Gebührensätze konsistent (5 % + 3 % = 8 %)", () => {
    expect(TOTAL_FEE_RATE).toBeCloseTo(PLATFORM_FEE_RATE + PAYMENT_PROCESSING_FEE_RATE, 10);
    expect(TOTAL_FEE_RATE).toBeCloseTo(0.08, 10);
  });
});

// ---------------------------------------------------------------------------
// calculateNetProfit
// ---------------------------------------------------------------------------

describe("calculateNetProfit", () => {
  it("berechnet Netto-Gewinn = Einnahmen − Gesamtkosten (2500 − 2600 = −100)", () => {
    expect(calculateNetProfit(createCampaign(sampleConfig()))).toBe(-100);
  });

  it("liefert positiven Gewinn bei günstiger Kalkulation", () => {
    const campaign = createCampaign(
      sampleConfig({
        tiers: [
          {
            id: "t1",
            name: "Premium",
            price: 100,
            description: "Alles inklusive",
            estimatedBackers: 100,
          },
        ],
        printCostPerUnit: 1,
        packagingCostPerUnit: 1,
        shippingZones: [{ id: "z1", name: "DE", costPerUnit: 1 }],
      }),
    );
    // Einnahmen 10000; Kosten: 100+100+100+500+300 = 1100 → 8900
    expect(calculateNetProfit(campaign)).toBe(8900);
  });

  it("liefert bei null-Kampagne 0", () => {
    expect(calculateNetProfit(null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// exportCampaignMarkdown
// ---------------------------------------------------------------------------

describe("exportCampaignMarkdown", () => {
  it("enthält Titel, Ziel, Stufen, Stretch-Goals und Netto-Gewinn", () => {
    const md = exportCampaignMarkdown(createCampaign(sampleConfig()));
    expect(md).toContain("# Der Turm der Raben");
    expect(md).toContain("**Finanzierungsziel:** EUR 10000.00");
    expect(md).toContain("E-Book");
    expect(md).toContain("Hardcover");
    expect(md).toContain("Landkarte");
    expect(md).toContain("Versand Deutschland: EUR 450.00");
    expect(md).toContain("Versand EU: EUR 900.00");
    expect(md).toContain("Plattformgebühren (5 %): EUR 125.00");
    expect(md).toContain("Zahlungsabwicklung (3 %): EUR 75.00");
    expect(md).toContain("## Netto-Gewinn: EUR -100.00");
  });

  it("ist deterministisch (zwei Aufrufe liefern identischen Text)", () => {
    const campaign = createCampaign(sampleConfig());
    expect(exportCampaignMarkdown(campaign)).toBe(exportCampaignMarkdown(campaign));
  });

  it("markiert leere Stufen/Goals defensiv", () => {
    const md = exportCampaignMarkdown(
      createCampaign(sampleConfig({ tiers: [], stretchGoals: [] })),
    );
    expect(md).toContain("_Keine Stufen definiert._");
    expect(md).toContain("_Keine Stretch-Goals definiert._");
  });

  it("liefert bei null-Kampagne einen gültigen Minimaltext", () => {
    const md = exportCampaignMarkdown(null);
    expect(md).toContain("# Ohne Titel");
    expect(md).toContain("**Finanzierungsziel:** EUR 0.00");
    expect(md).toContain("## Netto-Gewinn: EUR 0.00");
  });
});

// ---------------------------------------------------------------------------
// exportCampaignHtml
// ---------------------------------------------------------------------------

describe("exportCampaignHtml", () => {
  it("erzeugt ein vollständiges HTML-Dokument mit Kerninhalten", () => {
    const html = exportCampaignHtml(createCampaign(sampleConfig()));
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>Der Turm der Raben — Crowdfunding</title>");
    expect(html).toContain("<h1>Der Turm der Raben</h1>");
    expect(html).toContain("E-Book");
    expect(html).toContain("Landkarte");
    expect(html).toContain("Netto-Gewinn:");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("escaped HTML-Sonderzeichen im Titel", () => {
    const html = exportCampaignHtml(
      createCampaign(sampleConfig({ title: "<script>alert(1)</script>" })),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("ist deterministisch (zwei Aufrufe liefern identischen Text)", () => {
    const campaign = createCampaign(sampleConfig());
    expect(exportCampaignHtml(campaign)).toBe(exportCampaignHtml(campaign));
  });

  it("liefert bei null-Kampagne eine gültige Minimalseite", () => {
    const html = exportCampaignHtml(null);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("Ohne Titel");
    expect(html).toContain("Keine Stufen definiert.");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });
});
