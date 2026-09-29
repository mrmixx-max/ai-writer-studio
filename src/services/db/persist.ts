// DB-Persistenz (Entprellung + sofortiges Schreiben)

import { getTauriModules } from "./tauriModules";
import { getDbState } from "./state";
import { logToFile } from "./logging";

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPending = false;

/**
 * Schreibt die DB als Datei. Entprellt (400 ms): mehrere Aufrufe werden zu
 * einem Schreibvorgang zusammengefasst. Der letzte Aufruf gewinnt und schreibt
 * den aktuellen Zustand — kein Datenverlust.
 */
export async function persist(): Promise<void> {
  const state = getDbState();
  if (!state.persistent || !state.db) return;
  persistPending = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (persistPending) {
      persistPending = false;
      void persistNow();
    }
  }, 400);
}

/** Schreibt sofort, ohne Entprellung — für Snapshot, Restore, App-Ende. */
export async function persistNow(): Promise<void> {
  const state = getDbState();
  if (!state.persistent || !state.db || !state.dbPath) return;

  const { fsMod } = getTauriModules();
  if (!fsMod) return;

  try {
    const data = state.db.export();
    const tmpPath = `${state.dbPath}.tmp`;
    // 1. Schreibe temporär
    await fsMod.writeFile(tmpPath, data);
    // 2. Backup der vorherigen Version anlegen (falls vorhanden)
    try {
      if (await fsMod.exists(state.dbPath)) {
        await fsMod.copyFile(state.dbPath, `${state.dbPath}.bak`);
      }
    } catch {
      // Backup darf Schreibvorgang nicht blockieren
    }
    // 3. Temp nach Ziel kopieren (plugin-fs hat kein renameFile)
    await fsMod.copyFile(tmpPath, state.dbPath);
    // 4. Temp löschen
    try {
      await fsMod.remove(tmpPath);
    } catch {
      // Temp-Löschung kann später nachgeholt werden
    }
  } catch (e) {
    await logToFile(
      "ERROR",
      `Schreiben fehlgeschlagen: ${(e as Error).message ?? String(e)}`,
    );
  }
}

/** Abbruch aller pending Writes (für Tests/Shutdown). */
export function cancelPendingPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    persistPending = false;
  }
}