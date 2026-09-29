// Lazy-Loading der Tauri fs/path Module

import type { FsModule, PathModule } from "./types";
import { logToFile } from "./logging";

let fsMod: FsModule | null = null;
let pathMod: PathModule | null = null;

/** Lädt die Tauri fs/path Module bei Bedarf. */
export async function loadTauriModules(): Promise<{ fsMod: FsModule; pathMod: PathModule } | null> {
  if (fsMod && pathMod) return { fsMod, pathMod };
  try {
    fsMod = await import("@tauri-apps/plugin-fs");
    pathMod = await import("@tauri-apps/api/path");
    return { fsMod, pathMod };
  } catch (e) {
    await logToFile(
      "ERROR",
      `Tauri-Module nicht ladbar: ${(e as Error).message ?? String(e)}`,
    );
    return null;
  }
}

/** Gibt die geladenen Module zurück (für persistNow etc.). */
export function getTauriModules(): { fsMod: FsModule | null; pathMod: PathModule | null } {
  return { fsMod, pathMod };
}

/** Setzt Module manuell (für Tests). */
export function setTauriModules(fs: FsModule | null, path: PathModule | null): void {
  fsMod = fs;
  pathMod = path;
}

export { hasTauri } from "./logging";