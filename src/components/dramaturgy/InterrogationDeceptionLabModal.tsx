// InterrogationDeceptionLabModal (WP 115.1 UI)
import { useState, useMemo } from "react";
import {
  INTERROGATION_STRATEGIES,
  analyzeDeceptionIndicators,
  generateInterrogationDialog,
} from "@/services/dramaturgy/interrogationDeceptionLab";

export interface InterrogationDeceptionLabModalProps {
  className?: string;
}

export function InterrogationDeceptionLabModal({ className }: InterrogationDeceptionLabModalProps) {
  const [suspectName, setSuspectName] = useState("Max Mustermann");
  const [crime, setCrime] = useState("Mord an Julia Steiner");
  const [strategy, setStrategy] = useState<"cognitive" | "evidenceTrap" | "minimization" | "maximization">("cognitive");
  const [evidenceCount, setEvidenceCount] = useState(3);
  const [blinkRate, setBlinkRate] = useState(60);
  const [swallowRate, setSwallowRate] = useState(40);
  const [pronounDistance, setPronounDistance] = useState(70);
  const [pauseCount, setPauseCount] = useState(50);
  const [fidgetScore, setFidgetScore] = useState(30);
  const [seed, setSeed] = useState(42);

  const deceptionAnalysis = useMemo(
    () => analyzeDeceptionIndicators({ blinkRate, swallowRate, pronounDistance, pauseCount, fidgetScore }),
    [blinkRate, swallowRate, pronounDistance, pauseCount, fidgetScore]
  );
  const dialog = useMemo(
    () => generateInterrogationDialog({ suspectName, crime, strategy, evidenceCount }, seed),
    [suspectName, crime, strategy, evidenceCount, seed]
  );


  return (
    <div
      className={className}
      data-testid="interrogation-deception-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔍 Verhör-Taktik &amp; Täuschungs-Labor
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {INTERROGATION_STRATEGIES.length} Strategien · Täuschungs-Score {deceptionAnalysis.deceptionScore}/100
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Verdächtiger
          <input value={suspectName} onChange={(e) => setSuspectName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Tat
          <input value={crime} onChange={(e) => setCrime(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 140 }}>
          Strategie
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}>
            {INTERROGATION_STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Beweise
          <input type="number" min={0} value={evidenceCount} onChange={(e) => setEvidenceCount(Math.max(0, Number(e.target.value) || 0))} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 VERNEHMUNGSSTRATEGIEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {INTERROGATION_STRATEGIES.map((s) => (
            <div key={s.id} style={{ padding: 8, border: `1px solid ${strategy === s.id ? "var(--accent)" : "var(--border)"}`, borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: strategy === s.id ? "var(--accent)" : "var(--fg)" }}>{s.name}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{s.description}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{s.approach}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>Rechtsgrundlage: {s.legalBasis} · Erfolgsquote: {(s.successRate * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧠 STRESS- &amp; LÜGEN-INDIKATORE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <label style={{ color: "var(--muted)" }}>
            Blinzelrate: {blinkRate}
            <input type="range" min={0} max={100} value={blinkRate} onChange={(e) => setBlinkRate(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </label>
          <label style={{ color: "var(--muted)" }}>
            Schluckrate: {swallowRate}
            <input type="range" min={0} max={100} value={swallowRate} onChange={(e) => setSwallowRate(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </label>
          <label style={{ color: "var(--muted)" }}>
            Pronomen-Distanzierung: {pronounDistance}
            <input type="range" min={0} max={100} value={pronounDistance} onChange={(e) => setPronounDistance(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </label>
          <label style={{ color: "var(--muted)" }}>
            Pausen: {pauseCount}
            <input type="range" min={0} max={100} value={pauseCount} onChange={(e) => setPauseCount(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </label>
          <label style={{ color: "var(--muted)" }}>
            Zappel-Score: {fidgetScore}
            <input type="range" min={0} max={100} value={fidgetScore} onChange={(e) => setFidgetScore(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </label>
        </div>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Täuschungs-Score:</strong> {deceptionAnalysis.deceptionScore}/100</div>
          <div><strong>Konfidenz:</strong> {deceptionAnalysis.confidence}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{deceptionAnalysis.analysis}</div>
          {deceptionAnalysis.redFlags.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <strong>Red Flags:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--error)" }}>
                {deceptionAnalysis.redFlags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💬 VERHÖR-DIALOG ({dialog.dialog.length} Zeilen)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {dialog.dialog.map((line, i) => (
            <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <span style={{ fontWeight: 700, color: line.speaker === "detective" ? "var(--accent)" : line.speaker === "lawyer" ? "var(--warning)" : "var(--muted)" }}>
                {line.speaker === "detective" ? "Ermittler" : line.speaker === "lawyer" ? "Anwalt" : "Verdächtiger"}:
              </span>{" "}
              {line.text}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>{dialog.legalWarning}</div>
      </details>
    </div>
  );
}
