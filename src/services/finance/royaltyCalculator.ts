// Royalty-Simulator (WP 19.2 — Verlagsvertrag & Royalty-Simulator).
//
// Vergleicht zwei Vermarktungswege deterministisch und offline:
//   1) Verlagsvertrag mit Vorschuss + gestaffelten Tantiemen + Agenturprovision
//   2) Amazon KDP Self-Publishing (70% / 35% Royalty, Liefer- und Druckkosten)
//   3) Break-Even-Schnittpunkt beider Modelle
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, kein API-Budget.
// - Defensive Fallbacks: fehlende/ungültige Werte (NaN, undefined, negativ)
//   werden auf 0 bzw. auf die Defaults abgebildet statt zu werfen.
// - Float-Rundungsfehler werden an jeder öffentlichen Grenze über Math.round
//   auf 2 Dezimalstellen eliminiert (kein 0.30000000000000004 in Ergebnissen).
//
// Modell (dokumentiert, damit die Ergebnisse reproduzierbar/nachvollziehbar sind):
// - `advance` ist der Verlags-Vorschuss bzw. die Tantiemebasis. `gross` ist der
//   Bruttovorschuss, `agentFee` die Provision der Literaturagentur, `net` der
//   Netto-Vorschuss an die Autor:in.
// - `perCopy` ist die effektive Tantieme pro verkaufter Kopie: der (nach
//   Bandbreite gewichtete) Mischsatz der Staffel, angewandt auf die Basis und
//   um die Agenturprovision reduziert. So bleibt der Wert mit KDPs `perCopy`
//   vergleichbar.
// - Der Break-Even setzt den festen Vorschuss (`net`) gegen den marginalen
//   Vorteil von KDP pro Kopie (`kdp.perCopy - publisher.perCopy`).

// --- Types ---------------------------------------------------------------------------

/** Eine Tantiemestufe des Verlagsvertrags. `maxCopies` ist inklusiv; Infinity erlaubt. */
export interface RoyaltyTier {
  minCopies: number;
  maxCopies: number;
  /** Als Bruch (0.07 = 7%) ODER Prozent (7 = 7%) — wird normalisiert. */
  rate: number;
}

/** Ergebnis des Verlagsmodells. Alle Werte in USD, auf 2 Dezimalen gerundet. */
export interface RoyaltyResult {
  /** Bruttovorschuss. */
  gross: number;
  /** Agenturprovision (Default 15%). */
  agentFee: number;
  /** Netto-Vorschuss an die Autor:in. */
  net: number;
  /** Effektive Tantieme pro Kopie. */
  perCopy: number;
}

export type KdpFormat = "ebook" | "paperback" | "hardcover";

/** Ergebnis des KDP-Modells. Alle Werte in USD, auf 2 Dezimalen gerundet. */
export interface KdpResult {
  /** Listenpreis pro Kopie (brutto). */
  gross: number;
  /** Lieferkosten (nur E-Book, 0.15 USD/MB). */
  deliveryCost: number;
  /** Druckkosten (nur Print, seitenabhängig). */
  printCost: number;
  /** Netto-Erlös pro Kopie nach Royalty, Liefer- und Druckkosten. */
  net: number;
  /** Netto-Erlös pro Kopie (identisch zu `net`, explizit für Vergleiche). */
  perCopy: number;
}

export type BreakEvenRecommendation = "publisher" | "kdp" | "tie";

/** Ergebnis des Break-Even-Vergleichs. */
export interface BreakEvenResult {
  /** Anzahl Kopien, ab der KDP den Verlagsvorschuss eingeholt hat (0 = nie). */
  breakEvenCopies: number;
  /** Kumulierter Nettoerlös des Verlagsmodells am Schnittpunkt. */
  publisherNet: number;
  /** Kumulierter Nettoerlös des KDP-Modells am Schnittpunkt. */
  kdpNet: number;
  /** Empfehlung auf Basis der marginalen Tantieme pro Kopie. */
  recommendation: BreakEvenRecommendation;
}

// --- Konstanten ----------------------------------------------------------------------

export const DEFAULT_AGENT_RATE = 0.15;

/** Tantiemen-Staffelung: 7% bis 5.000 Ex., 9% bis 10.000 Ex., 12% ab 10.001 Ex. */
export const DEFAULT_ROYALTY_TIERS: RoyaltyTier[] = [
  { minCopies: 1, maxCopies: 5_000, rate: 0.07 },
  { minCopies: 5_001, maxCopies: 10_000, rate: 0.09 },
  { minCopies: 10_001, maxCopies: Infinity, rate: 0.12 },
];

