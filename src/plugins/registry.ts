// Lokale Plugin-Registry: die im App-Bundle mitgelieferten Plugins.
//
// Der Plugin-Store zeigt diese Liste an ("lokale Registry"). Später könnte
// hier zusätzlich ein Verzeichnis aus dem Anwendungsdatenordner gelesen
// werden; die Struktur (PluginDefinition) bleibt dieselbe.

import { wordCountBadgePlugin } from "./builtin/word-count-badge";
import type { PluginDefinition } from "./types";

export const LOCAL_REGISTRY: PluginDefinition[] = [wordCountBadgePlugin];

/** Definition anhand der ID aus der lokalen Registry suchen. */
export function findInRegistry(id: string): PluginDefinition | undefined {
  return LOCAL_REGISTRY.find((p) => p.manifest.id === id);
}
