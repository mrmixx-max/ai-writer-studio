// Tests: Royalty-Simulator (WP 19.2 — Verlagsvertrag & Royalty-Simulator).
//
// Deckt ab: Verlags-Vorschuss + Staffel-Tantiemen + Agenturprovision,
// KDP-Erlöse (70%/35%-Schwelle, Liefer- und Druckkosten) sowie den
// Break-Even-Schnittpunkt. Alles deterministisch, ohne LLM/Netzwerk.
import { describe, it, expect } from "vitest";
import {
  calculatePublisherAdvance,
  calculateKdpEarnings,
  calculateBreakEven,
  DEFAULT_ROYALTY_TIERS,
  DEFAULT_AGENT_RATE,
  type RoyaltyTier,
} from "./royaltyCalculator";

// --- Verlags-Vorschuss & Tantiemen ---------------------------------------------------

describe("calculatePublisherAdvance: Staffel-Tantiemen & Agentur", () => {
  it("Default-Staffel + 15% Agentur: Brutto/Provision/Netto korrekt", () => {
    const r = calculatePublisherAdvance(10_000, DEFAULT_ROYALTY_TIERS);
    expect(r.gross).toBe(10_000);
    expect(r.agentFee).toBe(1_500);
    expect(r.net).toBe(8_500);
    // Mischsatz = (0.07*5000 + 0.09*5000 + 0.12*90000) / 100000 = 0.116
    // 10000 * 0.116 * 0.85 = 986
    expect(r.perCopy).toBe(986);
  });

  it("benutzerdefinierte Agenturprovision (0.20) reduziert Netto und perCopy", () => {
    const r = calculatePublisherAdvance(10_000, DEFAULT_ROYALTY_TIERS, 0.2);
    expect(r.agentFee).toBe(2_000);
    expect(r.net).toBe(8_000);
    expect(r.perCopy).toBe(928); // 10000 * 0.116 * 0.80
  });

  it("Agenturprovision als Prozentzahl (20) entspricht 0.20", () => {
    const asPercent = calculatePublisherAdvance(10_000, DEFAULT_ROYALTY_TIERS, 20);
    const asFraction = calculatePublisherAdvance(10_000, DEFAULT_ROYALTY_TIERS, 0.2);
    expect(asPercent).toEqual(asFraction);
  });

  it("einzelne Stufe 10% über alle Kopien", () => {
    const tiers: RoyaltyTier[] = [
      { minCopies: 1, maxCopies: Infinity, rate: 0.1 },
    ];
    const r = calculatePublisherAdvance(10_000, tiers);
    expect(r.net).toBe(8_500);
    expect(r.perCopy).toBe(850); // 10000 * 0.10 * 0.85
  });

  it("leere Staffel fällt defensiv auf die Default-Staffel zurück", () => {
    const empty = calculatePublisherAdvance(10_000, []);
    const defaults = calculatePublisherAdvance(10_000, DEFAULT_ROYALTY_TIERS);
    expect(empty).toEqual(defaults);
  });

  it("Tantieme als Prozentzahl (7) wird wie 0.07 normalisiert", () => {
    const tiers: RoyaltyTier[] = [
      { minCopies: 1, maxCopies: Infinity, rate: 7 },
    ];
    const r = calculatePublisherAdvance(100, tiers);
    expect(r.gross).toBe(100);
    expect(r.agentFee).toBe(15);
    expect(r.net).toBe(85);
    expect(r.perCopy).toBe(5.95); // 100 * 0.07 * 0.85
  });

  it("negativer Vorschuss → alles 0, kein Wurf", () => {
    const r = calculatePublisherAdvance(-500, DEFAULT_ROYALTY_TIERS);
    expect(r).toEqual({ gross: 0, agentFee: 0, net: 0, perCopy: 0 });
  });

  it("NaN-Vorschuss und NaN-Agentur → 0 bzw. Default-Provision", () => {
    const r = calculatePublisherAdvance(Number.NaN, DEFAULT_ROYALTY_TIERS, Number.NaN);
    expect(r.gross).toBe(0);
    expect(r.net).toBe(0);
    expect(r.perCopy).toBe(0);
    expect(DEFAULT_AGENT_RATE).toBe(0.15);
  });

  it("keine Float-Rundungsfehler (33.33 → 5.00 / 28.33 / 1.98)", () => {
    const tiers: RoyaltyTier[] = [
      { minCopies: 1, maxCopies: Infinity, rate: 0.07 },
    ];
    const r = calculatePublisherAdvance(33.33, tiers);
    expect(r.gross).toBe(33.33);
    expect(r.agentFee).toBe(5); // 33.33*0.15 = 4.9995 → 5.00
    expect(r.net).toBe(28.33);
    expect(r.perCopy).toBe(1.98); // 33.33*0.07*0.85 = 1.983135 → 1.98
  });

  it("Agenturprovision 100% → Netto 0 und perCopy 0", () => {
    const tiers: RoyaltyTier[] = [
      { minCopies: 1, maxCopies: Infinity, rate: 0.07 },
    ];
    const r = calculatePublisherAdvance(100, tiers, 100);
    expect(r.agentFee).toBe(100);
    expect(r.net).toBe(0);
    expect(r.perCopy).toBe(0);
  });
});

// --- KDP-Erlöse ----------------------------------------------------------------------

