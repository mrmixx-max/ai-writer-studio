// Tauri-fs-Persistenz-Adapter (Sprint 6, Agent 4): dockt den LogManager
// an das Dateisystem an. Läuft nur im Tauri-Kontext; im Browser/Vitest
// liefert createLogPersistence() null (Logging bleibt Konsole + Puffer).

import type { LogPersistenceAdapter } from "./logManager";

/** Ordner für rotierende Logdateien (App-Daten, plattformabhängig). */
export function defaultLogDir(): string {
  // Tauri fs: appDataDir = %APPDATA%/<bundle-id> etc. Pfad kommt vom Aufrufer.
  return "logs";
}

/**
 * Erzeugt einen Adapter über das Tauri fs-Plugin. Gibt null zurück, wenn
 * kein Tauri-Kontext vorhanden ist (Browser-Dev/Vitest).
 *
 * Es werden bewusst nur die sechs LogManager-Operationen importiert —
 * keine dynamischen Plugin-Imports im Test-Kontext.
 */
export async function createLogPersistence(
  logDir: string = defaultLogDir(),
): Promise<LogPersistenceAdapter | null> {
  // Tauri-API vorhanden? (defineProperty '__TAURI_INTERNALS__' im WebView)
  const w = globalThis as unknown as { __TAURI_INTERNALS__?: unknown };
  if (!w.__TAURI_INTERNALS__) return null;

  // Lazy-Import, damit Vitest/Browser ohne Tauri das Plugin nie laden.
  const fs = await import("@tauri-apps/plugin-fs");

  const join = (name: string) => `${logDir}/${name}`;

  return {
    async list() {
      try {
        const entries = await fs.readDir(logDir);
        return entries.map((e) => e.name);
      } catch {
        return [];
      }
    },
    async sizeOf(name) {
      try {
        const meta = await fs.stat(join(name));
        return meta.size;
      } catch {
        return 0;
      }
    },
    async append(name, line) {
      try {
        await fs.writeTextFile(join(name), line, { create: true, append: true });
      } catch {
        // Verzeichnis fehlt? Einmalig anlegen und erneut versuchen.
        try {
          await fs.mkdir(logDir, { recursive: true });
          await fs.writeTextFile(join(name), line, { create: true, append: true });
        } catch {
          // Logging darf die App niemals crashen.
        }
      }
    },
    async rename(from, to) {
      try {
        await fs.rename(join(from), join(to));
      } catch {
        // Rename-Konflikt (Ziel existiert): Ziel überschreiben.
        try {
          await fs.remove(join(to));
          await fs.rename(join(from), join(to));
        } catch {
          /* Logging darf niemals crashen */
        }
      }
    },
    async remove(name) {
      try {
        await fs.remove(join(name));
      } catch {
        /* ignore */
      }
    },
  };
}
