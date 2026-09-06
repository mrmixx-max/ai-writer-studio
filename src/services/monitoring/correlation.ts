// Correlation-ID: Request-Tracking über mehrere Service-Aufrufe hinweg.
// Ermöglicht Tracing und Debugging in verteilten Workflows.

/**
 * Generiert eine neue Correlation-ID.
 */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Formatiert eine Log-Message mit Correlation-ID.
 */
export function formatCorrelationLog(
  correlationId: string,
  message: string,
  data?: Record<string, unknown>,
): string {
  const base = `[${correlationId}] ${message}`;
  if (data) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

/**
 * Correlation-Context für Async-Operationen.
 * Verwendet AsyncLocalStorage für Node.js.
 */
import { AsyncLocalStorage } from "node:async_hooks";

interface CorrelationContext {
  correlationId: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Führt eine Funktion mit einer Correlation-ID aus.
 */
export async function withCorrelation<T>(
  fn: () => Promise<T>,
  correlationId: string = generateCorrelationId(),
): Promise<T> {
  return storage.run({ correlationId }, fn);
}

/**
 * Gibt die aktuelle Correlation-ID zurück.
 */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
