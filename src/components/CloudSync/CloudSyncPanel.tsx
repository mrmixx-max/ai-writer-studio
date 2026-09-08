// CloudSync-Panel (Sprint 24, Agent 1): Provider-Auswahl (Dropbox, Google
// Drive, OneDrive, WebDAV), Zugangsdaten-Eingabe, Verbindungstest, Sync-Button,
// Sync-Status, Auto-Sync-Toggle, Sync-Intervall-Eingabe.
// Bloomberg-Terminal-Stil (Inline-Styles): bg #000, accent #ffa028, border #333,
// Monospace (IBM Plex). Client per Prop injizierbar (Tests), Default: Engine.
import { useState } from "react";
import {
  configureCloudSync,
  syncAll as engineSyncAll,
  testConnection as engineTestConnection,
  getRemoteFiles as engineGetRemoteFiles,
  type CloudConfig,
  type CloudProvider,
  type SyncResult,
} from "@/services/cloud/cloudSync";

export interface CloudSyncClient {
  testConnection: (config: CloudConfig) => Promise<boolean>;
  syncAll: (config: CloudConfig) => Promise<SyncResult>;
  getRemoteFiles: (config: CloudConfig) => Promise<{ name: string; modified: number }[]>;
}

const DEFAULT_CLIENT: CloudSyncClient = {
  testConnection: (c) => engineTestConnection(c),
  syncAll: (c) => engineSyncAll(c),
  getRemoteFiles: (c) => engineGetRemoteFiles(c),
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
  background: "#1a1206",
  color: "#ffa028",
  border: "1px solid #ffa028",
  borderRadius: 4,
  padding: "4px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};

const INPUT: React.CSSProperties = {
  background: "#0d0d0d",
  color: "#ffa028",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "4px 8px",
  fontFamily: "inherit",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};

const PROVIDERS: { id: CloudProvider; label: string }[] = [
  { id: "dropbox", label: "Dropbox" },
  { id: "google-drive", label: "Google Drive" },
  { id: "onedrive", label: "OneDrive" },
  { id: "webdav", label: "WebDAV" },
];

export interface CloudSyncPanelProps {
  client?: CloudSyncClient;
}

export function CloudSyncPanel({ client = DEFAULT_CLIENT }: CloudSyncPanelProps) {
  const [provider, setProvider] = useState<CloudProvider>("dropbox");
  const [accessToken, setAccessToken] = useState("");
  const [syncFolder, setSyncFolder] = useState("/AIWriterStudio");
  const [autoSync, setAutoSync] = useState(false);
  const [interval, setInterval] = useState(15);
  const [busy, setBusy] = useState(false);
  const [connState, setConnState] = useState<"idle" | "ok" | "fail">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [remoteCount, setRemoteCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildConfig(): CloudConfig {
    return { provider, accessToken, syncFolder, autoSync, syncInterval: interval };
  }

  async function handleTest() {
    setBusy(true);
    setError(null);
    try {
      const ok = await client.testConnection(buildConfig());
      setConnState(ok ? "ok" : "fail");
      if (!ok) setError("Verbindung fehlgeschlagen — Token und Ordner prüfen.");
    } catch (e) {
      setConnState("fail");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setError(null);
    try {
      const cfg = buildConfig();
      configureCloudSync(cfg);
      const files = await client.getRemoteFiles(cfg);
      setRemoteCount(files.length);
      const r = await client.syncAll(cfg);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={TERM} data-testid="cloudsync-panel">
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>☁️ Cloud Sync</h3>

      <label style={{ display: "block", marginBottom: 8 }}>
        Provider
        <select
          data-testid="cloudsync-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as CloudProvider)}
          style={{ ...INPUT, marginTop: 4 }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "block", marginBottom: 8 }}>
        Access Token
        <input
          data-testid="cloudsync-token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Token einfügen…"
          style={{ ...INPUT, marginTop: 4 }}
        />
      </label>

      <label style={{ display: "block", marginBottom: 8 }}>
        Sync-Ordner
        <input
          data-testid="cloudsync-folder"
          type="text"
          value={syncFolder}
          onChange={(e) => setSyncFolder(e.target.value)}
          style={{ ...INPUT, marginTop: 4 }}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input
          data-testid="cloudsync-autosync"
          type="checkbox"
          checked={autoSync}
          onChange={(e) => setAutoSync(e.target.checked)}
        />
        Auto-Sync
      </label>

      <label style={{ display: "block", marginBottom: 8 }}>
        Sync-Intervall (Min.)
        <input
          data-testid="cloudsync-interval"
          type="number"
          min={1}
          value={interval}
          onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
          style={{ ...INPUT, marginTop: 4 }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button data-testid="cloudsync-test" style={BTN} onClick={handleTest} disabled={busy}>
          ⏱ Verbindung testen
        </button>
        <button data-testid="cloudsync-sync" style={BTN} onClick={handleSync} disabled={busy}>
          ⏱ Sync starten
        </button>
      </div>

      {connState !== "idle" && (
        <div data-testid="cloudsync-conn" style={{ marginBottom: 8 }}>
          {connState === "ok" ? "✅ Verbunden" : "❌ Keine Verbindung"}
        </div>
      )}

      <div data-testid="cloudsync-status" style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
        {result ? (
          <>
            <div data-testid="cloudsync-last">Letzter Sync: {new Date(result.lastSync).toLocaleString()}</div>
            <div data-testid="cloudsync-uploaded">Upload: {result.uploaded}</div>
            <div data-testid="cloudsync-downloaded">Download: {result.downloaded}</div>
            <div data-testid="cloudsync-conflicts">Konflikte: {result.conflicts}</div>
            {remoteCount !== null && <div data-testid="cloudsync-remote">Remote-Dateien: {remoteCount}</div>}
          </>
        ) : (
          <div data-testid="cloudsync-idle">Noch kein Sync durchgeführt.</div>
        )}
      </div>

      {error && (
        <div data-testid="cloudsync-error" style={{ color: "#ff5c5c", marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
