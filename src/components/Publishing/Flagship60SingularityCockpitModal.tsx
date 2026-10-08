// Flagship60SingularityCockpitModal (WP 101.2 UI)
import { useState, useMemo } from "react";
import {
  runSingularityAudit,
  generateSingularityCertificate,
  createMagnumOpusUniversalArchive,
  formatSingularityAudit,
  createSampleUniversalArchive,
} from "@/services/publishing/flagship60SingularityCockpit";

export interface Flagship60SingularityCockpitModalProps {
  className?: string;
}

export function Flagship60SingularityCockpitModal({ className }: Flagship60SingularityCockpitModalProps) {
  const [totalTests, setTotalTests] = useState(10042);
  const [serviceCount, setServiceCount] = useState(104);

  const audit = useMemo(
    () => runSingularityAudit(totalTests, totalTests, serviceCount, 665, 74, 1780, 12),
    [totalTests, serviceCount]
  );
  const cert = useMemo(() => generateSingularityCertificate(audit), [audit]);
  const archive = useMemo(() => createMagnumOpusUniversalArchive("Das Zwölfgestirn"), []);

  const statusColor = (s: "ok" | "warn" | "fail") =>
    s === "ok" ? "var(--success)" : s === "warn" ? "var(--warn)" : "var(--error)";

  return (
    <div
      className={className}
      data-testid="flagship60-cockpit-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏆 10.000-Singularitäts-Siegel &amp; 6.0 Cockpit
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Audit {audit.id} · v{audit.version} · Score {audit.overallScore}%
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Test-Anzahl
          <input
            type="number"
            value={totalTests}
            onChange={(e) => setTotalTests(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Services
          <input
            type="number"
            value={serviceCount}
            onChange={(e) => setServiceCount(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 12, padding: 10, border: `2px solid ${audit.crossedTenThousand ? "var(--accent)" : "var(--warn)"}`, borderRadius: 8, background: "var(--panel)", textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: audit.crossedTenThousand ? "var(--accent)" : "var(--warn)" }}>
          {audit.crossedTenThousand ? "10.000-TEST-SCHALLMAUER DURCHBROCHEN" : "Schallmauer noch nicht erreicht"}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{audit.totalTests} Tests · Hash {audit.hash}</div>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔍 10.000er-GESAMT-AUDIT
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          {audit.checks.map((c, i) => (
            <div key={i} style={{ padding: 8, border: `1px solid ${statusColor(c.status)}`, borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: statusColor(c.status), fontWeight: 700 }}>{c.name}</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{c.value} / {c.threshold}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{c.detail}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💎 DIAMANT-SINGULARITÄTS-SIEGEL
        </summary>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel)" }}
          dangerouslySetInnerHTML={{ __html: cert.svgBadge }}
        />
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>
          SHA-512-Signatur: {cert.sha512Signature.substring(0, 64)}…
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📦 MAGNUM-OPUS-UNIVERSAL-ARCHIV ({archive.extension})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {archive.entries.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <span>{e.label}</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>{(e.bytes / 1024).toFixed(0)} KB</span>
            </div>
          ))}
          <div style={{ padding: 6, fontSize: 10, color: "var(--muted)" }}>
            Gesamt: {(archive.totalBytes / 1024).toFixed(0)} KB · lesbar bis {archive.readableUntilYear} · ID {archive.id}
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📄 AUDIT-PROTOKOLL (TEXT)
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 220, overflow: "auto" }}>
          {formatSingularityAudit(audit)}
        </pre>
        <button
          onClick={() => {
            const a = createSampleUniversalArchive();
            setTotalTests(10042);
            setServiceCount(a.entries.length + 98);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          🎲 BEISPIEL LADEN
        </button>
      </details>
    </div>
  );
}
