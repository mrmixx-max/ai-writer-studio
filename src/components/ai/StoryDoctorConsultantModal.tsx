// StoryDoctorConsultantModal (WP 80.1)
//
// Interaktiver autonomer Story-Doctor & Manuskript-Diagnostiker.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  diagnoseManuscript,
  formatTreatmentPlan,
  SEVERITY_LABELS,
  CATEGORY_LABELS,
  type Severity,
} from "@/services/ai/storyDoctorConsultant";

export interface StoryDoctorConsultantModalProps {
  className?: string;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "var(--error)",
  major: "var(--warn)",
  minor: "var(--accent)",
  info: "var(--muted)",
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function StoryDoctorConsultantModal({ className }: StoryDoctorConsultantModalProps) {
  const [text, setText] = useState(
    "Der Held versprach, die Stadt zu retten. Das Thema der Freiheit wiederholt sich. Ein Widerspruch in der Handlung.",
  );
  const plan = useMemo(() => diagnoseManuscript(text), [text]);

  return (
    <div
      className={className}
      data-testid="story-doctor-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🩺 Autonomer Story-Doctor & Manuskript-Diagnostiker
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {plan.totalIssues} Probleme · Gesundheit {plan.overallHealth}%
      </div>

      {/* Text-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Manuskript
        <textarea
          data-testid="doctor-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Gesundheit */}
      <div
        data-testid="doctor-health"
        style={{
          border: `1px solid ${plan.overallHealth >= 70 ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>GESUNDHEIT</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: plan.overallHealth >= 70 ? "var(--success)" : "var(--warn)",
          }}
        >
          {plan.overallHealth}%
        </div>
      </div>

      {/* Diagnosen */}
      <div
        data-testid="doctor-diagnoses"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DIAGNOSEN ({plan.totalIssues})
        </div>
        {plan.diagnoses.length === 0 ? (
          <div data-testid="doctor-no-issues" style={{ color: "var(--success)" }}>
            ✓ Keine Probleme gefunden
          </div>
        ) : (
          plan.diagnoses.map((d) => (
            <div key={d.id} data-testid={`doctor-diagnosis-${d.id}`} style={{ marginBottom: 8 }}>
              <div style={{ color: SEVERITY_COLORS[d.severity], fontWeight: 700 }}>
                [{SEVERITY_LABELS[d.severity]}] {CATEGORY_LABELS[d.category]} – Kapitel {d.chapter}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{d.description}</div>
              <div style={{ fontSize: 10, color: "var(--accent)" }}>Rezeptur: {d.prescription}</div>
            </div>
          ))
        )}
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="doctor-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Behandlungsplan
        </summary>
        <pre
          data-testid="doctor-text"
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
          {formatTreatmentPlan(plan)}
        </pre>
      </details>
    </div>
  );
}
