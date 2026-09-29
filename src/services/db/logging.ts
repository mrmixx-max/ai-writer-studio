// Logging-Utility für DB-Operationen

declare const window: { __TAURI_INTERNALS__?: unknown } | undefined;

/** true, wenn die App im Tauri-Desktop-Kontext läuft. */
export function hasTauri(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

/**
 * Schreibt eine Diagnosezeile nach %APPDATA%\...\logs\app.log.
 *
 * Grund: In der Release-EXE gibt es keine DevTools-Konsole. Ohne diesen Weg
 * sind Fehler beim DB-Start unsichtbar — genau der Fall, in dem die App still
 * auf In-Memory zurückfällt und Projekte verliert. Fehler hier werden bewusst
 * geschluckt, damit Logging nie selbst zum Problem wird.
 */
export async function logToFile(level: string, message: string): Promise<void> {
  if (!hasTauri()) {
    console.log(`[db/${level}] ${message}`);
    return;
  }
  try {
    const core = await import("@tauri-apps/api/core");
    await core.invoke("log_message", { level: `db/${level}`, message });
  } catch {
    /* Logging darf nie den Start verhindern. */
  }
}