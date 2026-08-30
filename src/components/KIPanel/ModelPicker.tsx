// ModelPicker: jederzeitige Modell-Auswahl im KI-Panel-Header.
// Zeigt das aktive Modell (Provider · Modell), öffnet beim Klick die Liste
// aller entdeckten Modelle gruppiert nach Anbieter und bietet einen
// "Aktualisieren"-Button mit Spin-Animation. Offline-Zustand: Suffix
// "(offline)" und deaktivierte Liste.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings } from "@/types/config";
import type { ProviderId } from "@/types/llm";
import {
  discoverModels,
  labelFor,
  type DiscoveredModels,
} from "@/services/llm/modelRegistry";

interface ModelPickerProps {
  settings: AppSettings;
  /** Wird bei Auswahl aufgerufen; der Aufrufer schreibt provider+model. */
  onSelect: (provider: ProviderId, model: string) => void;
  /** "badge": dezente Darstellung für die Editor-Kopfzeile (gleiches Popover). */
  variant?: "default" | "badge";
  /** Optionale stabile ID für den Toggle-Button (z. B. Ziel von Strg+Shift+M). */
  toggleId?: string;
}

export function ModelPicker({ settings, onSelect, variant = "default", toggleId }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<DiscoveredModels[] | null>(null);
  // loading: sichtbarer Ladezustand (Spinner statt Liste) beim Öffnen/Refresh.
  // refreshing: stiller Hintergrund-Poll (10 s), Liste bleibt sichtbar.
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (force: boolean, signal?: AbortSignal) => {
      if (force || results === null) setLoading(true);
      else setRefreshing(true);
      try {
        const r = await discoverModels(settings, { force, signal });
        if (signal?.aborted) return;
        setResults(r);
      } catch {
        // Wirft nie — zur Sicherheit trotzdem abfangen.
        if (!signal?.aborted) setResults([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [settings, results],
  );

  // Beim Mount (und wenn sich die Einstellungen ändern) erkennen.
  useEffect(() => {
    const ctrl = new AbortController();
    void load(false, ctrl.signal);
    return () => ctrl.abort();
  }, [settings]);

  // Offenes Menü: sofortiger Refresh (keine Cache-Werte) + Polling alle 10 s,
  // damit neue Modelle (z. B. nach "ollama pull") innerhalb von 10 s erscheinen.
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    void load(true, signal);
    const interval = window.setInterval(() => {
      if (!signal.aborted) void load(false, signal);
    }, 10_000);
    return () => {
      ctrl.abort();
      window.clearInterval(interval);
    };
  }, [open, settings]);

  // Klick außerhalb / Escape schließt das Menü.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeResult = results?.find((r) => r.provider === settings.provider) ?? null;
  const activeOffline = activeResult !== null && !activeResult.reachable;
  // Liste deaktivieren, wenn nichts erreichbar ist.
  const listDisabled = results !== null && !results.some((r) => r.reachable && r.models.length > 0);

  return (
    <div className={`ki-model-picker${variant === "badge" ? " ki-model-picker-badge" : ""}`} ref={rootRef}>
      <div className="ki-model-picker-row">
        <button
          type="button"
          id={toggleId}
          className="ki-model-picker-toggle"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          title="Aktives Modell wechseln"
        >
          <span className="ki-model-picker-active">
            {variant === "badge" ? (
              <span className="ki-model-picker-bolt" aria-hidden="true">
                ⚡{" "}
              </span>
            ) : null}
            {labelFor(settings.provider)} · {settings.model.split("/").pop()?.split(":")[0] ?? settings.model}
            {activeOffline ? " (offline)" : ""}
          </span>
          <span className="ki-model-picker-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        <button
          type="button"
          className={`ki-model-picker-refresh${loading ? " spinning" : ""}`}
          onClick={() => void load(true)}
          disabled={loading}
          title="Modelle neu laden"
          aria-label="Modelle aktualisieren"
        >
          ⟳
        </button>
      </div>

      {open && (
        <div className="ki-model-menu" role="listbox" aria-label="Verfügbare Modelle">
          {/* Ladezustand: Spinner statt veraltete Liste (Öffnen/Aktualisieren). */}
          {loading && (
            <p className="ki-model-menu-hint" role="status" aria-live="polite">
              <span className="ki-model-menu-spinner" aria-hidden="true">
                ⟳
              </span>{" "}
              Suche nach Modellen…
            </p>
          )}
          {!loading && results === null && (
            <p className="ki-model-menu-hint">Suche nach Modellen…</p>
          )}
          {!loading && refreshing && (
            <p className="ki-model-menu-hint" role="status" aria-live="polite">
              Aktualisiere…
            </p>
          )}
          {!loading && results !== null && listDisabled && (
            <p className="ki-model-menu-hint">
              Kein Anbieter erreichbar. Lokale Modelle starten (z. B. „ollama serve“) und
              aktualisieren.
            </p>
          )}
          {!loading &&
            results
              ?.filter((r) => r.reachable && r.models.length > 0)
              .map((r) => (
              <div key={r.provider} className="ki-model-group">
                <p className="ki-model-group-label">
                  {r.label}
                  {typeof r.latencyMs === "number" ? ` · ${r.latencyMs} ms` : ""}
                </p>
                {r.models.map((m) => {
                  const isActive = r.provider === settings.provider && m === settings.model;
                  return (
                    <button
                      key={`${r.provider}:${m}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`ki-model-option${isActive ? " active" : ""}`}
                      onClick={() => {
                        onSelect(r.provider, m);
                        setOpen(false);
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
