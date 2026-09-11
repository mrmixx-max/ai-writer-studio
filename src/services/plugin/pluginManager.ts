// Plugin Manager (Sprint 29): Installieren, Deinstallieren, Aktualisieren von Plugins.
// Lokal, kein LLM nötig, deterministisch.

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  category: "analysis" | "export" | "import" | "utility" | "ai";
  dependencies?: string[];
}

export interface InstalledPlugin extends PluginManifest {
  installedAt: string;
  enabled: boolean;
  path: string;
}

/**
 * Liefert die Liste der installierten Plugins.
 */
export function getInstalledPlugins(): InstalledPlugin[] {
  // Demo-Daten — später aus SQLite oder Dateisystem laden
  return [
    {
      id: "hook-analyzer",
      name: "Hook Analyzer",
      version: "1.0.0",
      description: "Eröffnungssätze analysieren",
      author: "AI Writer Studio",
      icon: "🎣",
      category: "analysis",
      installedAt: new Date().toISOString(),
      enabled: true,
      path: "/plugins/hook-analyzer",
    },
    {
      id: "tension-curve",
      name: "Tension Curve",
      version: "1.0.0",
      description: "Spannungskurve visualisieren",
      author: "AI Writer Studio",
      icon: "📈",
      category: "analysis",
      installedAt: new Date().toISOString(),
      enabled: true,
      path: "/plugins/tension-curve",
    },
    {
      id: "character-arc",
      name: "Character Arc",
      version: "1.0.0",
      description: "Charakterentwicklung analysieren",
      author: "AI Writer Studio",
      icon: "👤",
      category: "analysis",
      installedAt: new Date().toISOString(),
      enabled: true,
      path: "/plugins/character-arc",
    },
    {
      id: "pacing-map",
      name: "Pacing Map",
      version: "1.0.0",
      description: "Pacing-Karte erstellen",
      author: "AI Writer Studio",
      icon: "🗺️",
      category: "analysis",
      installedAt: new Date().toISOString(),
      enabled: true,
      path: "/plugins/pacing-map",
    },
    {
      id: "conflict-map",
      name: "Conflict Map",
      version: "1.0.0",
      description: "Konflikte visualisieren",
      author: "AI Writer Studio",
      icon: "⚔️",
      category: "analysis",
      installedAt: new Date().toISOString(),
      enabled: true,
      path: "/plugins/conflict-map",
    },
    {
      id: "story-structure",
      name: "Story Structure",
      version: "1.0.0",
      description: "Geschichtsstruktur analysieren",
      author: "AI Writer Studio",
      icon: "📜",
      category: "analysis",
      installedAt: new Date().toISOString(),
      enabled: true,
      path: "/plugins/story-structure",
    },
  ];
}

/**
 * Plugin installieren.
 */
export function installPlugin(_pluginId: string): boolean {
  // Demo — später: Download, Entpacken, Manifest speichern
  return true;
}

/**
 * Plugin deinstallieren.
 */
export function uninstallPlugin(_pluginId: string): boolean {
  // Demo — später: Dateien löschen, Einträge entfernen
  return true;
}

/**
 * Plugin aktualisieren.
 */
export function updatePlugin(_pluginId: string): boolean {
  // Demo — später: Neue Version laden, ersetzen
  return true;
}

/**
 * Plugin aktivieren/deaktivieren.
 */
export function togglePlugin(_pluginId: string, _enabled: boolean): boolean {
  // Demo — später: Status in Config speichern
  return true;
}
