// AuthorNewsletterSequenceModal (WP 111.2 UI)
import { useState, useMemo } from "react";
import {
  generateNewsletterSequence,
  splitSubjectLines,
  previewEmailSequence,
} from "@/services/marketing/authorNewsletterSequence";

export interface AuthorNewsletterSequenceModalProps {
  className?: string;
}

export function AuthorNewsletterSequenceModal({ className }: AuthorNewsletterSequenceModalProps) {
  const [seed, setSeed] = useState(42);

  const sequence = useMemo(() => generateNewsletterSequence(seed), [seed]);
  const subjectLines = useMemo(() => splitSubjectLines(seed), [seed]);
  const preview = useMemo(() => previewEmailSequence(seed), [seed]);

  return (
    <div
      className={className}
      data-testid="author-newsletter-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ✉️ Autoren-Newsletter- &amp; Launch-Sequenz
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {sequence.steps.length} E-Mails · {sequence.totalDays} Tage Gesamtdauer
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
          📧 E-MAIL-SEQUENZ ({sequence.steps.length} Schritte)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {sequence.steps.map((s) => (
            <div key={s.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "var(--accent)" }}>{s.name}</strong>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Tag +{s.dayOffset}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{s.body}</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>
                <strong>CTA:</strong> {s.cta}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 BETREFFZEILEN-SPLITTER
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {subjectLines.map((sl) => (
            <div key={sl.step} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>{sl.stepName}</div>
              {sl.variants.map((v, i) => (
                <div key={i} style={{ fontSize: 10, padding: "2px 0", color: i === 0 ? "var(--accent)" : "var(--muted)" }}>
                  {i === 0 ? "★ " : "  "}{v}
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          👁️ VORSCHAU
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {preview.map((p) => (
            <div key={p.step.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700 }}>Tag +{p.dayOffset}: {p.subject}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{p.body.substring(0, 60)}...</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