describe("calculateKdpEarnings: Royalty-Schwelle, Liefer- & Druckkosten", () => {
  it("E-Book 4.99 USD, 2 MB → 70% Royalty abzüglich 0.30 Lieferkosten", () => {
    const r = calculateKdpEarnings(4.99, 2, 0, "ebook");
    expect(r.gross).toBe(4.99);
    expect(r.deliveryCost).toBe(0.3);
    expect(r.printCost).toBe(0);
    expect(r.net).toBe(3.19); // 4.99*0.7 - 0.30
    expect(r.perCopy).toBe(3.19);
  });

  it("E-Book an der unteren 70%-Grenze (2.99 USD)", () => {
    expect(calculateKdpEarnings(2.99, 0, 0, "ebook").net).toBe(2.09);
  });

  it("E-Book an der oberen 70%-Grenze (9.99 USD)", () => {
    expect(calculateKdpEarnings(9.99, 0, 0, "ebook").net).toBe(6.99);
  });

  it("E-Book knapp unter 2.99 → 35% Royalty", () => {
    expect(calculateKdpEarnings(2.98, 0, 0, "ebook").net).toBe(1.04);
  });

  it("E-Book über 9.99 → 35% Royalty", () => {
    expect(calculateKdpEarnings(10, 0, 0, "ebook").net).toBe(3.5);
  });

  it("Taschenbuch 12.99 USD / 200 Seiten → 35% minus Druckkosten", () => {
    const r = calculateKdpEarnings(12.99, 0, 200, "paperback");
    expect(r.printCost).toBe(3.85); // 200*0.015 + 0.85
    expect(r.deliveryCost).toBe(0);
    expect(r.net).toBe(0.7); // 12.99*0.35 - 3.85 = 0.6965 → 0.70
  });

  it("Taschenbuch in der 70%-Zone (9.99 USD / 100 Seiten)", () => {
    const r = calculateKdpEarnings(9.99, 0, 100, "paperback");
    expect(r.printCost).toBe(2.35); // 100*0.015 + 0.85
    expect(r.net).toBe(4.64); // 9.99*0.70 - 2.35
  });

  it("Hardcover 29.99 USD / 200 Seiten → 35% minus 0.02/Seite + 4.50", () => {
    const r = calculateKdpEarnings(29.99, 0, 200, "hardcover");
    expect(r.printCost).toBe(8.5); // 200*0.02 + 4.50
    expect(r.net).toBe(2); // 29.99*0.35 - 8.50
  });

  it("Hardcover mit zu niedrigem Preis → negativer Nettoerlös (Druckkosten > Tantieme)", () => {
    const r = calculateKdpEarnings(24.99, 0, 300, "hardcover");
    expect(r.printCost).toBe(10.5); // 300*0.02 + 4.50
    expect(r.net).toBe(-1.75); // 24.99*0.35 - 10.50
  });

  it("unbekanntes Format fällt defensiv auf E-Book zurück", () => {
    const r = calculateKdpEarnings(4.99, 1, 200, "audiobook" as never);
    expect(r.deliveryCost).toBe(0.15);
    expect(r.printCost).toBe(0);
    expect(r.net).toBe(3.34); // 4.99*0.70 - 0.15
  });

  it("fehlende/NaN-Eingaben → 0 statt NaN-Propagation", () => {
    const r = calculateKdpEarnings(Number.NaN, Number.NaN, Number.NaN, "ebook");
    expect(r).toEqual({ gross: 0, deliveryCost: 0, printCost: 0, net: 0, perCopy: 0 });
  });
});

// --- Break-Even ----------------------------------------------------------------------

describe("calculateBreakEven: Schnittpunkt Verlag vs. KDP", () => {
  it("Verlag pro Kopie stärker → kein Schnittpunkt (0), Empfehlung 'publisher'", () => {
    const publisher = calculatePublisherAdvance(10_000, DEFAULT_ROYALTY_TIERS);
    const kdp = calculateKdpEarnings(4.99, 0, 0, "ebook");
    const be = calculateBreakEven(publisher, kdp);
    expect(be.breakEvenCopies).toBe(0);
    expect(be.publisherNet).toBe(8_500);
    expect(be.kdpNet).toBe(0);
    expect(be.recommendation).toBe("publisher");
  });

  it("KDP pro Kopie stärker → positiver Schnittpunkt, Empfehlung 'kdp'", () => {
    const tiers: RoyaltyTier[] = [
      { minCopies: 1, maxCopies: Infinity, rate: 0.116 },
    ];
    const publisher = calculatePublisherAdvance(10, tiers, 0.15); // net 8.50, perCopy 0.99
    const kdp = calculateKdpEarnings(4.99, 0, 0, "ebook"); // perCopy 3.49
    const be = calculateBreakEven(publisher, kdp);
    // delta = 3.49 - 0.99 = 2.50 → ceil(8.50 / 2.50) = 4
    expect(be.breakEvenCopies).toBe(4);
    expect(be.publisherNet).toBe(12.46); // 8.50 + 0.99*4
    expect(be.kdpNet).toBe(13.96); // 3.49*4
    expect(be.recommendation).toBe("kdp");
  });

  it("kein Vorschuss (net 0) → kein Schnittpunkt, KDP marginal besser", () => {
    const publisher = calculatePublisherAdvance(0, DEFAULT_ROYALTY_TIERS);
    const kdp = calculateKdpEarnings(4.99, 0, 0, "ebook");
    const be = calculateBreakEven(publisher, kdp);
    expect(be.breakEvenCopies).toBe(0);
    expect(be.publisherNet).toBe(0);
    expect(be.kdpNet).toBe(0);
    expect(be.recommendation).toBe("kdp");
  });

  it("beide pro Kopie gleich & ohne Vorschuss → 'tie'", () => {
    const publisher = calculatePublisherAdvance(0, DEFAULT_ROYALTY_TIERS);
    const kdp = calculateKdpEarnings(0, 0, 0, "ebook");
    const be = calculateBreakEven(publisher, kdp);
    expect(be.breakEvenCopies).toBe(0);
    expect(be.recommendation).toBe("tie");
  });
});
