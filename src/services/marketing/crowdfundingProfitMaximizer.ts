// CrowdfundingProfitMaximizer (Meilenstein 61.0 / v7.3.0)
//
// Crowdfunding-Gewinn- & Tier-Maximierer (Kickstarter / Startnext):
// Reingewinn-Kalkulator nach Druck, Fracht, Porto, Verpackung und
// Plattform-Gebühren, Tier-Architektur und Stretch-Goal-ROI-Prüfer.
// Deterministisch (FNV-1a + mulberry32). Keine Node-Module.

/** FNV-1a-Hash einer Zeichenkette (32 Bit). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministischer Zufallsgenerator (mulberry32). */
export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rundet auf zwei Nachkommastellen. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Formatiert einen Betrag in Euro. */
export function formatEuro(value: number): string {
  return `${value.toFixed(2)} €`;
}

// ---------------------------------------------------------------------------
// WP 127.1.1 — Reingewinn-Kalkulator
// ---------------------------------------------------------------------------

/** Eingangsgrößen einer Crowdfunding-Kalkulation. */
export interface ProfitInput {
  /** Anzahl der verkauften Einheiten. */
  units: number;
  /** Verkaufspreis pro Einheit in Euro. */
  pricePerUnit: number;
  /** Druckkosten pro Einheit (Farbschnitt, Prägung, Leseband) in Euro. */
  printCostPerUnit: number;
  /** Gesamtkosten einer Frachtpalette in Euro. */
  freightPalletCost: number;
  /** Einzelporto pro Einheit in Euro. */
  shippingPerUnit: number;
  /** Verpackung pro Einheit in Euro. */
  packagingPerUnit: number;
  /** Plattform-Gebühr in Prozent (Kickstarter: 5). */
  platformFeePercent: number;
  /** Zahlungsdienstleister-Gebühr in Prozent (Stripe: 3). */
  paymentFeePercent: number;
}

/** Ergebnis einer Crowdfunding-Kalkulation. */
export interface ProfitResult {
  grossRevenue: number;
  platformFees: number;
  paymentFees: number;
  printCosts: number;
  freightCosts: number;
  shippingCosts: number;
  packagingCosts: number;
  totalCosts: number;
  netProfit: number;
  marginPercent: number;
  breakEvenUnits: number;
  description: string;
}

/**
 * Berechnet den Reingewinn einer Crowdfunding-Kampagne.
 * Alle Beträge in Euro, Ergebnis auf zwei Nachkommastellen gerundet.
 */
export function calculateNetProfit(input: ProfitInput): ProfitResult {
  const units = Math.max(0, Math.floor(input.units));
  const price = Math.max(0, input.pricePerUnit);

  const grossRevenue = round2(units * price);

  const platformFees = round2(grossRevenue * (input.platformFeePercent / 100));
  const paymentFees = round2(grossRevenue * (input.paymentFeePercent / 100));

  const printCosts = round2(units * Math.max(0, input.printCostPerUnit));
  const freightCosts = round2(units > 0 ? Math.max(0, input.freightPalletCost) : 0);
  const shippingCosts = round2(units * Math.max(0, input.shippingPerUnit));
  const packagingCosts = round2(units * Math.max(0, input.packagingPerUnit));

  const totalCosts = round2(
    platformFees + paymentFees + printCosts + freightCosts + shippingCosts + packagingCosts,
  );

  const netProfit = round2(grossRevenue - totalCosts);
  const marginPercent = grossRevenue > 0 ? round2((netProfit / grossRevenue) * 100) : 0;

  // Break-even: ab wie vielen Einheiten deckt der Erlös die Kosten?
  const variableCostPerUnit =
    Math.max(0, input.printCostPerUnit) +
    Math.max(0, input.shippingPerUnit) +
    Math.max(0, input.packagingPerUnit) +
    price * ((input.platformFeePercent + input.paymentFeePercent) / 100);
  const fixedCosts = Math.max(0, input.freightPalletCost);
  const contributionPerUnit = price - variableCostPerUnit;
  const breakEvenUnits =
    contributionPerUnit > 0 ? Math.max(0, Math.ceil(fixedCosts / contributionPerUnit)) : 0;

  const description =
    `Bei ${units} Einheiten à ${formatEuro(price)} beträgt der Bruttoumsatz ` +
    `${formatEuro(grossRevenue)}. Nach Abzug aller Kosten (${formatEuro(totalCosts)}) ` +
    `bleiben ${formatEuro(netProfit)} Reingewinn (Marge ${marginPercent.toFixed(1)} %). ` +
    `Break-even liegt bei ${breakEvenUnits} Einheiten.`;

  return {
    grossRevenue,
    platformFees,
    paymentFees,
    printCosts,
    freightCosts,
    shippingCosts,
    packagingCosts,
    totalCosts,
    netProfit,
    marginPercent,
    breakEvenUnits,
    description,
  };
}

