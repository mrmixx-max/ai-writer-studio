// PluginManagerPanel (Sprint 29): Plugin-Manager — installieren/deinstallieren/aktualisieren.
import { useState, useCallback } from "react";
import {
  getInstalledPlugins,
  installPlugin,
  uninstallPlugin,
  updatePlugin,
  togglePlugin,
  type InstalledPlugin,
} from "@/services/plugin/pluginManager";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function PluginManagerPanel() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>(getInstalledPlugins);
  const [filter, setFilter] = useState<"all" | "analysis" | "export" | "import" | "utility" | "ai">("all");

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    togglePlugin(id, enabled);
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
  }, []);

  const handleUninstall = useCallback((id: string) => {
    if (confirm(`Plugin "${id}" wirklich deinstallieren?`)) {
      uninstallPlugin(id);
      setPlugins((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  const handleUpdate = useCallback((id: string) => {
    updatePlugin(id);
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, version: p.version + " (aktualisiert)" } : p)));
  }, []);

  const filtered = filter === "all" ? plugins : plugins.filter((p) => p.category === filter);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>🧩 PLUGIN-MANAGER</h2>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["all", "analysis", "export", "import", "utility", "ai"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 12px",
              background: filter === f ? AMBER : PANEL,
              color: filter === f ? "#000" : TEXT,
              border: `1px solid ${filter === f ? AMBER : BORDER}`,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Plugin-Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              background: PANEL,
              border: `1px solid ${p.enabled ? AMBER : BORDER}`,
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 24 }}>{p.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {p.name} <span style={{ color: DIM, fontSize: 11 }}>v{p.version}</span>
              </div>
              <div style={{ color: DIM, fontSize: 11 }}>{p.description}</div>
              <div style={{ color: DIM, fontSize: 10 }}>
                {p.author} • {p.category} • {p.installedAt.split("T")[0]}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => handleUpdate(p.id)}
                style={{
                  padding: "4px 10px",
                  background: PANEL,
                  color: AMBER,
                  border: `1px solid ${AMBER}`,
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                ↻
              </button>
              <button
                onClick={() => handleToggle(p.id, !p.enabled)}
                style={{
                  padding: "4px 10px",
                  background: p.enabled ? AMBER : PANEL,
                  color: p.enabled ? "#000" : TEXT,
                  border: `1px solid ${p.enabled ? AMBER : BORDER}`,
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                {p.enabled ? "AN" : "AUS"}
              </button>
              <button
                onClick={() => handleUninstall(p.id)}
                style={{
                  padding: "4px 10px",
                  background: PANEL,
                  color: "#ff4444",
                  border: "1px solid #ff4444",
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: DIM, textAlign: "center", padding: 20 }}>
            Keine Plugins in dieser Kategorie.
          </div>
        )}
      </div>

      {/* Installieren-Button */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => {
            const id = prompt("Plugin-ID zum Installieren:");
            if (id) {
              installPlugin(id);
              setPlugins(getInstalledPlugins());
            }
          }}
          style={{
            padding: "8px 20px",
            background: AMBER,
            color: "#000",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          + PLUGIN INSTALLIEREN
        </button>
      </div>
    </div>
  );
}
