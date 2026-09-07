// Sprint 13, Agent 2: Automatischer Downgrade bei Timeout (ADDITIV).
//
// Verhalten: Primärversuch läuft; NUR bei Timeout wird geloggt und auf ein
// kleineres/schnelleres Modell (Downgrade) umgeschaltet — kein Crash, kein
// Throw bei erfolgreichem Downgrade. Alle anderen Fehler (Abort, 4xx,
// Netzwerk ohne Timeout-Signatur) werden unverändert weitergereicht.
//
// Reines Wrapper-Modul: keine Provider-Imports, kein Netzwerk, kein Disk.
// Der Aufrufer injiziert primary/downgrade als Funktionen (gut testbar).

import { looksLikeFastModel } from "./router";

/** true bei Timeout-Signatur (DOMException TimeoutError oder Timeout-Text). */
export function isTimeoutError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "TimeoutError") return true;
  const name = (e as { name?: unknown })?.name;
  if (typeof name === "string" && /timeout/i.test(name)) return true;
  const msg = (e as { message?: unknown })?.message;
  if (typeof msg === "string" && /(timeout|timed out|etimedout|deadline exceeded)/i.test(msg)) {
    return true;
  }
  return false;
}

/**
 * Downgrade-Kandidat aus explizit verfügbaren Modellen wählen.
 * Bevorzugt ein als "fast" erkennbares Modell ungleich current; sonst das
 * erste Modell ungleich current. Ohne Kandidaten → current (nie erfinden).
 */
export function resolveDowngradeModel(current: string, available: string[] = []): string {
  const others = available.filter((m) => m !== current);
  if (others.length === 0) return current;
  return others.find((m) => looksLikeFastModel(m)) ?? others[0];
}

export interface DowngradeHooks {
  /** Wird beim Umschalten aufgerufen (Logging beim Aufrufer). */
  onDowngrade?: (info: { from: string; to: string; error: unknown }) => void;
  /** Timeout-Erkennung (Default: isTimeoutError). Injizierbar für Tests. */
  isTimeout?: (e: unknown) => boolean;
}

export interface DowngradeResult<T> {
  result: T;
  /** true = Downgrade-Pfad wurde benutzt (Timeout geloggt + umgeschaltet). */
  downgraded: boolean;
  /** Modellwechsel, falls einer stattfand. */
  from?: string;
  to?: string;
}

/**
 * Führt primary aus; bei Timeout einmalig downgrade (log + switch, no crash).
 * Gibt { result, downgraded } zurück. Nicht-Timeout-Fehler fliegen sofort
 * (kein Fallback). Schlägt auch downgrade fehl, fliegt dessen Fehler.
 */
export async function executeWithTimeoutDowngrade<T>(
  primary: () => Promise<T>,
  downgrade: () => Promise<T>,
  opts: DowngradeHooks & { from?: string; to?: string } = {},
): Promise<DowngradeResult<T>> {
  const isTimeout = opts.isTimeout ?? isTimeoutError;
  try {
    return { result: await primary(), downgraded: false };
  } catch (e: unknown) {
    if (!isTimeout(e)) throw e;
    opts.onDowngrade?.({ from: opts.from ?? "", to: opts.to ?? "", error: e });
    return { result: await downgrade(), downgraded: true, from: opts.from, to: opts.to };
  }
}
