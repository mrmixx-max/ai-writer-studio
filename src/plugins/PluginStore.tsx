// PluginStore: Oberfläche für die lokale Registry.
//
// Listet alle in der App mitgelieferten Plugins und erlaubt
// installieren/entfernen sowie aktivieren/deaktivieren und
// aktualisieren, falls die Registry eine neuere Version enthält.

import { useState } from "react";
import { pluginManager } from "./PluginManager";
import { usePlugins } from "./PluginProvider";
import { LOCAL_REGISTRY } from "./registry";
import "./plugins.css";

export function PluginStore({ onClose }: { onClose: () => void }) {
  usePlugins(); // Re-Render bei Plugin-Änderungen
  const [busy, setBusy] = useState<string | null>(null);

  const installed = pluginManager.list();

  async function handleInstall(id: string) {
    const def = LOCAL_REGISTRY.find((p) => p.manifest.id === id);
    if (!def) return;
    setBusy(id);
    try {
      await pluginManager.install(def);
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdate(id: string) {
    const def = LOCAL_REGISTRY.find((p) => p.manifest.id === id);
    if (!def) return;
    setBusy(id);
    try {
      await pluginManager.update(def);
    } finally {
      setBusy(null);
    }
  }

  async function handleEnable(id: string) {
    setBusy(id);
    try {
      await pluginManager.enable(id);
    } finally {
      setBusy(null);
    }
  }

  function handleDisable(id: string) {
    pluginManager.disable(id);
  }

  function handleUninstall(id: string) {
    pluginManager.uninstall(id);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="plugin-store" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Plugin-Store">
        <div className="plugin-store-header">
          <h2>Plugin-Store</h2>
          <button onClick={onClose} aria-label="Plugin-Store schließen">✕</button>
        </div>
        <p className="plugin-store-hint">
          Lokale Registry — alle Plugins werden mit der App ausgeliefert und
          brauchen keinen Netzzugriff.
        </p>

        <ul className="plugin-list">
          {LOCAL_REGISTRY.map((def) => {
            const entry = installed.find((i) => i.id === def.manifest.id);
            const isInstalled = Boolean(entry);
            const isActive = entry?.status === "active";
            const hasUpdate =
              isInstalled &&
              entry !== undefined &&
              def.manifest.version !== entry.manifest.version;
            return (
              <li key={def.manifest.id} className="plugin-item">
                <div className="plugin-item-main">
                  <strong>{def.manifest.name}</strong>
                  <span className="plugin-item-meta">
                    v{def.manifest.version} · {def.manifest.author}
                  </span>
                  {def.manifest.description && (
                    <span className="plugin-item-desc">{def.manifest.description}</span>
                  )}
                  {entry?.status === "error" && (
                    <span className="plugin-item-error">Fehler: {entry.error}</span>
                  )}
                </div>
                <div className="plugin-item-actions">
                  {!isInstalled && (
                    <button
                      disabled={busy === def.manifest.id}
                      onClick={() => void handleInstall(def.manifest.id)}
                    >
                      Installieren
                    </button>
                  )}
                  {isInstalled && hasUpdate && (
                    <button
                      disabled={busy === def.manifest.id}
                      onClick={() => void handleUpdate(def.manifest.id)}
                    >
                      Aktualisieren
                    </button>
                  )}
                  {isInstalled && !isActive && (
                    <button
                      disabled={busy === def.manifest.id}
                      onClick={() => void handleEnable(def.manifest.id)}
                    >
                      Aktivieren
                    </button>
                  )}
                  {isInstalled && isActive && (
                    <button onClick={() => handleDisable(def.manifest.id)}>Deaktivieren</button>
                  )}
                  {isInstalled && (
                    <button
                      className="danger"
                      onClick={() => handleUninstall(def.manifest.id)}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
