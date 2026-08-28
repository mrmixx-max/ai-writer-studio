// Crash-Recovery und Auto-Backup für die SQLite-Datenbank (sql.js).
// Datei: src/services/resilience/crashRecovery.ts
//
// Strategie:
//   - Vor kritischen Operationen (Migration, Import, Schema-Änderung, Sync)
//     wird ein Snapshot app.db.snapshot-<ts> geschrieben.
//   - Beim Laden: schlägt `new SQL.Database(bytes)` fehl (Corruption), wird
//     nacheinander .bak (aus persistNow) und der jüngste Snapshot probiert.
//   - Integritätsprüfung via PRAGMA integrity_check; bei "corrupt" gilt die
//     Datei als beschädigt und der Recovery-Pfad greift ebenfalls.
//
// Abhängigkeit: Tauri plugin-fs. Ohne Tauri-Kontext sind alle Funktionen
// bewusste No-Ops (vitest / Browser-Dev).

import { getLogger } from "@/services/logger";
import type { Database, SqlJsStatic } from "sql.js";

const log = getLogger("crashRecovery");

type FsMod = typeof import("@tauri-apps/plugin-fs");
type PathMod = typeof import("@tauri-apps/api/path");

let fs: FsMod | null = null;
let path: PathMod | null = null;

function hasTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

async function loadModules(): Promise<boolean> {
  if (!hasTauri()) return false;
  if (fs && path) return true;
  try {
    fs = await import("@tauri-apps/plugin-fs");
    path = await import("@tauri-apps/api/path");
    return true;
  } catch (e) {
    log.exception("Tauri-Module für Crash-Recovery nicht ladbar", e);
    return false;
  }
}

interface DbPaths {
  dbPath: string;
  baseDir: string;
}

async function resolvePaths(): Promise<DbPaths | null> {
  const ok = await loadModules();
  if (!ok) return null;
  try {
    const base = await path!.appDataDir();
    const dir = await path!.join(base, "user_data");
    const dbPath = await path!.join(dir, "app.db");
    return { dbPath, baseDir: dir };
  } catch (e) {
    log.exception("DB-Pfad nicht auflösbar", e);
    return null;
  }
}

/**
 * Prüft, ob eine geöffnete DB intakt ist (PRAGMA integrity_check).
 * In-Memory-DBs (Tests) gelten als intakt.
 */
export function isDatabaseIntact(db: Database): boolean {
  try {
    const res = db.exec("PRAGMA integrity_check;");
    const row = res[0]?.values?.[0]?.[0];
    return String(row ?? "ok") === "ok";
  } catch (e) {
    log.exception("integrity_check fehlgeschlagen", e);
    return false;
  }
}

/**
 * Legt vor einer kritischen Operation einen Snapshot an.
 * Behält die letzten `keep` Snapshots (Default 5), löscht ältere.
 */
export async function backupBeforeCritical(label: string, keep = 5): Promise<string | null> {
  const paths = await resolvePaths();
  if (!paths) return null;
  try {
    if (!(await fs!.exists(paths.dbPath))) return null;
    const snapPath = `${paths.dbPath}.snapshot-${Date.now()}-${sanitize(label)}`;
    await fs!.copyFile(paths.dbPath, snapPath);
    log.info(`Auto-Backup erstellt: ${snapPath}`);
    await pruneSnapshots(paths.dbPath, keep);
    return snapPath;
  } catch (e) {
    log.exception(`Auto-Backup fehlgeschlagen (${label})`, e);
    return null;
  }
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "op";
}

async function pruneSnapshots(dbPath: string, keep: number): Promise<void> {
  try {
    const prefix = `${dbPath}.snapshot-`;
    const entries = await fs!.readDir(await dirOf(dbPath));
    const snaps = entries
      .filter((e) => e.name?.startsWith("app.db.snapshot-") && e.isFile)
      .map((e) => e.name!)
      .sort(); // Timestamp im Namen → lexikographisch = chronologisch
    const excess = snaps.slice(0, Math.max(0, snaps.length - keep));
    for (const name of excess) {
      const full = `${await dirOf(dbPath)}${name}`;
      try {
        await fs!.remove(full);
        log.debug(`Alten Snapshot entfernt: ${name}`);
      } catch {
        /* ignore */
      }
    }
    void prefix;
  } catch {
    /* ignore */
  }
}

async function dirOf(p: string): Promise<string> {
  // Einfacher Dirname (plugin-fs join nutzt \ auf Windows) — Plattform-agnostisch:
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.slice(0, idx + 1) : "";
}

export interface RecoveryResult {
  bytes: Uint8Array | null;
  source: "primary" | "bak" | "snapshot" | "none";
  /** Liste aller wiederherstellenden Quellen fürs Logging/UI. */
  trail: string[];
}

/**
 * Liest die primäre DB-Datei und validiert sie. Bei Corruption werden
 * nacheinander app.db.bak und der jüngste Snapshot gelesen.
 *
 * `validate` bekommt die Bytes und prüft, ob `new SQL.Database(bytes)` und
 * integrity_check durchgehen (SQL-Instanz wird vom Aufrufer bereitgestellt,
 * damit dieses Modul von sql.js entkoppelt bleibt — wir übergeben SQL statt
 * selbst zu importieren).
 */
export async function loadWithRecovery(
  SQL: SqlJsStatic,
): Promise<RecoveryResult> {
  const paths = await resolvePaths();
  if (!paths) return { bytes: null, source: "none", trail: [] };
  const { dbPath } = paths;
  const trail: string[] = [];

  const candidates: Array<{ file: string; source: RecoveryResult["source"] }> = [
    { file: dbPath, source: "primary" },
    { file: `${dbPath}.bak`, source: "bak" },
  ];

  // Snapshots, jüngster zuerst
  try {
    const dir = await dirOf(dbPath);
    const entries = await fs!.readDir(dir);
    const snaps = entries
      .filter((e) => e.name?.startsWith("app.db.snapshot-") && e.isFile)
      .map((e) => e.name!)
      .sort()
      .reverse();
    for (const name of snaps.slice(0, 1)) {
      candidates.push({ file: `${dir}${name}`, source: "snapshot" });
    }
  } catch {
    /* ignore */
  }

  for (const cand of candidates) {
    try {
      if (!(await fs!.exists(cand.file))) continue;
      const bytes = new Uint8Array(await fs!.readFile(cand.file));
      const probe = new SQL.Database(bytes);
      const intact = isDatabaseIntact(probe);
      probe.close();
      if (intact) {
        trail.push(`OK: ${cand.source} (${cand.file})`);
        return { bytes, source: cand.source, trail };
      }
      trail.push(`CORRUPT: ${cand.source} (${cand.file})`);
    } catch (e) {
      trail.push(`FEHLER: ${cand.source}: ${(e as Error).message}`);
    }
  }

  return { bytes: null, source: "none", trail };
}

/**
 * Convenience für initDb: liefert initiale DB-Bytes (oder null = neu anlegen)
 * inkl. Recovery. Loggt den Recovery-Trail vollständig.
 */
export async function recoverDbBytes(SQL: SqlJsStatic): Promise<Uint8Array | null> {
  const result = await loadWithRecovery(SQL);
  if (result.trail.length) {
    log.warn(`DB-Recovery durchgeführt, Quelle=${result.source}`, result.trail);
  }
  return result.bytes;
}
