// DB-Initialisierung

import initSqlJs, { Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { runMigrations } from "./migrations";
import { loadWithRecovery, backupBeforeCritical } from "@/services/resilience/crashRecovery";
import { logToFile } from "./logging";
import { hasTauri, loadTauriModules, getTauriModules } from "./tauriModules";
import { resolveDbPath } from "./path";
import { setDbState, getDbState } from "./state";
import { persistNow } from "./persist";

const WASM_TIMEOUT_MS = 30_000;

/**
 * Initialisiert die DB: lädt aus Datei (Tauri) oder erstellt neu (In-Memory).
 *
 * `locateFile` ist zwingend: sql.js lädt sql-wasm.wasm zur Laufzeit per URL
 * nach. Ohne expliziten Pfad sucht es relativ zum Bundle-Chunk, findet nichts,
 * bekommt die index.html als 404-Fallback und scheitert mit
 * "expected magic word 00 61 73 6d, found 3c 21 64 6f" (= "<!do").
 * Die Datei wird von scripts/copy_wasm.py nach public/ gelegt.
 */
export async function initDb(): Promise<Database> {
  const state = getDbState();
  if (state.db && state.SQL) return state.db;

  await logToFile("INFO", "initDb() gestartet");

  // Timeout-Race: Wenn das WASM (selten, aber beobachtet) hängt oder der
  // WebView-Compiler extrem langsam ist, bleibt der Splash sonst für immer
  // stehen. Nach 30 s brechen wir ab — App.tsx zeigt dann die dbError-Meldung,
  // statt den Nutzer mit einem eingefrorenen Splash allein zu lassen.
  const SQL = await Promise.race([
    initSqlJs({ locateFile: () => wasmUrl }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`sql.js WASM-Init nach ${WASM_TIMEOUT_MS / 1000}s abgebrochen (Timeout)`)),
        WASM_TIMEOUT_MS,
      ),
    ),
  ]);

  setDbState({ SQL });

  const tauriDetected = hasTauri();
  const modulesLoaded = tauriDetected ? (await loadTauriModules()) !== null : false;
  await logToFile(
    "INFO",
    `Tauri erkannt=${tauriDetected}, Module geladen=${modulesLoaded}`,
  );
  const inTauri = tauriDetected && modulesLoaded;

  if (inTauri) {
    try {
      const dbPath = await resolveDbPath();
      await logToFile("INFO", `DB-Pfad: ${dbPath}`);
      setDbState({ dbPath });

      // Crash-Recovery: primäre Datei, bei Corruption .bak, dann jüngster
      // Snapshot. loadWithRecovery validiert jede Kandidatin per
      // PRAGMA integrity_check, bevor sie akzeptiert wird.
      const recovery = await loadWithRecovery(SQL);
      if (recovery.bytes) {
        const db = new SQL.Database(recovery.bytes);
        for (const line of recovery.trail) await logToFile("INFO", `DB-Recovery: ${line}`);
        await logToFile("INFO", `Bestehende DB geladen, Quelle=${recovery.source}`);
        setDbState({ db, persistent: true });
      } else if (await getTauriModules().fsMod!.exists(dbPath)) {
        // Alle Kandidaten corrupt/lesbar-fehlerhaft: neu anlegen, aber die
        // defekte Datei für die Diagnose umbenennen statt überschreiben.
        try {
          await getTauriModules().fsMod!.copyFile(dbPath, `${dbPath}.corrupt-${Date.now()}`);
          await logToFile(
            "ERROR",
            "DB corrupt — defekte Datei gesichert, leere DB wird angelegt",
          );
        } catch {
          await logToFile("ERROR", "DB corrupt — Sicherung der defekten Datei fehlgeschlagen");
        }
        const db = new SQL.Database();
        setDbState({ db, persistent: true });
      } else {
        const db = new SQL.Database();
        setDbState({ db, persistent: true });
        await logToFile("INFO", "Neue DB angelegt");
      }
    } catch (e) {
      await logToFile(
        "ERROR",
        `Datei nicht nutzbar, In-Memory-Betrieb: ${(e as Error).message ?? String(e)}`,
      );
      const db = new SQL.Database();
      setDbState({ db, persistent: false });
    }
  } else {
    const db = new SQL.Database();
    setDbState({ db, persistent: false });
    await logToFile("WARN", "Kein Tauri-Kontext: In-Memory-Betrieb ohne Persistenz");
  }

  const { db, SQL: SQLFinal } = getDbState();
  if (!db || !SQLFinal) throw new Error("DB oder SQL nicht initialisiert");

  (globalThis as any).__aws_db = db;
  db.run("PRAGMA foreign_keys = ON;");

  // Auto-Backup vor Migrationen (kritische Operation): wenn eine Migration
  // schiefläuft, bleibt der Stand davor als app.db.snapshot-* erhalten.
  if (getDbState().persistent) await backupBeforeCritical("migration");
  runMigrations(db);
  if (getDbState().persistent) await persistNow();

  await logToFile("INFO", `initDb() fertig, persistent=${getDbState().persistent}`);
  return db;
}