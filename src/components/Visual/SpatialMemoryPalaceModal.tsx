// SpatialMemoryPalaceModal (WP 82.1)
//
// Interaktiver 3D-Spatial-Mind-Palace & Gedächtnispalast.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createSamplePalace,
  formatPalace,
  findUnresolvedContradictions,
  getArtifactsByType,
} from "@/services/visual/spatialMemoryPalace";

export interface SpatialMemoryPalaceModalProps {
  className?: string;
}

export function SpatialMemoryPalaceModal({ className }: SpatialMemoryPalaceModalProps) {
  const [activeRoomId, setActiveRoomId] = useState("room-1");

  const palace = useMemo(() => createSamplePalace(), []);
  const contradictions = useMemo(() => findUnresolvedContradictions(palace), [palace]);
  const clues = useMemo(() => getArtifactsByType(palace, "clue"), [palace]);

  const activeRoom = palace.rooms.find((r) => r.id === activeRoomId) ?? null;

  return (
    <div
      className={className}
      data-testid="spatial-memory-palace-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏛️ 3D-Spatial-Mind-Palace & Gedächtnispalast
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {palace.rooms.length} Räume · {palace.totalArtifacts} Artefakte · {contradictions.length} Widersprüche
      </div>

      {/* Raum-Auswahl */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {palace.rooms.map((room) => (
          <button
            key={room.id}
            data-testid={`palace-room-${room.id}`}
            onClick={() => setActiveRoomId(room.id)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: activeRoomId === room.id ? "var(--accent)" : "var(--panel)",
              color: activeRoomId === room.id ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {room.name}
          </button>
        ))}
      </div>

      {/* Aktiver Raum */}
      {activeRoom && (
        <div
          data-testid="palace-active-room"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>RAUM</div>
          <div style={{ color: "var(--accent)", fontWeight: 700 }}>{activeRoom.name}</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{activeRoom.description}</div>
          {activeRoom.artifacts.map((artifact) => (
            <div key={artifact.id} data-testid={`palace-artifact-${artifact.id}`} style={{ marginTop: 6 }}>
              <div style={{ color: "var(--accent)", fontWeight: 700 }}>
                {artifact.name} ({artifact.type})
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                Position: ({artifact.x}, {artifact.y}, {artifact.z})
              </div>
              {artifact.linkedArtifactIds.length > 0 && (
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  Verknüpft mit: {artifact.linkedArtifactIds.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Widersprüche */}
      <div
        data-testid="palace-contradictions"
        style={{
          border: `1px solid ${contradictions.length > 0 ? "var(--warn)" : "var(--success)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          UNGELÖSTE WIDERSPRÜCHE ({contradictions.length})
        </div>
        {contradictions.length === 0 ? (
          <div data-testid="palace-no-contradictions" style={{ color: "var(--success)" }}>
            ✓ Keine Widersprüche
          </div>
        ) : (
          contradictions.map((c, i) => (
            <div key={i} data-testid={`palace-contradiction-${i}`} style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--warn)" }}>●</span> {c}
            </div>
          ))
        )}
      </div>

      {/* Hinweise */}
      <div
        data-testid="palace-clues"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>HINWEISE ({clues.length})</div>
        {clues.map((clue) => (
          <div key={clue.id} data-testid={`palace-clue-${clue.id}`} style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>●</span> {clue.name}
          </div>
        ))}
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="palace-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="palace-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {formatPalace(palace)}
        </pre>
      </details>
    </div>
  );
}