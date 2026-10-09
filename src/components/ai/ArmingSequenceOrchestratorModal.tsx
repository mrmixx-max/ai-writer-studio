// ArmingSequenceOrchestratorModal (WP 123.1, Meilenstein 59.0 / v7.1.0)
//
// Interaktiver Ritueller Einkleidungs- & Rüstungs-Orchestrator.
// Listet den kanonischen Armierungs-Ablauf, verwebt jeden Schritt mit
// psychologischer Spannung und erzeugt eine vollständige Armierungs-Szene.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  ARMING_STEPS,
  generateTensionWeave,
  generateArmingScene,
  createSampleArmingStep,
  createSampleArmingScene,
} from "@/services/ai/armingSequenceOrchestrator";

export interface ArmingSequenceOrchestratorModalProps {
  className?: string;
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--bg)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

const sectionStyle = {
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: 10,
  marginBottom: 14,
  fontSize: 12,
} as const;

const sectionLabelStyle = {
  fontSize: 12,
  color: "var(--muted)",
  marginBottom: 6,
  fontFamily: "var(--font-mono)",
} as const;

export function ArmingSequenceOrchestratorModal({
  className,
}: ArmingSequenceOrchestratorModalProps) {
  const [seed, setSeed] = useState(7);
  const [fear, setFear] = useState(6);
  const [determination, setDetermination] = useState(5);
  const [experience, setExperience] = useState(4);
  const [stepId, setStepId] = useState<string>(ARMING_STEPS[0]?.id ?? "underwear");

  const characterState = useMemo(
    () => ({ fear, determination, experience }),
    [fear, determination, experience],
  );

  const tensionWeave = useMemo(
    () => generateTensionWeave(stepId, characterState, seed),
    [stepId, characterState, seed],
  );

  const armingScene = useMemo(() => generateArmingScene(seed), [seed]);

  const sampleStep = useMemo(() => createSampleArmingStep(), []);
  const sampleScene = useMemo(() => createSampleArmingScene(), []);

  return (
    <div
      className={className}
      data-testid="arming-sequence-modal"
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
        🛡️ Ritueller Einkleidungs- &amp; Rüstungs-Orchestrator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {ARMING_STEPS.length} Schritte · Gesamtdauer {armingScene.totalDuration}s · Ø Spannung{" "}
        {armingScene.averageTension}/10
      </div>

      {/* Seed */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Seed
        <input
          data-testid="arming-seed-input"
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      {/* Charakterzustand */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Angst
          <input
            data-testid="arming-fear-input"
            type="number"
            min={0}
            max={10}
            value={fear}
            onChange={(e) => setFear(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Entschlossenheit
          <input
            data-testid="arming-determination-input"
            type="number"
            min={0}
            max={10}
            value={determination}
            onChange={(e) => setDetermination(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Erfahrung
          <input
            data-testid="arming-experience-input"
            type="number"
            min={0}
            max={10}
            value={experience}
            onChange={(e) => setExperience(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* ARMING_STEPS Liste */}
      <div style={sectionStyle} data-testid="arming-steps">
        <div style={sectionLabelStyle}>ARMING_STEPS — kanonischer Ablauf</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          {ARMING_STEPS.map((step) => (
            <li key={step.id} style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--accent)" }}>{step.name}</span>{" "}
              <span style={{ color: "var(--muted)" }}>
                (id: {step.id} · {step.duration}s · Schwierigkeit {step.difficulty}/10)
              </span>
              <div style={{ color: "var(--fg)", fontSize: 11 }}>{step.description}</div>
            </li>
          ))}
        </ol>
      </div>

      {/* Schritt-Auswahl für die Spannungs-Verwebung */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Schritt für Spannungs-Verwebung
        <select
          data-testid="arming-step-select"
          value={stepId}
          onChange={(e) => setStepId(e.target.value)}
          style={inputStyle}
        >
          {ARMING_STEPS.map((step) => (
            <option key={step.id} value={step.id}>
              {step.name}
            </option>
          ))}
        </select>
      </label>

      {/* SPANNUNGS-VERWEBUNG */}
      <div style={sectionStyle} data-testid="arming-tension-weave">
        <div style={sectionLabelStyle}>SPANNUNGS-VERWEBUNG</div>
        <div data-testid="arming-tension-value" style={{ fontWeight: 700, marginBottom: 6 }}>
          Spannung: {tensionWeave.tension}/10
        </div>
        <ul style={{ margin: "0 0 6px", paddingLeft: 18, lineHeight: 1.6 }}>
          {tensionWeave.psychologicalCues.map((cue, i) => (
            <li key={i} style={{ fontSize: 11 }}>
              {cue}
            </li>
          ))}
        </ul>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>Innerer Monolog</div>
        <div data-testid="arming-monologue" style={{ fontStyle: "italic" }}>
          {tensionWeave.innerMonologue}
        </div>
      </div>

      {/* EINKLEIDUNGSSZENE */}
      <div style={sectionStyle} data-testid="arming-scene">
        <div style={sectionLabelStyle}>EINKLEIDUNGSSZENE</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
          {armingScene.stepCount} Schritte · {armingScene.totalDuration}s · Ø Spannung{" "}
          {armingScene.averageTension}/10
        </div>
        <div
          data-testid="arming-scene-text"
          style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 11 }}
        >
          {armingScene.scene}
        </div>
      </div>

      {/* Beispiele */}
      <details data-testid="arming-samples" style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Beispiele (createSampleArmingStep / createSampleArmingScene)
        </summary>
        <pre
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {`Schritt: ${sampleStep.name} (${sampleStep.duration}s, Schwierigkeit ${sampleStep.difficulty}/10)\n\n`}
          {sampleScene.scene}
        </pre>
      </details>
    </div>
  );
}
