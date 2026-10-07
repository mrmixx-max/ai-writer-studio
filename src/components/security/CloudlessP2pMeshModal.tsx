// CloudlessP2pMeshModal (WP 91.2 UI)
import { useState, useMemo, useEffect } from "react";
import {
  createMeshConfig,
  createSampleStatus,
  createSampleDelta,
  type MeshConfig as _MeshConfig,
  type MeshStatus as _MeshStatus,
  type SyncDelta as _SyncDelta,
} from "@/services/security/cloudlessP2pMesh";

export interface CloudlessP2pMeshModalProps {
  className?: string;
}

export function CloudlessP2pMeshModal({ className }: CloudlessP2pMeshModalProps) {
  const [deviceName, setDeviceName] = useState("Mein Laptop");
  const [peerName, setPeerName] = useState("Desktop-PC");
  const [seed, setSeed] = useState(42);
  const [maxPeers, setMaxPeers] = useState(8);
  const [syncInterval, setSyncInterval] = useState(5000);
  const [initialized, setInitialized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const _config = useMemo(() => createMeshConfig(), []);
  const sampleStatus = useMemo(() => createSampleStatus(), []);
  const sampleDelta = useMemo(() => createSampleDelta(), []);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Simuliere Initialisierung
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialized(true);
      addLog(`Gerät "${deviceName}" initialisiert (Seed: ${seed})`);
      addLog(`Device ID: ${sampleStatus.deviceId}`);
    }, 500);
    return () => clearTimeout(timer);
  }, [deviceName, seed]);

  // Simuliere Verbindung
  useEffect(() => {
    if (initialized && !connected) {
      const timer = setTimeout(() => {
        setConnected(true);
        addLog(`Verbunden mit "${peerName}" (WebRTC DataChannel offen)`);
        addLog(`Sync-Delta gesendet: ${sampleDelta.id}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [initialized, connected]);

  const handleConnect = () => {
    if (!initialized) return;
    setConnected(false);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] Verbindungsaufbau zu "${peerName}"...`, ...prev.slice(0, 49)]);
    setTimeout(() => {
      setConnected(true);
      addLog(`Verbunden mit "${peerName}" (WebRTC DataChannel offen)`);
      addLog(`ICE-Kandidaten ausgetauscht (STUN: stun.l.google.com:19302)`);
      addLog(`Sync-Delta gesendet: ${sampleDelta.id}`);
    }, 1000);
  };

  const handleSync = () => {
    if (!connected) return;
    const newDelta = { ...sampleDelta, id: `DELTA-${Math.random().toString(16).slice(2, 10).toUpperCase()}`, timestamp: new Date().toISOString() };
    addLog(`Delta erstellt: ${newDelta.id} (${newDelta.operation} @ pos ${newDelta.position})`);
    addLog(`Delta an ${sampleStatus.connectedPeers} Peer(s) verteilt`);
    addLog(`Vector Clock aktualisiert: ${JSON.stringify(newDelta.vectorClock)}`);
  };

  const handleDisconnect = () => {
    setConnected(false);
    addLog(`Verbindung zu "${peerName}" getrennt`);
  };

  return (
    <div
      className={className}
      data-testid="cloudless-p2p-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔐 Cloud-freies P2P-Mesh & Lokaler Sync
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        100% lokal · Keine Cloud · WebRTC · AES-GCM · CRDT
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚙️ KONFIGURATION
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 }}>
            Gerätename
            <input value={deviceName} onChange={e => setDeviceName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 }}>
            Peer-Name (Ziel)
            <input value={peerName} onChange={e => setPeerName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Seed
            <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Max Peers
            <input type="number" value={maxPeers} onChange={e => setMaxPeers(Math.min(16, Math.max(1, Number(e.target.value) || 1)))} min="1" max="16" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
            Sync-Intervall (ms)
            <input type="number" value={syncInterval} onChange={e => setSyncInterval(Math.max(1000, Number(e.target.value) || 1000))} min="1000" step="1000" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📱 GERÄTE-STATUS
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ padding: 10, border: `1px solid ${connected ? "var(--success)" : "var(--border)"}`, borderRadius: 4, background: connected ? "rgba(0,255,0,0.05)" : "var(--panel)", minWidth: 180 }}>
            <div style={{ fontWeight: 700, color: "var(--accent)" }}>
              {initialized ? "✅ Initialisiert" : "⏳ Initialisiere..."}
            </div>
            <div style={{ marginTop: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}>
              Name: {deviceName}
            </div>
            <div style={{ marginTop: 2, fontSize: 10, fontFamily: "var(--font-mono)" }}>
              ID: {sampleStatus.deviceId}
            </div>
            <div style={{ marginTop: 2, fontSize: 10, fontFamily: "var(--font-mono)" }}>
              Rolle: Initiator
            </div>
            <div style={{ marginTop: 2, fontSize: 10, fontFamily: "var(--font-mono)" }}>
              Public Key: {sampleStatus.deviceId.slice(-8)}... (ECDH P-256)
            </div>
          </div>
          <div style={{ padding: 10, border: `1px solid ${connected ? "var(--success)" : "var(--border)"}`, borderRadius: 4, background: connected ? "rgba(0,255,0,0.05)" : "var(--panel)", minWidth: 180 }}>
            <div style={{ fontWeight: 700, color: connected ? "var(--success)" : "var(--muted)" }}>
              {connected ? "🟢 Verbunden" : "🔴 Getrennt"}
            </div>
            <div style={{ marginTop: 4, fontSize: 10 }}>
              Peer: {peerName}
            </div>
            <div style={{ marginTop: 2, fontSize: 10 }}>
              DataChannel: {connected ? "Offen (ordered)" : "Geschlossen"}
            </div>
            <div style={{ marginTop: 2, fontSize: 10 }}>
              Verschlüsselung: AES-GCM 256-bit
            </div>
            <div style={{ marginTop: 2, fontSize: 10 }}>
              Key Exchange: ECDH P-256
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎮 STEUERUNG
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleConnect}
            disabled={!initialized || connected}
            style={{
              padding: "8px 16px",
              background: connected ? "var(--panel)" : "var(--accent)",
              color: connected ? "var(--fg)" : "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: connected ? "not-allowed" : "pointer",
              fontSize: 11,
            }}
          >
            {connected ? "✅ Verbunden" : initialized ? "🔗 Verbinden" : "⏳ Initialisiere..."}
          </button>
          <button
            onClick={handleSync}
            disabled={!connected}
            style={{
              padding: "8px 16px",
              background: connected ? "var(--success)" : "var(--panel)",
              color: connected ? "var(--bg)" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: connected ? "pointer" : "not-allowed",
              fontSize: 11,
            }}
          >
            🔄 Sync Delta senden
          </button>
          <button
            onClick={handleDisconnect}
            disabled={!connected}
            style={{
              padding: "8px 16px",
              background: "var(--error)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 4,
              cursor: connected ? "pointer" : "not-allowed",
              fontSize: 11,
            }}
          >
            ❌ Trennen
          </button>
          <button
            onClick={() => { setInitialized(false); setConnected(false); setLogs([]); }}
            style={{
              padding: "8px 16px",
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            🔄 Neu initialisieren
          </button>
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 AKTIVITÄTS-LOG ({logs.length})
        </summary>
        <div style={{ marginTop: 8, maxHeight: 200, overflow: "auto", fontSize: 10, fontFamily: "var(--font-mono)", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
          {logs.length === 0 ? (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>
              Noch keine Aktivität. Gerät initialisieren und verbinden.
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid var(--border)", whiteSpace: "pre-wrap" }}>
                {log}
              </div>
            ))
          )}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📦 BEISPIEL-SYNC-DELTA (CRDT)
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {JSON.stringify(sampleDelta, null, 2)}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 ARCHITEKTUR & SICHERHEIT
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Zero-Knowledge:</strong> Alle Daten E2E-verschlüsselt (AES-GCM). Keys nie das Gerät verlassen.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Key Exchange:</strong> ECDH über P-256 Kurve. Perfect Forward Secrecy.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>CRDT (Conflict-free Replicated Data Type):</strong> Vector Clocks für konfliktfreies Merge zeitgleicher Änderungen.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Transport:</strong> WebRTC DataChannels (ordered, reliable). STUN/TURN für NAT-Traversal.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Lokal only:</strong> Kein Cloud-Server. Direkte P2P-Verbindung im LAN/WLAN.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Sync-Intervall:</strong> Konfigurierbar (Default 5s). Batch-Updates für Effizienz.
          </div>
          <div>
            <strong>Max Peers:</strong> Default 8 (Mesh-Topologie). Erhöhbar für größere Teams.
          </div>
        </div>
      </details>
    </div>
  );
}