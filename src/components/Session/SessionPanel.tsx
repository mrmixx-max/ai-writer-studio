// SessionPanel (Sprint 24, Agent 3): Sitzungen speichern/laden.
// Bloomberg-Terminal-Stil (Inline-Styles — kein neues CSS-Asset nötig).
// Service-Funktionen sind per Props injizierbar (Tests), Defaults: sessionManager.
import { useCallback, useEffect, useState } from "react";
import {
  deleteSession as defaultDelete,
  getSessions as defaultList,
  loadSession as defaultLoad,
  renameSession as defaultRename,
  restoreState as defaultRestore,
  saveSession as defaultSave,
  type Session,
} from "@/services/session/sessionManager";

const TERM: React.CSSProperties = {
  background: "#0a0e14",
  color: "#ffb000",
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #2a3340",
};

const BTN: React.CSSProperties = {
  background: "#131a24",
  color: "#ffb000",
  border: "1px solid #ffb000",
  borderRadius: 4,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};

export interface SessionPanelDeps {
  list?: () => Promise<Session[]>;
  save?: (name: string) => Promise<Session>;
  load?: (id: string) => Promise<Session>;
  remove?: (id: string) => Promise<void>;
  rename?: (id: string, name: string) => Promise<void>;
  restore?: (s: Session) => Promise<void>;
  promptName?: (label: string, initial?: string) => string | null;
}

export function SessionPanel(deps: SessionPanelDeps = {}) {
  const {
    list = defaultList,
    save = defaultSave,
    load = defaultLoad,
    remove = defaultDelete,
    rename = defaultRename,
    restore = defaultRestore,
    promptName = (label, initial) =>
      typeof window !== "undefined" && typeof window.prompt === "function"
        ? window.prompt(label, initial ?? "")
        : null,
  } = deps;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await list();
      setSessions(all);
      if (all.length > 0 && !selectedId) setSelectedId(all[0].id);
      if (selectedId && !all.some((s) => s.id === selectedId)) {
        setSelectedId(all.length > 0 ? all[0].id : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const recent = sessions.slice(0, 3);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={TERM} data-testid="session-panel">
      <div style={{ fontWeight: 700, marginBottom: 8 }} data-testid="session-title">
        💾 SESSIONS
      </div>

      {error && (
        <div style={{ color: "#ff5555", marginBottom: 8 }} data-testid="session-error">
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button
          style={BTN}
          data-testid="session-save"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const name = promptName("Session-Name:", `Session ${sessions.length + 1}`);
              if (!name || !name.trim()) return;
              const created = await save(name.trim());
              setSelectedId(created.id);
            })
          }
        >
          💾 Speichern
        </button>
        <button
          style={BTN}
          data-testid="session-load"
          disabled={busy || !selected}
          onClick={() =>
            run(async () => {
              if (!selected) return;
              const s = await load(selected.id);
              await restore(s);
            })
          }
        >
          📂 Laden
        </button>
        <button
          style={BTN}
          data-testid="session-delete"
          disabled={busy || !selected}
          onClick={() =>
            run(async () => {
              if (!selected) return;
              await remove(selected.id);
              setSelectedId(null);
            })
          }
        >
          🗑 Löschen
        </button>
        <button
          style={BTN}
          data-testid="session-rename"
          disabled={busy || !selected}
          onClick={() =>
            run(async () => {
              if (!selected) return;
              const name = promptName("Neuer Name:", selected.name);
              if (!name || !name.trim()) return;
              await rename(selected.id, name.trim());
            })
          }
        >
          ✎ Umbenennen
        </button>
      </div>

      <div style={{ marginBottom: 6, color: "#5fff87" }} data-testid="session-count">
        {sessions.length} Sitzung(en)
      </div>

      {sessions.length === 0 ? (
        <div style={{ opacity: 0.8 }} data-testid="session-empty">
          Keine Sessions — oben speichern.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }} data-testid="session-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              data-testid={`session-item-${s.id}`}
              onClick={() => setSelectedId(s.id)}
              style={{
                padding: "6px 8px",
                marginBottom: 4,
                border: s.id === selectedId ? "1px solid #ffb000" : "1px solid #2a3340",
                borderRadius: 4,
                background: s.id === selectedId ? "#1a1405" : "transparent",
                cursor: "pointer",
              }}
            >
              <span data-testid={`session-name-${s.id}`}>{s.name}</span>{" "}
              <span style={{ opacity: 0.7, fontSize: 11 }}>
                · {s.openTabs.length} Tab(s) · {new Date(s.updatedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 4, color: "#5fff87" }} data-testid="session-recent-title">
            ⚡ Letzte Sessions (Quick-Load)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {recent.map((s) => (
              <button
                key={s.id}
                style={BTN}
                data-testid={`session-quick-${s.id}`}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const full = await load(s.id);
                    await restore(full);
                  })
                }
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div
          style={{ marginTop: 10, borderTop: "1px solid #2a3340", paddingTop: 8 }}
          data-testid="session-preview"
        >
          <div style={{ fontWeight: 700 }} data-testid="session-preview-title">
            Vorschau: {selected.name}
          </div>
          <div data-testid="session-preview-project">Projekt: {selected.projectId || "—"}</div>
          <div data-testid="session-preview-tabs">
            Tabs ({selected.openTabs.length}):{" "}
            {selected.openTabs.length > 0 ? selected.openTabs.join(", ") : "—"}
          </div>
          {selected.activeTab && (
            <div data-testid="session-preview-active">Aktiv: {selected.activeTab}</div>
          )}
        </div>
      )}
    </div>
  );
}
