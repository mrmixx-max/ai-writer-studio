// VictorianSeanceStudioModal (WP 116.2 UI, Meilenstein 56.0 / v6.8.0)
import { useState, useMemo } from "react";
import {
  SEANCE_APPARATUS,
  getSeanceApparatus,
  generateSupernaturalPhenomena,
  generateSpiritWriting,
  createSeanceSession,
  createSampleSeanceSession,
  createSampleSpiritMessage,
  type SeanceApparatusId,
} from "@/services/worldbuilding/victorianSeanceStudio";

export interface VictorianSeanceStudioModalProps {
  className?: string;
}

export function VictorianSeanceStudioModal({ className }: VictorianSeanceStudioModalProps) {
  const [seed, setSeed] = useState(42);
  const [selected, setSelected] = useState<SeanceApparatusId[]>([
    "planchette",
    "slateWriting",
    "tranceState",
  ]);

  const phenomena = useMemo(() => generateSupernaturalPhenomena(seed), [seed]);
  const writing = useMemo(() => generateSpiritWriting(seed), [seed]);
  const session = useMemo(() => createSeanceSession(selected, seed), [selected, seed]);

  function toggleApparatus(id: SeanceApparatusId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div
      className={className}
      data-testid="victorian-seance-modal"
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
        🔮 Viktorianisches Séance- &amp; Spiritismus-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Sitzung {session.id} · Seed {seed}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "4px 8px",
              fontSize: 11,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🕯️ SÉANCE-APPARATUREN ({SEANCE_APPARATUS.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {SEANCE_APPARATUS.map((a) => {
            const active = selected.includes(a.id);
            const found = getSeanceApparatus(a.id);
            return (
              <div
                key={a.id}
                style={{
                  padding: 10,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4,
                  background: "var(--panel)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong style={{ color: "var(--accent)" }}>{a.name}</strong>
                  <button
                    onClick={() => toggleApparatus(a.id)}
                    style={{
                      padding: "2px 8px",
                      fontSize: 10,
                      cursor: "pointer",
                      borderRadius: 4,
                      background: active ? "var(--accent)" : "var(--panel)",
                      color: active ? "var(--bg)" : "var(--fg)",
                      border: "1px solid var(--border)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {active ? "✓ aktiv" : "+ wählen"}
                  </button>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.6 }}>{a.description}</div>
                <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
                  ID: {a.id} · Epoche: {a.era} · Historische Echtheit:{" "}
                  {Math.round((found ? found.authenticity : a.authenticity) * 100)}%
                </div>
              </div>
            );
          })}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌀 PHÄNOMENE ({phenomena.phenomena.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {phenomena.phenomena.map((p, i) => (
            <div
              key={i}
              style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "var(--accent)" }}>{p.type}</strong>
                <span style={{ color: p.intensity >= 7 ? "var(--error)" : "var(--success)", fontWeight: 700 }}>
                  Intensität {p.intensity}/10
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6 }}>{p.description}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.6 }}>
          {phenomena.summary}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✍️ GEISTER-SCHREIBEN
        </summary>
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            background: "var(--panel)",
            letterSpacing: 1,
          }}
        >
          {writing.message}
        </pre>
        <div style={{ marginTop: 6, fontSize: 11 }}>
          <strong>Übertragung:</strong> {writing.translation}
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
          Sprache: {writing.language} · Dringlichkeit:{" "}
          <span style={{ color: writing.urgency === "high" ? "var(--error)" : "var(--muted)", fontWeight: 700 }}>
            {writing.urgency}
          </span>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              const s = createSampleSeanceSession();
              setSelected(s.apparatus.map((a) => a.id));
              setSeed(42);
            }}
            style={{
              padding: "6px 12px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--fg)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            Beispiel-Séance laden
          </button>
          <button
            onClick={() => {
              createSampleSpiritMessage();
              setSeed(42);
            }}
            style={{
              padding: "6px 12px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--fg)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            Beispiel-Geisterbotschaft laden
          </button>
        </div>
      </details>
    </div>
  );
}