// ---------------------------------------------------------------------------
// WP 127.1.2 — Tier-Architektur
// ---------------------------------------------------------------------------

/** Eine Belohnungsstufe des Crowdfundings. */
export interface TierTemplate {
  id: string;
  name: string;
  price: number;
  contents: string[];
  costPerUnit: number;
}

/** Die drei Standard-Belohnungsstufen. */
export const TIER_TEMPLATES: TierTemplate[] = [
  {
    id: "hardcover",
    name: "Signiertes Hardcover",
    price: 25,
    contents: ["Gebundenes Hardcover", "E-Book in allen Formaten", "Digitaler Farbschnitt"],
    costPerUnit: 8.5,
  },
  {
    id: "signedBox",
    name: "Signierte Sammlerbox",
    price: 85,
    contents: [
      "Signiertes Hardcover",
      "Hörbuch-Download",
      "Digitales Artbook",
      "Notizbuch mit Leseband",
    ],
    costPerUnit: 32,
  },
  {
    id: "vipPatron",
    name: "VIP-Patron-Tier",
    price: 500,
    contents: [
      "Alle vorherigen Stufen",
      "Nennung einer Figur nach dem Spender",
      "Persönliche Widmung im Buch",
      "Exklusiver Zoom-Abend mit der Autorin/dem Autor",
    ],
    costPerUnit: 120,
  },
];

/** Verteilung eines einzelnen Tiers innerhalb der Kampagne. */
export interface TierAllocation {
  tierId: string;
  backers: number;
  revenue: number;
  profit: number;
}

/** Ergebnis der Tier-Optimierung. */
export interface TierOptimization {
  tiers: TierAllocation[];
  totalRevenue: number;
  totalProfit: number;
  bestTierId: string;
}

/**
 * Verteilt eine gegebene Anzahl Unterstützer deterministisch auf die
 * Tier-Vorlagen und berechnet Umsatz und Gewinn je Stufe.
 */
export function optimizeTiers(units: number, seed: number): TierOptimization {
  const total = Math.max(0, Math.floor(units));
  const rng = createSeededRandom(hashString(`tiers|${seed}|${total}`));

  // Realistische Verteilung: viele Hardcover, wenige VIP-Patrone.
  const weights = [0.62, 0.30, 0.08];
  const tiers: TierAllocation[] = [];

  let assigned = 0;
  for (let i = 0; i < TIER_TEMPLATES.length; i++) {
    const tpl = TIER_TEMPLATES[i];
    const isLast = i === TIER_TEMPLATES.length - 1;
    // Leichte deterministische Streuung der Gewichte.
    const jitter = (rng() - 0.5) * 0.06;
    const share = isLast ? total - assigned : Math.round(total * (weights[i] + jitter));
    const backers = Math.max(0, isLast ? Math.max(0, share) : share);
    assigned += backers;

    const revenue = round2(backers * tpl.price);
    const profit = round2(backers * (tpl.price - tpl.costPerUnit));
    tiers.push({ tierId: tpl.id, backers, revenue, profit });
  }

  const totalRevenue = round2(tiers.reduce((n, t) => n + t.revenue, 0));
  const totalProfit = round2(tiers.reduce((n, t) => n + t.profit, 0));

  let best = tiers[0];
  for (const t of tiers) {
    if (t.profit > best.profit) best = t;
  }

  return {
    tiers,
    totalRevenue,
    totalProfit,
    bestTierId: best ? best.tierId : TIER_TEMPLATES[0].id,
  };
}

