// Preisstrategien (Sprint 5, Agent 3): dynamische, konfigurierbare KDP-Preise.
//
// Liefert benannte Preisstrategien mit festen Währungs-Preisen (USD/EUR/GBP)
// und erlaubt Overrides pro Buch. KDP-Grenzen (0.99–200 USD) werden erzwungen.
//
// Design-Vertrag:
// - Rein deterministisch (kein LLM-Call, kein API-Budget).
// - Konfiguration als String-Id ("standard" | "launch" | "premium" |
//   "series-loss-leader") — parsePricingConfig validiert und trimmt.
// - computePrices deckelt auf KDP-Grenzen und rundet auf 2 Dezimalen.

// --- Types ---------------------------------------------------------------------------

export type PricingCurrency = "USD" | "EUR" | "GBP";

export type PricingStrategyId =
  | "standard"
  | "launch"
  | "premium"
  | "series-loss-leader";

export interface PricingStrategy {
  id: PricingStrategyId;
  /** Anzeigename. */
  label: string;
  /** Wann diese Strategie passt. */
  description: string;
  /** Basis-Preise pro Währung (USD/EUR/GBP). */
  prices: Record<PricingCurrency, number>;
}

/** KDP-Preisgrenzen (aus kdp/validation.ts LIMITS gespiegelt, um Import-Zyklus zu vermeiden). */
export const KDP_PRICE_MIN = 0.99;
export const KDP_PRICE_MAX = 200;

export type PriceOverrides = Partial<Record<PricingCurrency, number>>;

// --- Registry ------------------------------------------------------------------------

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const PRICING_STRATEGIES: PricingStrategy[] = [
  {
    id: "standard",
    label: "Standard (70% Tantiemen-Zone)",
    description:
      "Ausgewogener Listenpreis in der 70%-Royalty-Zone (2.99–9.99 USD) — Standard für Einzelwerke.",
    prices: { USD: 4.99, EUR: 4.99, GBP: 3.99 },
  },
  {
    id: "launch",
    label: "Launch (eingeschränkter Einführungspreis)",
    description:
      "Niedriger Einführungspreis für die ersten 2–4 Wochen; danach Wechsel auf 'standard'.",
    prices: { USD: 2.99, EUR: 2.99, GBP: 1.99 },
  },
  {
    id: "premium",
    label: "Premium (etablierte Reihe/Authority)",
    description:
      "Höherer Preis für etablierte Autoren/Reihen mit Kaufbereitschaft; maximale Tantieme pro Verkauf.",
    prices: { USD: 7.99, EUR: 7.99, GBP: 6.99 },
  },
  {
    id: "series-loss-leader",
    label: "Reihen-Starter (Loss Leader, Band 1)",
    description:
      "Band 1 einer Reihe dauerhaft niedrig, um Folgekäufe der Reihe zu induzieren (0.99-Zone, 35% Royalty).",
    prices: { USD: 0.99, EUR: 0.99, GBP: 0.99 },
  },
];

// --- API -----------------------------------------------------------------------------

/** Liefert die Strategie-Definition oder wirft bei unbekannter Id. */
export function getPricingStrategy(id: string | undefined): PricingStrategy {
  const key = (id ?? "standard").trim();
  const found = PRICING_STRATEGIES.find((s) => s.id === key);
  if (!found) {
    const ids = PRICING_STRATEGIES.map((s) => s.id).join(", ");
    throw new Error(
      `Unbekannte Preisstrategie: "${id}". Verfügbar: ${ids}.`,
    );
  }
  return found;
}

/**
 * Berechnet die Preise pro Währung: Strategie-Basis + Overrides,
 * auf KDP-Grenzen (0.99–200) gedeckelt, auf 2 Dezimalen gerundet.
 */
export function computePrices(
  strategyId: string | undefined,
  overrides?: PriceOverrides,
): Record<PricingCurrency, number> {
  const base = getPricingStrategy(strategyId).prices;
  const out = { ...base };
  for (const cur of ["USD", "EUR", "GBP"] as PricingCurrency[]) {
    const o = overrides?.[cur];
    if (o != null && !Number.isNaN(o)) out[cur] = o;
  }
  for (const cur of ["USD", "EUR", "GBP"] as PricingCurrency[]) {
    out[cur] = round2(Math.min(KDP_PRICE_MAX, Math.max(KDP_PRICE_MIN, out[cur])));
  }
  return out;
}

/** Beschreibender Text für die UI. */
export function describePricingStrategy(id: string | undefined): string {
  const s = getPricingStrategy(id);
  return `${s.label} — ${s.description} (USD ${s.prices.USD.toFixed(2)} / EUR ${s.prices.EUR.toFixed(2)} / GBP ${s.prices.GBP.toFixed(2)})`;
}

/** Validiert eine Strategie-Id aus der Konfiguration (trim + Validierung). */
export function parsePricingConfig(value: string | undefined): PricingStrategyId {
  const key = (value ?? "standard").trim();
  const found = PRICING_STRATEGIES.find((s) => s.id === key);
  if (!found) {
    const ids = PRICING_STRATEGIES.map((s) => s.id).join(", ");
    throw new Error(`Unbekannte Preisstrategie: "${value}". Verfügbar: ${ids}.`);
  }
  return found.id;
}
