// loggingRuntime (Sprint 6, Agent 4): App-weite Verdrahtung des Log-Managers.
//
// installLogPersistence() erzeugt beim App-Start (main.tsx) den LogManager
// mit dem Tauri-fs-Adapter, spiegelt Konsolen-Outputs und Fehler in die
// rotierenden Monatsdateien (app-YYYY-MM.log) und macht die Instanz global
// verfügbar — damit globale Fehlerhandler (globalErrorHandler, fetchRetryShim)
// Fehler in dieselben Dateien schreiben können.
//
// Verträge:
// - Idempotent: mehrfacher Aufruf liefert dieselbe Instanz.
// - Crasht nie: Adapter-Fehler (z. B. kein Tauri-Kontext → null) werden
//   abgefangen; Logging blockiert den App-Start niemals.
// - getGlobalLogManager(): Zugriff für Diagnose-Panel & Fehlerhandler.

import { LogManager } from "./logging/logManager";
import { createLogPersistence } from "./logging/logPersistence";

let globalManager: LogManager | null = null;
let installing: Promise<LogManager | null> | null = null;

/** Der installierte LogManager (null vor/nach fehlgeschlagener Installation). */
export function getGlobalLogManager(): LogManager | null {
  return globalManager;
}

/**
 * Installiert die persistierende Log-Rotation (idempotent, no-throw).
 * Wird in src/main.tsx vor dem ersten React-Render aufgerufen.
 */
export async function installLogPersistence(): Promise<LogManager | null> {
  if (globalManager) return globalManager;
  if (installing) return installing;

  installing = (async () => {
    try {
      const adapter = await createLogPersistence();
      const manager = new LogManager(adapter, {
        // In Produktion spiegelt die Konsole weiterhin mit; die Rotation
        // schreibt zusätzlich in Dateien (ENV im Docker-Kontext konfigurierbar).
        mirrorToConsole: true,
      });
      globalManager = manager;
      return manager;
    } catch {
      // Logging darf die App niemals crashen — Konsole+Puffer bleiben aktiv.
      return null;
    } finally {
      installing = null;
    }
  })();

  return installing;
}