// ---------------------------------------------------------------------------
// WP 127.1.3 — Stretch-Goal-ROI-Prüfer
// ---------------------------------------------------------------------------

/** Ein geplantes Stretch-Goal. */
export interface StretchGoal {
  name: string;
  additionalCost: number;
  expectedExtraBackers: number;
  tierPrice: number;
}

/** Ergebnis der Stretch-Goal-Prüfung. */
export interface StretchGoalResult {
  profitable: boolean;
  profitBefore: number;
  profitAfter: number;
  roiPercent: number;
  recommendation: string;
  description: string;
}

/**
 * Prüft, ob ein Stretch-Goal (z. B. Goldfolien-Veredelung) den Reingewinn
 * steigert oder die Marge auffrisst.
 */
export function checkStretchGoal(
  goal: StretchGoal,
  currentProfit: number,
  seed: number,
): StretchGoalResult {
  const rng = createSeededRandom(hashString(`stretch|${goal.name}|${seed}`));

  const profitBefore = round2(currentProfit);

  // Zusätzliche Unterstützer bringen Umsatz, aber auch Stückkosten.
  const conversion = 0.55 + rng() * 0.3; // 55–85 % der erwarteten Unterstützer zahlen wirklich
  const payingBackers = Math.max(0, Math.round(goal.expectedExtraBackers * conversion));
  const extraRevenue = payingBackers * Math.max(0, goal.tierPrice);
  const extraUnitCost = payingBackers * Math.max(0, goal.tierPrice) * 0.35; // ~35 % Stückkosten
  const extraProfit = extraRevenue - extraUnitCost - Math.max(0, goal.additionalCost);

  const profitAfter = round2(profitBefore + extraProfit);
  const roiPercent =
    goal.additionalCost > 0 ? round2((extraProfit / goal.additionalCost) * 100) : 0;

  const profitable = profitAfter > profitBefore;

  let recommendation: string;
  if (profitable && roiPercent >= 50) {
    recommendation = `Stretch-Goal „${goal.name}" lohnt sich klar (ROI ${roiPercent.toFixed(0)} %).`;
  } else if (profitable) {
    recommendation = `Stretch-Goal „${goal.name}" ist knapp profitabel — Marge im Blick behalten.`;
  } else {
    recommendation = `Stretch-Goal „${goal.name}" frisst die Marge auf — verschieben oder günstiger kalkulieren.`;
  }

  const description =
    `${payingBackers} zusätzliche Unterstützer bringen ${formatEuro(round2(extraRevenue))} Umsatz. ` +
    `Nach Stückkosten und ${formatEuro(Math.max(0, goal.additionalCost))} Zusatzkosten ` +
    `verändert sich der Gewinn von ${formatEuro(profitBefore)} auf ${formatEuro(profitAfter)}.`;

  return {
    profitable,
    profitBefore,
    profitAfter,
    roiPercent,
    recommendation,
    description,
  };
}

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

/** Liefert eine frische Kopie der Standard-Tier-Vorlagen. */
export function createSampleCampaign(): TierTemplate[] {
  return TIER_TEMPLATES.map((t) => ({ ...t, contents: [...t.contents] }));
}

/** Baut ein typisches Stretch-Goal (Goldfolien-Veredelung). */
export function createSampleStretchGoal(): StretchGoal {
  return {
    name: "Goldfolien-Veredelung",
    additionalCost: 1800,
    expectedExtraBackers: 140,
    tierPrice: 25,
  };
}
