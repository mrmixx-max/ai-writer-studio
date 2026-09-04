// Bookwriter-Telemetrie & Budget (Sprint 2, B4).
//
// - Persistiert Router-Call-Telemetrie in bookwriter_jobs.telemetry_json.
// - Budget-Wächter: kumulierte geschätzte Kosten je Job; Überschreiten der
//   Warnschwelle feuert das Event `bookwriter:budget-warning` (window).
// - Interface-Change (DB): bookwriter_jobs.telemetry_json (Migration 020).
import { getDb, persistNow } from "@/services/db";
import type { RouterCallMeta } from "@/services/llm/router";

/** DOM-Event-Name für die Budget-Warnung (B4). */
export const BOOKWRITER_BUDGET_WARNING_EVENT = "bookwriter:budget-warning";

export interface BookwriterBudgetState {
  /** Kritische Warnschwelle (geschätzte Kosten-Einheiten, z.B. USD-Cents). */
  limit: number;
  /** Kumulierte geschätzte Kosten (Default-Einheiten: geschätzte Tokens). */
  spent: number;
}

export interface BookwriterTelemetry {
  /** Ein Eintrag pro Router-Call (B2-Metadaten). */
  calls: RouterCallMeta[];
  /** Kumulierte Token-Schätzung über alle Calls. */
  tokensTotal: number;
  /** Kumulierte Latenz in ms. */
  latencyTotalMs: number;
  /** Anzahl Fallback-Calls (fallback_reason !== null). */
  fallbackCount: number;
  /** Budget-Stand (B4). */
  budget: { limit: number; spent: number; warned: boolean };
  updatedAt: number;
}

export function emptyTelemetry(budgetLimit = DEFAULT_BUDGET_LIMIT): BookwriterTelemetry {
  return {
    calls: [],
    tokensTotal: 0,
    latencyTotalMs: 0,
    fallbackCount: 0,
    budget: { limit: budgetLimit, spent: 0, warned: false },
    updatedAt: Date.now(),
  };
}

/** Default-Budget: 500.000 geschätzte Tokens pro Job. */
export const DEFAULT_BUDGET_LIMIT = 500_000;

/**
 * Kostenschätzung eines Calls. Cloud-Calls (openrouter) zählen real,
 * lokale (ollama) nur mit Faktor 0.1 (kein monetärer Schaden).
 */
export function estimateCallCost(meta: RouterCallMeta): number {
  const factor = meta.provider === "openrouter" ? 1 : 0.1;
  return Math.ceil(meta.tokens_est * factor);
}

/** Fügt einen Call-Telemetrie-Eintrag hinzu (pure, für Tests). */
export function appendCall(
  t: BookwriterTelemetry,
  meta: RouterCallMeta,
  opts?: { budgetLimit?: number },
): { telemetry: BookwriterTelemetry; budgetExceeded: boolean } {
  const cost = estimateCallCost(meta);
  const limit = opts?.budgetLimit ?? t.budget.limit;
  const spent = t.budget.spent + cost;
  const budgetExceeded = spent > limit && !t.budget.warned;
  const calls = [...t.calls, meta];
  return {
    telemetry: {
      calls,
      tokensTotal: t.tokensTotal + meta.tokens_est,
      latencyTotalMs: t.latencyTotalMs + meta.latency_ms,
      fallbackCount: t.fallbackCount + (meta.fallback_reason !== null ? 1 : 0),
      budget: { limit, spent, warned: t.budget.warned || budgetExceeded },
      updatedAt: Date.now(),
    },
    budgetExceeded,
  };
}

/**
 * Feuer die Budget-Warnung als DOM-Event (browser) bzw. no-op (Node/Tests).
 * Detail-Payload: { spent, limit, tokensTotal, jobId? }.
 */
export function emitBudgetWarning(payload: { spent: number; limit: number; tokensTotal: number; jobId?: string }): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(BOOKWRITER_BUDGET_WARNING_EVENT, { detail: payload }));
  }
  console.warn(
    `[Bookwriter] Budget-Warnung: ${payload.spent} > ${payload.limit} (tokens_est gesamt: ${payload.tokensTotal})`,
  );
}

/** Lädt die Telemetrie eines Jobs (leere Struktur, wenn keine vorhanden). */
export function loadJobTelemetry(jobId: string): BookwriterTelemetry | null {
  const res = getDb().exec(
    `SELECT telemetry_json FROM bookwriter_jobs WHERE id = ?`,
    [jobId],
  );
  if (!res.length || !res[0].values.length) return null;
  const raw = res[0].values[0][0];
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(String(raw)) as BookwriterTelemetry;
  } catch {
    return null;
  }
}

/** Speichert die Telemetrie eines Jobs (persistNow — crash-sicher). */
export async function saveJobTelemetry(jobId: string, telemetry: BookwriterTelemetry): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_jobs SET telemetry_json = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(telemetry), Date.now(), jobId],
  );
  await persistNow();
}

/**
 * Protokolliert einen Router-Call am Job: append → persist → ggf.
 * Budget-Warnung (einmalig pro Job).
 */
export async function recordRouterCall(
  jobId: string,
  meta: RouterCallMeta,
): Promise<BookwriterTelemetry> {
  const current = loadJobTelemetry(jobId) ?? emptyTelemetry();
  const { telemetry, budgetExceeded } = appendCall(current, meta);
  await saveJobTelemetry(jobId, telemetry);
  if (budgetExceeded) {
    emitBudgetWarning({
      spent: telemetry.budget.spent,
      limit: telemetry.budget.limit,
      tokensTotal: telemetry.tokensTotal,
      jobId,
    });
  }
  return telemetry;
}