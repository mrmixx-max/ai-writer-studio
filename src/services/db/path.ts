// DB-Pfad-Auflösung

import { getTauriModules } from "./tauriModules";

/**
 * Ermittelt den DB-Pfad: {APPDATA}\com.aiwriterstudio.app\user_data\app.db
 *
 * appDataDir() liefert bereits das identifier-basierte App-Verzeichnis.
 * user_data/ ist dasselbe Verzeichnis, das main.rs beim Start anlegt — damit
 * enthält eine Sicherung von user_data/ tatsächlich alle Projekte.
 */
export async function resolveDbPath(): Promise<string> {
  const { pathMod, fsMod } = getTauriModules();
  if (!pathMod || !fsMod) throw new Error("Tauri-Module nicht geladen");

  const base = await pathMod.appDataDir();
  const dir = await pathMod.join(base, "user_data");
  await fsMod.mkdir(dir, { recursive: true });
  return pathMod.join(dir, "app.db");
}