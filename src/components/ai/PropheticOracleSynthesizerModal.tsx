// PropheticOracleSynthesizerModal (WP 106.1 UI)
import { useState, useMemo } from "react";
import {
  analyzeOracle,
  ORACLE_ARCHETYPES,
  type OracleArchetypeId,
} from "@/services/ai/propheticOracleSynthesizer";

export interface PropheticOracleSynthesizerModalProps {
  className?: string;
}

export function PropheticOracleSynthesizerModal({ className }: PropheticOracleSynthesizerModalProps) {
  const [seed, setSeed] = useState(42);
  const [selected, setSelected] = useState<OracleArchetypeId[]>([
    "pythianTrance",
    "ironDecree",
    "ominousWarning",
    "paradox",
  ]);

  const report = useMemo(() => analyzeOracle(selected, seed), [selected, seed]);

  function toggle(id: OracleArchetypeId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div
      className={className}
      data-testid="prophetic-oracle-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔮 Pythisches Orakel- &amp; Prophezeiungs-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Bericht {report.id} · {report.prophecies.length} Prophezeiungen · Ø Fehldeutung {report.averageMisreading}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🏛️ ORAKEL-ARCHETYPEN ({selected.length} aktiv)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ORACLE_ARCHETYPES.map((a) => {
            const active = selected.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  cursor: "pointer",
                  borderRadius: 4,
                  background: active ? "var(--accent)" : "var(--panel)",
                  color: active ? "var(--bg)" : "var(--fg)",
                  border: "1px solid var(--border)",
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </details>

      {report.prophecies.map((p) => (
        <details key={p.id} style={{ marginBottom: 12 }} open>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            📜 {p.archetype.name}
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <pre style={{ margin: 0, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.7 }}>
              {p.verse.text}
            </pre>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {p.verse.syllables} Silben · {p.verse.feet.length} Füße · Zäsur nach Fuß {p.verse.caesuraAfterFoot} · Fehldeutung {(p.misreadingProbability * 100).toFixed(0)}%
            </div>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>HERMENEUTISCHE DOPPEL-MATRIX</div>
              <div><strong>Oberflächen-Glaube:</strong> {p.matrix.surfaceBelief}</div>
              <div><strong>Wahre Erfüllung:</strong> {p.matrix.trueFulfilment}</div>
              <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 4 }}><strong>Angelpunkt:</strong> {p.matrix.pivot}</div>
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Methode: {p.archetype.method}
            </div>
          </div>
        </details>
      ))}

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 DOMINANTER ARCHETYP
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          {report.dominantArchetype
            ? `${ORACLE_ARCHETYPES.find((a) => a.id === report.dominantArchetype)?.name ?? report.dominantArchetype} — hier ist die Fehldeutung am wahrscheinlichsten.`
            : "Keine Archetypen ausgewählt."}
        </div>
      </details>
    </div>
  );
}
