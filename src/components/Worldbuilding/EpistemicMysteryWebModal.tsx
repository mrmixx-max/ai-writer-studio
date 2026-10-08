// EpistemicMysteryWebModal (WP 102.2 UI)
import { useState, useMemo } from "react";
import {
  analyzeMystery,
  createSampleMysteryCase,
  MYSTERY_LAYERS,
  FAIR_PLAY_RULES,
} from "@/services/worldbuilding/epistemicMysteryWeb";

export interface EpistemicMysteryWebModalProps {
  className?: string;
}

export function EpistemicMysteryWebModal({ className }: EpistemicMysteryWebModalProps) {
  const [title, setTitle] = useState("Der Fall im Archivflügel");
  const [selectedFinal, setSelectedFinal] = useState<string[]>(["c1", "c2", "c4", "c6"]);

  const caseData = useMemo(() => createSampleMysteryCase(), []);
  const analysis = useMemo(() => analyzeMystery(caseData, selectedFinal), [caseData, selectedFinal]);

  function toggleFinal(id: string) {
    setSelectedFinal((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div
      className={className}
      data-testid="epistemic-mystery-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔍 4-Schichten-Krimi-Matrix &amp; Fair-Play-Detektor
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Fall {analysis.id} · {analysis.suspectCount} Verdächtige · {analysis.clueCount} Hinweise · {analysis.redHerringCount} falsche Fährten
      </div>

      <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Falltitel
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
        />
      </label>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧩 EPISTEMISCHE SCHICHTEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {analysis.layerCoverage.map((cov) => {
            const layer = MYSTERY_LAYERS.find((l) => l.id === cov.layer);
            return (
              <div key={cov.layer} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "var(--accent)" }}>{layer?.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 10 }}>{cov.clueCount} Hinweise</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{layer?.question}</div>
                <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: "var(--bg)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(cov.coverage * 100)}%`, height: "100%", background: "var(--accent)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚖️ FAIR-PLAY-PRÜFUNG (KNOX'SCHE GEBOTE)
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: `2px solid ${analysis.verdict.solvable ? "var(--success)" : "var(--error)"}`, borderRadius: 8, background: "var(--panel)", marginBottom: 8, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: analysis.verdict.solvable ? "var(--success)" : "var(--error)" }}>
            {analysis.verdict.solvable ? "✓ FAIR PLAY — DER FALL IST LÖSBAR" : "✗ NICHT FAIR PLAY"}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Score {analysis.verdict.score}% · {analysis.verdict.culpritCluesInReaderView}/{analysis.verdict.totalCulpritClues} Täter-Hinweise in der Leser-Sicht
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {analysis.verdict.findings.map((f) => (
            <div key={f.ruleId} style={{ padding: 8, border: `1px solid ${f.passed ? "var(--border)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{f.ruleName}</span>
                <span style={{ color: f.passed ? "var(--success)" : "var(--error)", fontWeight: 700 }}>
                  {f.passed ? "✓ erfüllt" : "✗ verletzt"}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{f.detail}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗂️ HINWEISE &amp; FALSCHE FÄHRTEN ({caseData.clues.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {caseData.clues.map((c) => (
            <div key={c.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{c.label}</span>
                <span style={{ color: c.redHerring ? "var(--warn)" : "var(--muted)", fontSize: 10 }}>
                  {c.redHerring ? "falsche Fährte" : c.kind}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                Schichten: {c.layers.join(", ")}
                {c.pointsToCulprit ? " · zeigt auf den Täter" : ""}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎬 FINALBEWEISE AUSWÄHLEN ({selectedFinal.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {caseData.clues.map((c) => {
            const active = selectedFinal.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleFinal(c.id)}
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
                {c.id}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          Regel 3 prüft, ob jeder Finalbeweis dem Leser im Fließtext gezeigt wurde.
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          Geprüfte Gebote: {FAIR_PLAY_RULES.length}
        </div>
      </details>
    </div>
  );
}
