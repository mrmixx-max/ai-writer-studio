// Kosten-Rechner für Token-Analytics (Sprint 6, Agent 1).
//
// - Berechnet die realen OpenRouter-/Cloud-Kosten eines Router-Calls aus
//   den Token-Schätzungen (RouterCallMeta.tokens_est) und einer Preisliste.
// - Counterfactual: wie viel hätten ALLE Tokens gekostet, wären sie über
//   das Cloud-Default-Modell gelaufen? Differenz = Ersparnis durch lokales
//   Routing (Ollama/LM Studio).
// - Reine Funktionen, keine DB-/Netzwerk-Abhängigkeit — voll testbar.
import type { RouterCallMeta } from "@/services/llm/router";

export interface CloudPrice {
  /** USD pro 1 Million Tokens. */
  usdPerMillion: number;
}

/**
 * Preisliste (USD / 1M Tokens). Conservative Schätzwerte auf Basis der
 * üblichen OpenRouter-Konditionen; Override möglich über computeCostReport
 * bzw. priceFor(model). Unbekannte Modelle fallen auf den Default zurück.
 */
export const DEFAULT_CLOUD_PRICE_PER_M = 1.5;

const MODEL_PRICES: Record<string, CloudPrice> = {
  // Gängige OpenRouter-Modelle (USD / 1M Tokens, konservativ geschätzt).
  "deepseek/deepseek-chat": { usdPerMillion: 0.5 },
  "deepseek/deepseek-r1": { usdPerMillion: 1.0 },
  "openai/gpt-4o-mini": { usdPerMillion: 1.0 },
  "anthropic/claude-3.5-haiku": { usdPerMillion: 1.5 },
  "meta-llama/llama-3.1-8b-instruct": { usdPerMillion: 0.1 },
};

/** Preis eines Modells (USD / 1M Tokens); unbekannte → Default. */
export function priceFor(model: string): number {
  return MODEL_PRICES[model]?.usdPerMillion ?? DEFAULT_CLOUD_PRICE_PER_M;
}

/** true, wenn der Provider kostenpflichtig ist (alles außer lokal/mock). */
export function isCloudProvider(provider: string): boolean {
  const p = provider.toLowerCase();
  return p !== "ollama" && p !== "lmstudio" && p !== "local" && p !== "mock";
}

/** Reale Kosten eines Calls in USD (Cloud = Token × Preis, lokal = 0). */
export function callCostUsd(meta: RouterCallMeta): number {
  if (!isCloudProvider(meta.provider)) return 0;
  const tokens = Math.max(0, Number(meta.tokens_est) || 0);
  return (tokens / 1_000_000) * priceFor(meta.model);
}

/**
 * Counterfactual-Kosten eines Calls: was hätte derselbe Token-Umfang über
 * das Cloud-Default-Modell gekostet — unabhängig vom tatsächlichen Provider.
 * (Für lokale Calls ist das die volle potenzielle Cloud-Kosten-Ersparnis.)
 */
export function counterfactualCloudCostUsd(meta: RouterCallMeta): number {
  const tokens = Math.max(0, Number(meta.tokens_est) || 0);
  return (tokens / 1_000_000) * DEFAULT_CLOUD_PRICE_PER_M;
}

export interface CostReport {
  /** Summe aller Token-Schätzungen über alle Calls. */
  tokensTotal: number;
  /** Nur die lokal gerouteten Tokens. */
  localTokens: number;
  /** Nur die Cloud- (OpenRouter-)Tokens. */
  cloudTokens: number;
  /** Anzahl Calls. */
  calls: number;
  /** Reale Cloud-Kosten (USD). */
  cloudCostUsd: number;
  /**potenzielle Cloud-Kosten aller Tokens (USD). */
  potentialCloudCostUsd: number;
  /** Ersparnis durch lokales Routing = potenziell − real (USD). */
  savingsUsd: number;
  /** Latenzsumme aller Calls (ms). */
  latencyTotalMs: number;
}

/** Aggregiert die Kosten eines Call-Sets (pure). */
export function computeCostReport(calls: RouterCallMeta[]): CostReport {
  let tokensTotal = 0, localTokens = 0, cloudTokens = 0, cloudCostUsd = 0, potential = 0;
  let latencyTotalMs = 0;
  for (const c of calls) {
    const tokens = Math.max(0, Number(c.tokens_est) || 0);
    tokensTotal += tokens;
    latencyTotalMs += Math.max(0, Number(c.latency_ms) || 0);
    if (isCloudProvider(c.provider)) {
      cloudTokens += tokens;
      cloudCostUsd += callCostUsd(c);
      potential += callCostUsd(c); // Cloud-Call: Counterfactual = realer Preis des Modells
    } else {
      localTokens += tokens;
      potential += counterfactualCloudCostUsd(c);
    }
  }
  return {
    tokensTotal,
    localTokens,
    cloudTokens,
    calls: calls.length,
    cloudCostUsd,
    potentialCloudCostUsd: potential,
    savingsUsd: Math.max(0, potential - cloudCostUsd),
    latencyTotalMs,
  };
}