export const KDP_ROYALTY_HIGH = 0.7;
export const KDP_ROYALTY_LOW = 0.35;
/** 70%-Zone: 2.99–9.99 USD, sonst 35%. */
export const KDP_70_MIN_PRICE = 2.99;
export const KDP_70_MAX_PRICE = 9.99;
/** KDP E-Book-Lieferkosten: 0.15 USD pro MB. */
export const KDP_EBOOK_DELIVERY_PER_MB = 0.15;
/** Taschenbuch: 0.015 USD/Seite + 0.85 USD Fixkosten. */
export const PAPERBACK_PER_PAGE = 0.015;
export const PAPERBACK_FIXED = 0.85;
/** Hardcover: 0.02 USD/Seite + 4.50 USD Fixkosten. */
export const HARDCOVER_PER_PAGE = 0.02;
export const HARDCOVER_FIXED = 4.5;
/** Referenzhorizont, um offene Staffelstufen (maxCopies = Infinity) zu gewichten. */
export const ROYALTY_HORIZON_COPIES = 100_000;

// --- Interne Helfer ------------------------------------------------------------------

/** Deterministische Rundung auf 2 Dezimalen; NaN/Infinity → 0. */
function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Robuste Zahlen-Konvertierung: nicht-finite Werte → Fallback. */
function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Negative Beträge (z. B. Kopien) → 0. */
function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}

/** 0.07 bleibt 0.07; 7 wird zu 0.07; negativ → 0. */
function normalizeRate(rate: number): number {
  const r = clampNonNegative(safeNumber(rate, 0));
  return r > 1 ? r / 100 : r;
}

/** Provision normalisieren und auf [0, 1] klemmen. */
function normalizeAgentRate(rate: number): number {
  const r = safeNumber(rate, DEFAULT_AGENT_RATE);
  const asFraction = r > 1 ? r / 100 : r;
  return Math.min(1, clampNonNegative(asFraction));
}

/** Fehlende/leere Staffel → Default-Staffel; Einträge normalisieren & sortieren. */
function normalizeTiers(tiers?: RoyaltyTier[]): RoyaltyTier[] {
  const src = Array.isArray(tiers) && tiers.length > 0 ? tiers : DEFAULT_ROYALTY_TIERS;
  const cleaned = src
    .map((t) => ({
      minCopies: clampNonNegative(safeNumber(t?.minCopies, 0)),
      maxCopies:
        t?.maxCopies === Infinity
          ? Infinity
          : clampNonNegative(safeNumber(t?.maxCopies, 0)),
      rate: normalizeRate(safeNumber(t?.rate, 0)),
    }))
    .filter((t) => t.rate > 0)
    .sort((a, b) => a.minCopies - b.minCopies);
  return cleaned.length > 0 ? cleaned : DEFAULT_ROYALTY_TIERS;
}

/** Bandbreite einer Stufe (inklusive); offene Stufen nutzen den Referenzhorizont. */
function tierWidth(t: RoyaltyTier): number {
  const max = Number.isFinite(t.maxCopies) ? t.maxCopies : ROYALTY_HORIZON_COPIES;
  const width = max - t.minCopies + 1;
  return width > 0 ? width : 1;
}

/** Nach Bandbreite gewichteter Mischsatz der Tantiemestaffel. */
function blendedRoyaltyRate(tiers: RoyaltyTier[]): number {
  let weighted = 0;
  let total = 0;
  for (const t of tiers) {
    const w = tierWidth(t);
    weighted += t.rate * w;
    total += w;
  }
  return total > 0 ? weighted / total : 0;
}

// --- API -----------------------------------------------------------------------------

/**
 * Berechnet Vorschuss, Agenturprovision und effektive Tantieme pro Kopie
 * aus dem Verlagsvertrag.
 *
 * @param advance       Vorschuss/Tantiemebasis (negativ/NaN → 0).
 * @param royaltyRates  Gestaffelte Tantiemen; leer/undefined → Default-Staffel.
 * @param agentRate     Agenturprovision als Bruch oder Prozent (Default 15%).
 */
