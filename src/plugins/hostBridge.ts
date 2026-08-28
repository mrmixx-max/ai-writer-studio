// Host-Brücke: wie die App den PluginManager aufruft.
//
// Kleine Hülle, damit Aufrufer nicht versehentlich den rawen Manager
// umgehen und z. B. Hooks ohne Fehlerisolierung laufen lassen.

import { pluginManager } from "./PluginManager";

/** Hook-Kette ausführen (Fehler isoliert der HookRegistry selbst ab). */
export function runHookSafe<V>(name: Parameters<typeof pluginManager.runHook>[0], value: V): V {
  return pluginManager.runHook(name, value);
}

/** Event an alle Plugins senden. */
export function emitPluginEvent(
  name: Parameters<typeof pluginManager.emit>[0],
  payload?: unknown,
): void {
  pluginManager.emit(name, payload);
}
