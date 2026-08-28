// Lifecycle-Helfer: sicheres Aktivieren/Deaktivieren mit Fehlerisolierung.
// Ein fehlerhaftes Plugin darf niemals die ganze App mitreißen.

import type { PluginDefinition, PluginLogger } from "../types";

export type LifecycleResult = { ok: true } | { ok: false; error: string };

/** activate() ausführen, Fehler abfangen und protokollieren. */
export async function safeActivate(
  plugin: PluginDefinition,
  context: Parameters<PluginDefinition["activate"]>[0],
  log: PluginLogger,
): Promise<LifecycleResult> {
  try {
    await plugin.activate(context);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    log.error(`Aktivierung fehlgeschlagen: ${msg}`);
    return { ok: false, error: msg };
  }
}

/** deactivate() ausführen, falls vorhanden; Fehler werden nur protokolliert. */
export function safeDeactivate(plugin: PluginDefinition, log: PluginLogger): void {
  if (!plugin.deactivate) return;
  try {
    plugin.deactivate();
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    log.error(`Deaktivierung fehlgeschlagen: ${msg}`);
  }
}

/** Grober Vergleich zweier semantischer Versionsnummern (a > b). */
export function versionGt(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da > db;
  }
  return false;
}
