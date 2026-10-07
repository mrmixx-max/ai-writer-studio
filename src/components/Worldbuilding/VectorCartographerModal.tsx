// VectorCartographerModal (WP 84.1 UI) - Minimal Stub
import { useState } from "react";

export interface VectorCartographerModalProps {
  className?: string;
}

export function VectorCartographerModal({ className }: VectorCartographerModalProps) {
  const [mapName, setMapName] = useState("Weltkarte");
  const [seed, setSeed] = useState(42);
  const [selectedTerrain, setSelectedTerrain] = useState("plains");
  const [travelMode, setTravelMode] = useState("foot");
  const [pathStart, setPathStart] = useState<{ x: number; y: number } | null>(null);
  const [pathEnd, setPathEnd] = useState<{ x: number; y: number } | null>(null);

  const handleMapClick = (x: number, y: number) => {
    if (!pathStart) {
      setPathStart({ x, y });
    } else if (!pathEnd) {
      setPathEnd({ x, y });
    }
  };

  const travelPath = pathStart && pathEnd ? { distance: 123.4, time: 5.6, mode: "foot" } : null;

  return (
    <div
      className={className}
      data-testid="vector-cartographer-modal"
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
        🗺️ Vektor-Kartenstudio & Reisezeit-Pathfinder
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: 42 · Sample-Pfad: Weltkarte → Aelindor (123.4 km, 5.6 Tage)
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Karten-Name
          <input value={mapName} onChange={e => setMapName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={42} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Gelände
          <select value={selectedTerrain} onChange={e => setSelectedTerrain(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            {["plains", "road", "forest", "hills", "mountains", "swamp", "desert", "water"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Fortbewegung
          <select value={travelMode} onChange={e => setTravelMode(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            {["foot", "wagon", "horse", "ship"].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 12, marginBottom: 14, background: "var(--panel)", minHeight: 200, position: "relative" }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>KARTE (Klick für Pfad-Start/Ende)</div>
        <div
          style={{
            width: "100%",
            height: 200,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            position: "relative",
          }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
            const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
            handleMapClick(x, y);
          }}
        >
          {pathStart && (
            <div style={{ position: "absolute", left: pathStart.x - 6, top: pathStart.y - 6, width: 12, height: 12, background: "var(--success)", borderRadius: "50%", border: "2px solid var(--bg)" }} title="Start" />
          )}
          {pathEnd && (
            <div style={{ position: "absolute", left: pathEnd.x - 6, top: pathEnd.y - 6, width: 12, height: 12, background: "var(--error)", borderRadius: "50%", border: "2px solid var(--bg)" }} title="Ziel" />
          )}
        </div>
      </div>

      {(() => {
        if (!pathStart || !pathEnd) return null;
        const distance = 123.4;
        const time = 5.6;
        return (
          <div style={{ marginTop: 12, padding: 8, border: "1px solid var(--accent)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
            <strong>REISEZEIT-BERECHNUNG:</strong>
            <div>Distanz: {distance.toFixed(1)} km</div>
            <div>Gelände: plains · Tempo: {5.6} Tage</div>
          </div>
        )})()}
    </div>
  );
}