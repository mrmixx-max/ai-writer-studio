// Flagship50JubileeCockpitModal (WP 81.2)
//
// Interaktives Flaggschiff 5.0 Master-Cockpit & Platin-Siegel.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  runPlatinumAudit,
  createMagnumOpusArchive,
  generatePlatinumSeal,
  formatPlatinumAudit,
} from "@/services/publishing/flagship50JubileeCockpit";

export interface Flagship50JubileeCockpitModalProps {
  className?: string;
}

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

export function Flagship50JubileeCockpitModal({ className }: Flagship50JubileeCockpitModalProps) {
  const [serviceCount, setServiceCount] = useState(85);
  const [chunkCount, setChunkCount] = useState(60);
  const [i18nKeyCount, setI18nKeyCount] = useState(1400);
  const audit = useMemo(
    () => runPlatinumAudit(serviceCount, chunkCount, i18nKeyCount),
    [serviceCount, chunkCount, i18nKeyCount],
  );
  const archive = useMemo(() => createMagnumOpusArchive("Die Chroniken der Aetherie"), []);
  const seal = useMemo(() => generatePlatinumSeal(audit), [audit]);

  return (
    <div
      className={className}
      data-testid="flagship50-cockpit-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏆 Flaggschiff 5.0 Master-Cockpit & Platin-Siegel
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Score {audit.overallScore}% · {audit.passed ? "BESTANDEN" : "WARNUNG"}
      </div>

      {/* Parameter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Services
          <input
            data-testid="cockpit-service-input"
            type="number"
            value={serviceCount}
            onChange={(e) => setServiceCount(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Chunks
          <input
            data-testid="cockpit-chunk-input"
            type="number"
            value={chunkCount}
            onChange={(e) => setChunkCount(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          i18n-Schlüssel
          <input
            data-testid="cockpit-i18n-input"
            type="number"
            value={i18nKeyCount}
            onChange={(e) => setI18nKeyCount(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Audit */}
      <div
        data-testid="cockpit-audit"
        style={{
          border: `1px solid ${audit.passed ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>PLATIN-AUDIT</div>
        {audit.checks.map((check) => (
          <div
            key={check.name}
            data-testid={`cockpit-check-${check.name}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 3,
              fontSize: 10,
            }}
          >
            <span
              style={{
                color:
                  check.status === "ok"
                    ? "var(--success)"
                    : check.status === "warn"
                      ? "var(--warn)"
                      : "var(--error)",
              }}
            >
              [{check.status.toUpperCase()}] {check.name}
            </span>
            <span style={{ color: "var(--muted)" }}>{check.detail}</span>
          </div>
        ))}
        <div
          data-testid="cockpit-score"
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: audit.passed ? "var(--success)" : "var(--warn)",
          }}
        >
          Score: {audit.overallScore}%
        </div>
      </div>

      {/* Magnum-Opus-Archiv */}
      <div
        data-testid="cockpit-archive"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>MAGNUM-OPUS-ARCHIV</div>
        <div style={{ color: "var(--accent)", fontWeight: 700 }}>{archive.title}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Formate: {archive.formats.join(", ")}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Figuren: {archive.characters.join(", ")}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Hash: {archive.hash}
        </div>
      </div>

      {/* Platin-Siegel */}
      <div
        data-testid="cockpit-seal"
        style={{
          border: "2px solid var(--accent)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 14,
          fontSize: 11,
          textAlign: "center",
        }}
      >
        <div
          data-testid="cockpit-seal-svg"
          dangerouslySetInnerHTML={{ __html: seal }}
        />
        <div
          data-testid="cockpit-seal-status"
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: audit.passed ? "var(--accent)" : "var(--warn)",
          }}
        >
          {audit.passed ? "✓ PLATIN VERIFIZIERT" : "⚠ WARNUNG"}
        </div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="cockpit-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="cockpit-text"
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
          {formatPlatinumAudit(audit)}
        </pre>
      </details>
    </div>
  );
}
