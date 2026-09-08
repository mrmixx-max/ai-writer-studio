// Session-Panel (Sprint 24, Agent 3): Session-Liste, Speichern (mit
// Name-Dialog), Laden, Loeschen, Umbenennen, Session-Vorschau
// (Projekt, offene Tabs) und letzte Sessions (Quick-Load).
// Bloomberg-Terminal-Stil (Inline-Styles — kein neues CSS-Asset noetig).
// Der Manager ist per Prop injizierbar (Tests/Storybook), Default: echter Manager.
import { useCallback, useEffect, useState } from "react";
import {
  saveSession,
  loadSession,
  getSessions,
  deleteSession,
  renameSession,
  restoreState,
  type Session,
} from "@/services/session/sessionManager";

export interface SessionManagerClient {
  saveSession: (name: string) => Promise<Session>;
  loadSession: (id: string) => Promise<Session>;
  getSessions: () => Promise<Session[]>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  restoreState: (session: Session) => Promise<void>;
}

const DEFAULT_CLIENT: SessionManagerClient = {
  saveSession,
  loadSession,
  getSessions,
  deleteSession,
  renameSession,
  restoreState,
};

const TERM: React.CSSProperties = {
  background: "#000",
  color: "#ffa028",
  fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #333",
};

const BTN: React.CSSProperties = {
  background: "#000",
  color: "#ffa028",
  border: "1px solid #ffa028",
  borderRadius: 4,
  padding: "4px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};

const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  border: "1px solid #333",
  color: "#ffa028",
  opacity: 0.85,
};

const INPUT: React.CSSProperties = {
  background: "#000",
  color: "#ffa028",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "4px 8px",
  fontFamily: "inherit",
  fontSize: 12,
  minWidth: 0,
  flex: 1,
};

const ITEM: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 4,
  padding: "6px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const ITEM_ACTIVE: React.CSSProperties = {
  ...ITEM,
  border: "1px solid #ffa028",
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export interface SessionPanelProps {
  manager?: SessionManagerClient;
}

export function SessionPanel({ manager = DEFAULT_CLIENT }: SessionPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await manager.getSessions();
      setSessions(all);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [manager]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const quickLoad = sessions.slice(0, 3);

  async function handleSave() {
    const name = nameInput.trim();
    if (!name) {
      setError("Bitte einen Session-Namen eingeben.");
      return;
    }
    try {
      const created = await manager.saveSession(name);
      setNameInput("");
      setShowSaveDialog(false);
      setSelectedId(created.id);
      setNotice(`Gespeichert: ${created.name}`);
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleLoad(id: string) {
    try {
      const session = await manager.loadSession(id);
      await manager.restoreState(session);
      setSelectedId(id);
      setNotice(`Geladen: ${session.name}`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(id: string) {
    try {
      await manager.deleteSession(id);
      if (selectedId === id) setSelectedId(null);
      setNotice(null);
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRename() {
    if (!selected) return;
    const name = renameInput.trim();
    if (!name) {
      setError("Bitte einen neuen Namen eingeben.");
      return;
    }
    try {
      await manager.renameSession(selected.id, name);
      setRenameInput("");
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={TERM} data-testid="session-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong data-testid="session-title">💾 Sessions</strong>
        <span data-testid="session-count" style={{ opacity: 0.8 }}>
          {sessions.length}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={BTN}
          data-testid="session-save-open"
          onClick={() => setShowSaveDialog((v) => !v)}
        >
          Speichern
        </button>
      </div>

      {showSaveDialog && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }} data-testid="session-save-dialog">
          <input
            style={INPUT}
            data-testid="session-name-input"
            placeholder="Session-Name…"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
          />
          <button type="button" style={BTN} data-testid="session-save-confirm" onClick={() => void handleSave()}>
            OK
          </button>
        </div>
      )}

      {quickLoad.length > 0 && (
        <div style={{ marginBottom: 8 }} data-testid="session-quickload">
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Zuletzt:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {quickLoad.map((s) => (
              <button
                key={s.id}
                type="button"
                style={BTN_GHOST}
                data-testid={`session-quick-${s.id}`}
                onClick={() => void handleLoad(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div style={{ opacity: 0.7 }} data-testid="session-empty">
          Keine Sessions — oben speichern.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-testid="session-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              style={s.id === selectedId ? ITEM_ACTIVE : ITEM}
              data-testid={`session-item-${s.id}`}
              onClick={() => setSelectedId(s.id)}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <strong>{s.name}</strong>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  style={BTN}
                  data-testid={`session-load-${s.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleLoad(s.id);
                  }}
                >
                  Laden
                </button>
                <button
                  type="button"
                  style={BTN_GHOST}
                  data-testid={`session-delete-${s.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(s.id);
                  }}
                >
                  Löschen
                </button>
              </div>
              <div style={{ opacity: 0.7, fontSize: 11 }}>
                {formatTime(s.updatedAt)} · {s.openTabs.length} Tab(s)
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 8, ...ITEM }} data-testid="session-preview">
          <div>
            <strong>Vorschau: {selected.name}</strong>
          </div>
          <div data-testid="session-preview-project">
            Projekt: {selected.projectId || "—"}
          </div>
          <div data-testid="session-preview-tabs">
            Tabs: {selected.openTabs.length > 0 ? selected.openTabs.join(", ") : "—"}
          </div>
          {selected.activeTab && <div>Aktiv: {selected.activeTab}</div>}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              style={INPUT}
              data-testid="session-rename-input"
              placeholder="Neuer Name…"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRename();
              }}
            />
            <button
              type="button"
              style={BTN}
              data-testid="session-rename-confirm"
              onClick={() => void handleRename()}
            >
              Umbenennen
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div style={{ marginTop: 8, opacity: 0.9 }} data-testid="session-notice">
          {notice}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, color: "#ff5f56" }} data-testid="session-error">
          {error}
        </div>
      )}
    </div>
  );
}
