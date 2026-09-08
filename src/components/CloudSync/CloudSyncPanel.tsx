// Cloud-Sync-Panel (Sprint 24, Agent 1): Provider-Auswahl, Zugangsdaten,
// Verbindungstest, Sync mit Timer + Status, Auto-Sync-Toggle, Intervall.
// Bloomberg-Terminal-Stil (Inline-Styles — kein neues CSS-Asset noetig).
// Datei: src/components/CloudSync/CloudSyncPanel.tsx
import { useEffect, useRef, useState } from "react";
import {
  configureCloudSync,
  getLastSyncResult,
  syncAll,
  testConnection,
  type CloudProvider,
  type SyncResult,
} from "@/services/cloud/cloudSync";

const PROVIDERS: { id: CloudProvider; label: string }[] = [
  { id: "dropbox", label: "Dropbox" },
  { id: "google-drive", label: "Google Drive" },
  { id: "onedrive", label: "OneDrive" },
  { id: "webdav", label: "WebDAV" },
];

const TERM: React.CSSProperties = {
  background: "#0a0e14",
  color: "#ffb000",
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #2a3340",
};

const ROW: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 };

const INPUT: React.CSSProperties = {
  background: "#11161f",
  color: "#ffb000",
  border: "1px solid #2a3340",
  borderRadius: 4,
  padding: "6px 8px",
  fontFamily: "inherit",
  fontSize: 13,
};

const BTN: React.CSSProperties = {
  background: "#1a2230",
  color: "#ffb000",
  border: "1px solid #ffb000",
  borderRadius: 4,
  padding: "6px 12px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
};

const BTN_AMBER: React.CSSProperties = {
  ...BTN,
  background: "#ffb000",
  color: "#0a0e14",
  fontWeight: "bold",
};

export interface CloudSyncPanelProps {
  initialProvider?: CloudProvider;
}

export function CloudSyncPanel({ initialProvider = "dropbox" }: CloudSyncPanelProps) {
  const [provider, setProvider] = useState<CloudProvider>(initialProvider);
  const [accessToken, setAccessToken] = useState("");
  const [syncFolder, setSyncFolder] = useState("/Apps/Writer");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(15);
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SyncResult | null>(() => getLastSyncResult());
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  function currentConfig() {
    return { provider, accessToken, syncFolder, autoSync, syncInterval };
  }

  async function handleTestConnection() {
    setTesting(true);
    setError(null);
    try {
      configureCloudSync(currentConfig());
      const ok = await testConnection(currentConfig());
      setConnectionOk(ok);
    } catch (e) {
      setConnectionOk(false);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    const t0 = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    try {
      configureCloudSync(currentConfig());
      const r = await syncAll();
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      setSyncing(false);
    }
  }

  return (
    <div style={TERM} data-testid="cloudsync-panel">
      <div style={{ fontWeight: "bold", marginBottom: 10 }} data-testid="cloudsync-title">
        ☁️ CLOUD SYNC
      </div>

      <div style={ROW}>
        <label htmlFor="cloudsync-provider">Provider</label>
        <select
          id="cloudsync-provider"
          data-testid="cloudsync-provider-select"
          style={INPUT}
          value={provider}
          onChange={(e) => setProvider(e.target.value as CloudProvider)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id} data-testid={`cloudsync-provider-option-${p.id}`}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div style={ROW}>
        <label htmlFor="cloudsync-token">Access-Token</label>
        <input
          id="cloudsync-token"
          data-testid="cloudsync-token-input"
          type="password"
          style={INPUT}
          placeholder="Access-Token einfügen…"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />
      </div>

      <div style={ROW}>
        <label htmlFor="cloudsync-folder">Sync-Ordner</label>
        <input
          id="cloudsync-folder"
          data-testid="cloudsync-folder-input"
          type="text"
          style={INPUT}
          value={syncFolder}
          onChange={(e) => setSyncFolder(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          data-testid="cloudsync-test-connection"
          style={BTN}
          disabled={testing}
          onClick={handleTestConnection}
        >
          {testing ? "Teste…" : "Verbindung testen"}
        </button>
        <button
          type="button"
          data-testid="cloudsync-sync-button"
          style={BTN_AMBER}
          disabled={syncing}
          onClick={handleSync}
        >
          {syncing ? `Sync… ${(elapsed / 1000).toFixed(1)}s` : "⏱ Sync starten"}
        </button>
      </div>

      {connectionOk !== null && (
        <div
          data-testid="cloudsync-connection-status"
          style={{ color: connectionOk ? "#5fff87" : "#ff5555", marginBottom: 10 }}
        >
          {connectionOk ? "● Verbunden" : "● Keine Verbindung"}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            data-testid="cloudsync-autosync-toggle"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
          />
          Auto-Sync
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Intervall (Min.)
          <input
            type="number"
            data-testid="cloudsync-interval-input"
            style={{ ...INPUT, width: 70 }}
            min={1}
            max={1440}
            value={syncInterval}
            onChange={(e) => setSyncInterval(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      {result && (
        <div data-testid="cloudsync-status" style={{ borderTop: "1px solid #2a3340", paddingTop: 8 }}>
          <div>Letzter Sync: {new Date(result.lastSync).toLocaleString()}</div>
          <div>
            ▲ {result.uploaded} Upload · ▼ {result.downloaded} Download · ⚠ {result.conflicts} Konflikte
          </div>
        </div>
      )}

      {error && (
        <div data-testid="cloudsync-error" style={{ color: "#ff5555", marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
