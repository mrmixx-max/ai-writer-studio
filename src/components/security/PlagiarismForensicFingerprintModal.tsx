// PlagiarismForensicFingerprintModal (WP 107.2 UI)
import { useState, useMemo } from "react";
import {
  buildForensicReport,
  SAMPLE_REFERENCE_TEXT,
  SAMPLE_SUSPECT_TEXT,
} from "@/services/security/plagiarismForensicFingerprint";

export interface PlagiarismForensicFingerprintModalProps {
  className?: string;
}

export function PlagiarismForensicFingerprintModal({ className }: PlagiarismForensicFingerprintModalProps) {
  const [referenceText, setReferenceText] = useState(SAMPLE_REFERENCE_TEXT);
  const [suspectText, setSuspectText] = useState(SAMPLE_SUSPECT_TEXT);

  const report = useMemo(() => buildForensicReport(referenceText, suspectText), [referenceText, suspectText]);
  const sim = report.similarity;

  const verdictColor = (v: string) =>
    v === "plagiat" ? "var(--error)" : v === "verdächtig" ? "var(--warn)" : v === "verwandt" ? "var(--accent)" : "var(--success)";

  const metricRow = (label: string, value: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
      <span style={{ width: 150, color: "var(--muted)" }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
        <div style={{ width: `${Math.round(value * 100)}%`, height: "100%", background: "var(--accent)" }} />
      </div>
      <span style={{ width: 45, fontWeight: 700 }}>{(value * 100).toFixed(0)}%</span>
    </div>
  );

  return (
    <div
      className={className}
      data-testid="forensic-fingerprint-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔎 Forensischer Plagiats- &amp; Stil-Fingerabdruck
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Gutachten {report.id} · Stand {report.generatedAt}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Referenztext (Original)
          <textarea
            value={referenceText}
            onChange={(e) => setReferenceText(e.target.value)}
            rows={5}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px", fontSize: 10, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--font-mono)", resize: "vertical" }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Verdachtstext
          <textarea
            value={suspectText}
            onChange={(e) => setSuspectText(e.target.value)}
            rows={5}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px", fontSize: 10, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--font-mono)", resize: "vertical" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 12, padding: 10, border: `2px solid ${verdictColor(sim.verdict)}`, borderRadius: 8, background: "var(--panel)", textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: verdictColor(sim.verdict) }}>
          {sim.overallIndex}% ÄHNLICHKEIT
        </div>
        <div style={{ fontSize: 12, color: verdictColor(sim.verdict), marginTop: 4, textTransform: "uppercase", fontWeight: 700 }}>
          Befund: {sim.verdict}
        </div>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 ÄHNLICHKEITS-INDIKATOREN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {metricRow("Syntaktische DNA", sim.syntacticSimilarity)}
          {metricRow("Rhythmus (Satzlängen)", sim.rhythmSimilarity)}
          {metricRow("Vokabular", sim.lexicalSimilarity)}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧬 STIL-FINGERABDRÜCKE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>Referenz</div>
            <div style={{ fontSize: 10, wordBreak: "break-all", marginTop: 2 }}>{report.reference.hash}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              Ø Satz {report.reference.profile.avgSentenceLength} Wörter (±{report.reference.profile.sentenceLengthStdDev}) · TTR {report.reference.profile.typeTokenRatio}
            </div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>Verdacht</div>
            <div style={{ fontSize: 10, wordBreak: "break-all", marginTop: 2 }}>{report.suspect.hash}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              Ø Satz {report.suspect.profile.avgSentenceLength} Wörter (±{report.suspect.profile.sentenceLengthStdDev}) · TTR {report.suspect.profile.typeTokenRatio}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔗 GEMEINSAME SYNTAKTISCHE MUSTER ({sim.sharedPatterns.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {sim.sharedPatterns.length === 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>Keine Übereinstimmung.</span>}
          {sim.sharedPatterns.map((p, i) => (
            <span key={i} style={{ padding: "2px 6px", fontSize: 9, border: "1px solid var(--border)", borderRadius: 3, background: "var(--panel)" }}>
              {p}
            </span>
          ))}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚖️ GERICHTFESTES GUTACHTEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {report.findings.map((f, i) => (
            <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              {f}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
