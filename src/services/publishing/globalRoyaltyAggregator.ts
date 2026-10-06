// GlobalRoyaltyAggregator (WP 83.2)
//
// Globaler Tantiemen- & Abrechnungs-Aggregator für Multi-Plattform-Verkäufe.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plattform. */
export type Platform = "kdp" | "apple" | "kobo" | "tolino" | "direct";

/** Plattform-Konditionen. */
export interface PlatformConditions {
  platform: Platform;
  royaltyRate: number; // 0-1
  label: string;
}

/** Plattform-Labels. */
export const PLATFORM_LABELS: Record<Platform, string> = {
  kdp: "KDP",
  apple: "Apple Books",
  kobo: "Kobo",
  tolino: "Tolino",
  direct: "Direktverkauf",
};

/** Plattform-Konditionen. */
export const PLATFORM_CONDITIONS: Record<Platform, PlatformConditions> = {
  kdp: { platform: "kdp", royaltyRate: 0.7, label: "KDP" },
  apple: { platform: "apple", royaltyRate: 0.7, label: "Apple Books" },
  kobo: { platform: "kobo", royaltyRate: 0.7, label: "Kobo" },
  tolino: { platform: "tolino", royaltyRate: 0.7, label: "Tolino" },
  direct: { platform: "direct", royaltyRate: 0.92, label: "Direktverkauf" },
};

/** Eine Verkaufstransaktion. */
export interface Sale {
  platform: Platform;
  amount: number;
  currency: "USD" | "EUR" | "GBP" | "JPY";
  date: string;
}

/** Eine Abrechnungs-Zeile. */
export interface RoyaltyLine {
  platform: Platform;
  grossAmount: number;
  royaltyRate: number;
  netAmount: number;
  currency: "EUR";
}

/** Ein Abrechnungsbericht. */
export interface RoyaltyReport {
  lines: RoyaltyLine[];
  totalGross: number;
  totalNet: number;
  currency: "EUR";
}

/** Währungskurse (vereinfacht). */
const EXCHANGE_RATES: Record<string, number> = {
  USD: 0.92,
  EUR: 1.0,
  GBP: 1.17,
  JPY: 0.0061,
};

/** Rechnet einen Betrag in EUR um. */
export function convertToEUR(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] ?? 1.0;
  return Math.round(amount * rate * 100) / 100;
}

/** Berechnet die Tantiemen für eine Transaktion. */
export function calculateRoyalty(sale: Sale): RoyaltyLine {
  const conditions = PLATFORM_CONDITIONS[sale.platform];
  const amountEUR = convertToEUR(sale.amount, sale.currency);
  const netAmount = Math.round(amountEUR * conditions.royaltyRate * 100) / 100;
  return {
    platform: sale.platform,
    grossAmount: amountEUR,
    royaltyRate: conditions.royaltyRate,
    netAmount,
    currency: "EUR",
  };
}

/** Erstellt einen Abrechnungsbericht. */
export function generateRoyaltyReport(sales: Sale[]): RoyaltyReport {
  const lines = sales.map((s) => calculateRoyalty(s));
  const totalGross = Math.round(lines.reduce((sum, l) => sum + l.grossAmount, 0) * 100) / 100;
  const totalNet = Math.round(lines.reduce((sum, l) => sum + l.netAmount, 0) * 100) / 100;
  return { lines, totalGross, totalNet, currency: "EUR" };
}

/** Formatiert einen Abrechnungsbericht als Text. */
export function formatRoyaltyReport(report: RoyaltyReport): string {
  const lines: string[] = [];
  lines.push(`=== TANTIEMEN-ABRECHNUNG ===`);
  lines.push(`Währung: ${report.currency}`);
  lines.push("");
  for (const line of report.lines) {
    lines.push(`  ${PLATFORM_LABELS[line.platform]}: ${line.grossAmount} EUR → ${line.netAmount} EUR (${Math.round(line.royaltyRate * 100)}%)`);
  }
  lines.push("");
  lines.push(`Brutto: ${report.totalGross} EUR`);
  lines.push(`Netto: ${report.totalNet} EUR`);
  return lines.join("\n");
}

/** Erstellt einen Beispiel-Bericht. */
export function createSampleReport(): RoyaltyReport {
  const sales: Sale[] = [
    { platform: "kdp", amount: 100, currency: "USD", date: "1970-01-01T00:00:00.000Z" },
    { platform: "apple", amount: 50, currency: "EUR", date: "1970-01-01T00:00:00.000Z" },
    { platform: "direct", amount: 200, currency: "EUR", date: "1970-01-01T00:00:00.000Z" },
  ];
  return generateRoyaltyReport(sales);
}