export function calculatePublisherAdvance(
  advance: number,
  royaltyRates: RoyaltyTier[],
  agentRate: number = DEFAULT_AGENT_RATE,
): RoyaltyResult {
  const tiers = normalizeTiers(royaltyRates);
  const base = clampNonNegative(safeNumber(advance, 0));
  const agent = normalizeAgentRate(agentRate);

  const gross = round2(base);
  const agentFee = round2(gross * agent);
  const net = round2(gross - agentFee);
  const blended = blendedRoyaltyRate(tiers);
  const perCopy = round2(base * blended * (1 - agent));

  return { gross, agentFee, net, perCopy };
}

/**
 * Berechnet die KDP-Erlöse pro Kopie.
 *
 * - 70% Royalty für Preise 2.99–9.99 USD, sonst 35%.
 * - E-Book: Lieferkosten 0.15 USD/MB (keine Druckkosten).
 * - Taschenbuch: 0.015 USD/Seite + 0.85 USD.
 * - Hardcover: 0.02 USD/Seite + 4.50 USD.
 *
 * @param price           Listenpreis pro Kopie (negativ/NaN → 0).
 * @param deliveryCostMB  Dateigröße in MB (nur E-Book relevant).
 * @param pageCount       Seitenzahl (nur Print relevant).
 * @param format          "ebook" | "paperback" | "hardcover"; unbekannt → E-Book.
 */
export function calculateKdpEarnings(
  price: number,
  deliveryCostMB: number,
  pageCount: number,
  format: KdpFormat,
): KdpResult {
  const p = clampNonNegative(safeNumber(price, 0));
  const mb = clampNonNegative(safeNumber(deliveryCostMB, 0));
  const pages = clampNonNegative(safeNumber(pageCount, 0));
  const fmt: KdpFormat =
    format === "paperback" || format === "hardcover" ? format : "ebook";

  const inHighZone = p >= KDP_70_MIN_PRICE && p <= KDP_70_MAX_PRICE;
  const rate = inHighZone ? KDP_ROYALTY_HIGH : KDP_ROYALTY_LOW;

  const gross = round2(p);
  let deliveryCost = 0;
  let printCost = 0;

  if (fmt === "ebook") {
    deliveryCost = round2(mb * KDP_EBOOK_DELIVERY_PER_MB);
  } else if (fmt === "paperback") {
    printCost = round2(pages * PAPERBACK_PER_PAGE + PAPERBACK_FIXED);
  } else {
    printCost = round2(pages * HARDCOVER_PER_PAGE + HARDCOVER_FIXED);
  }

  const net = round2(gross * rate - deliveryCost - printCost);
  return { gross, deliveryCost, printCost, net, perCopy: net };
}

/**
 * Ermittelt den Schnittpunkt zwischen Verlagsmodell (fester Vorschuss + kleine
 * Tantieme pro Kopie) und KDP (kein Vorschuss, höhere Tantieme pro Kopie):
 *
 *   publisher.net + publisher.perCopy * n  ==  kdp.perCopy * n
 *   => n = publisher.net / (kdp.perCopy - publisher.perCopy)
 *
 * Ist KDP pro Kopie nicht besser (delta <= 0) oder gibt es keinen Vorschuss,
 * liegt kein sinnvoller Schnittpunkt vor → breakEvenCopies = 0.
 */
export function calculateBreakEven(
  publisher: RoyaltyResult,
  kdp: KdpResult,
): BreakEvenResult {
  const pubNet = safeNumber(publisher?.net, 0);
  const pubPer = safeNumber(publisher?.perCopy, 0);
  const kdpPer = safeNumber(kdp?.perCopy, 0);

  const delta = kdpPer - pubPer;
  let breakEvenCopies = 0;

  if (pubNet > 0 && delta > 0) {
    const raw = pubNet / delta;
    breakEvenCopies = Number.isFinite(raw) ? Math.ceil(raw) : 0;
  }

  const publisherNet = round2(pubNet + pubPer * breakEvenCopies);
  const kdpNet = round2(kdpPer * breakEvenCopies);

  let recommendation: BreakEvenRecommendation;
  if (pubPer > kdpPer) {
    recommendation = "publisher";
  } else if (pubPer < kdpPer) {
    recommendation = "kdp";
  } else {
    recommendation = pubNet > 0 ? "publisher" : "tie";
  }

  return { breakEvenCopies, publisherNet, kdpNet, recommendation };
}
