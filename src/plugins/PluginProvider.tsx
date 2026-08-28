// React-Anbindung des PluginManagers: Provider + Hook.
//
// Startet beim Mounten alle gemerkt aktivierten Plugins aus der lokalen
// Registry und löst nach dem Hochfahren den "app:ready"-Hook aus.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { pluginManager } from "./PluginManager";
import { LOCAL_REGISTRY } from "./registry";
import { runHookSafe } from "./hostBridge";

interface PluginsState {
  /** Zähler, der sich bei jeder Plugin-Änderung erhöht (Re-Render-Anker). */
  revision: number;
}

const PluginsContext = createContext<PluginsState>({ revision: 0 });

export function PluginProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const off = pluginManager.onChange(() => setRevision((r) => r + 1));
    void pluginManager.activateInstalled(LOCAL_REGISTRY).then(() => {
      pluginManager.runHook("app:ready", null);
    });
    return () => {
      off();
      // Beim Aushängen alle Plugins sauber deaktivieren.
      for (const entry of pluginManager.list()) pluginManager.disable(entry.id);
    };
  }, []);

  return <PluginsContext.Provider value={{ revision }}>{children}</PluginsContext.Provider>;
}

/** Zugriff auf den Plugin-Zustand (löst Re-Render bei Änderungen aus). */
export function usePlugins(): PluginsState {
  return useContext(PluginsContext);
}

export { pluginManager, runHookSafe };
