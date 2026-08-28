// useActiveModel: zentrale Quelle für das aktive Modell (Provider + Modellname)
// und den Erreichbarkeits-Status aus dem modelRegistry.
//
// Grundsatz: KEINE Duplikation — loadSettings/saveSettings und discoverModels
// werden wiederverwendet. Komponenten (KI-Panel, Editor-Badge, Statusbar)
// bleiben über das Fenster-Event "aiw:settings-changed" synchron, sodass ein
// Modellwechsel im KI-Panel sofort überall sichtbar ist.

import { useCallback, useEffect, useState } from "react";
import {
  discoverModels,
  labelFor,
  type DiscoveredModels,
} from "@/services/llm/modelRegistry";
import { loadSettings, saveSettings } from "@/services/settings";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/config";
import type { ProviderId } from "@/types/llm";

/** Fenster-Event, über das sich Komponenten über Modellwechsel informieren. */
export const SETTINGS_CHANGED_EVENT = "aiw:settings-changed";

/** Aktives Modell + Wechsler. In KIPanel, Editor-Badge und Statusbar gleich. */
export function useActiveModel() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      return loadSettings();
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  // Modellwechsel aus einer anderen Komponente übernehmen.
  useEffect(() => {
    function onChanged(e: Event) {
      const next = (e as CustomEvent<AppSettings>).detail;
      if (next) setSettings(next);
    }
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onChanged);
  }, []);

  const selectModel = useCallback(
    (provider: ProviderId, model: string) => {
      setSettings((prev) => {
        const next: AppSettings = { ...prev, provider, model };
        // Persistenz; feuert das Sync-Event für alle anderen Komponenten.
        saveSettings(next).catch(() => {
          // Persistenz fehlgeschlagen (z. B. DB nicht initialisiert) —
          // Auswahl bleibt für diese Sitzung trotzdem aktiv.
        });
        window.dispatchEvent(
          new CustomEvent<AppSettings>(SETTINGS_CHANGED_EVENT, { detail: next }),
        );
        return next;
      });
    },
    [],
  );

  return { settings, selectModel };
}

/** Ampel-Status des aktiven Anbieters. */
export type ModelStatusLevel = "ok" | "degraded" | "down";

export interface ModelStatus {
  results: DiscoveredModels[] | null;
  /** Ampel: grün (aktiv erreichbar), gelb (aktiv offline, andere erreichbar), rot (nichts erreichbar). */
  level: ModelStatusLevel;
  /** true, wenn das AKTIVE Modell offline ist → grau + "(offline)" darstellen. */
  activeOffline: boolean;
  /** Klartext-Anzeige "Provider · Modell" inkl. konsistentem Offline-Suffix. */
  display: string;
  /** Neu erkennen erzwingen (Refresh-Button). */
  refresh: () => void;
}

/**
 * Erreichbarkeits-Status via modelRegistry, zyklisch aktualisiert
 * (Standard: alle 30 s). Nutzt den Registry-Cache, keine Doppel-Probes.
 */
export function useModelStatus(settings: AppSettings, intervalMs = 30_000): ModelStatus {
  const [results, setResults] = useState<DiscoveredModels[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = (force: boolean) =>
      discoverModels(settings, { force })
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .catch(() => {
          // Wirft nie — zur Sicherheit trotzdem abfangen.
          if (!cancelled) setResults([]);
        });
    void load(tick > 0);
    const id = window.setInterval(() => {
      if (!cancelled) setTick((t) => t + 1);
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [settings, intervalMs, tick]);

  const active = results?.find((r) => r.provider === settings.provider) ?? null;
  const activeOffline = active !== null && !active.reachable;
  const anyReachable = (results ?? []).some((r) => r.reachable);
  const level: ModelStatusLevel =
    active !== null && active.reachable ? "ok" : anyReachable ? "degraded" : "down";
  const offlineSuffix = activeOffline ? " (offline)" : "";

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return {
    results,
    level,
    activeOffline,
    display: `${labelFor(settings.provider)} · ${settings.model}${offlineSuffix}`,
    refresh,
  };
}
