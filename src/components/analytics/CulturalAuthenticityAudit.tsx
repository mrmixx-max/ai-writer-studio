// CulturalAuthenticityAudit (WP 49.1): Authentizitäts- & Tropen-Audit.
//
// Tropen-Radar für schädliche Erzählmuster, sprachliche Sensitivität
// und konstruktives Feedback statt Zensur.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  scanForTropes,
  checkLinguisticSensitivity,
  suggestImprovements,
  generateAuditReport,
} from "@/services/analytics/culturalAuthenticityAudit";

export interface CulturalAuthenticityAuditProps {
  className?: string;
  defaultText?: string;
}

const DEFAULT_TEXT = `Der unheilbaren Rasse der Schattenwesen drohte, die Welt zu zerstören. Der weiße Held aus dem Westen kam, um sie zu retten. Die Prinzessin wartete in ihrem Turm auf Rettung. Als der schwule Held starb, war es ein hartes Schicksal. Er war blind vor Wut und gelähmt vor Schreck.`;

export function CulturalAuthenticityAudit({
  className,
  defaultText = DEFAULT_TEXT,
}: CulturalAuthenticityAuditProps) {
  const [text, setText] = useState(defaultText);
  const [report, setReport] = useState(() => generateAuditReport(defaultText));

  const handleAudit = useCallback(() => {
    setReport(generateAuditReport(text));
  }, [text]);

  const tropes = useMemo(() => scanForTropes(text), [text]);
  const sensitivities = useMemo(() => checkLinguisticSensitivity(text), [text]);

  return (
    <div
      className={className}
      data-testid="cultural-authenticity-audit"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔍 Authentizitäts-Audit
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {tropes.length} Tropen · {sensitivities.length} Sensibilitäten · Score: {report.overallScore}/100
      </div>

      {/* Text-Eingabe */}
      <div style={{ marginBottom: 14 }}>
        <textarea
          data-testid="audit-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          style={{
            width: "100%",
            background: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <button
          data-testid="audit-run"
          onClick={handleAudit}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Audit starten
        </button>
      </div>

      {/* Gesamtbericht */}
      <div
        data-testid="audit-report"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>BERICHT</div>
        <div
          data-testid="audit-score"
          style={{
            fontSize: 24,
            fontWeight: 700,
            color:
              report.overallScore >= 80
                ? "var(--success)"
                : report.overallScore >= 50
                  ? "var(--warn)"
                  : "var(--error)",
          }}
        >
          {report.overallScore}/100
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{report.summary}</div>
      </div>

      {/* Tropen */}
      {tropes.length > 0 && (
        <div data-testid="audit-tropes" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--error)", marginBottom: 6 }}>
            TROPEN ({tropes.length})
          </div>
          {tropes.map((t) => (
            <div
              key={t.id}
              data-testid={`audit-trope-${t.id}`}
              style={{
                borderLeft: `3px solid ${t.severity === "high" ? "var(--error)" : t.severity === "medium" ? "var(--warn)" : "var(--muted)"}`,
                paddingLeft: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>
                {t.trope}{" "}
                <span
                  style={{
                    fontSize: 9,
                    color: t.severity === "high" ? "var(--error)" : t.severity === "medium" ? "var(--warn)" : "var(--muted)",
                  }}
                >
                  [{t.severity}]
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
                "{t.excerpt}"
              </div>
              <div style={{ fontSize: 10, color: "var(--success)", marginTop: 2 }}>
                → {suggestImprovements(t)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sensibilitäten */}
      {sensitivities.length > 0 && (
        <div data-testid="audit-sensitivities" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--warn)", marginBottom: 6 }}>
            SPRACHLICHE SENSIBILITÄT ({sensitivities.length})
          </div>
          {sensitivities.map((s) => (
            <div
              key={s.id}
              data-testid={`audit-sensitivity-${s.id}`}
              style={{
                borderLeft: `3px solid ${s.severity === "high" ? "var(--error)" : s.severity === "medium" ? "var(--warn)" : "var(--muted)"}`,
                paddingLeft: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>
                "{s.phrase}"{" "}
                <span
                  style={{
                    fontSize: 9,
                    color: s.severity === "high" ? "var(--error)" : s.severity === "medium" ? "var(--warn)" : "var(--muted)",
                  }}
                >
                  [{s.category}/{s.severity}]
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--success)", marginTop: 2 }}>
                → {suggestImprovements(s)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tropes.length === 0 && sensitivities.length === 0 && (
        <div
          data-testid="audit-clean"
          style={{ fontSize: 12, color: "var(--success)", marginBottom: 14 }}
        >
          ✓ Keine Probleme gefunden. Der Text ist authentisch und sensibel.
        </div>
      )}
    </div>
  );
}
