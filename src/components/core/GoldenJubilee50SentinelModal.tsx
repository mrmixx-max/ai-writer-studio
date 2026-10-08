// GoldenJubilee50SentinelModal (WP 105.2 UI)
import { useState, useMemo } from "react";
import {
  runJubileeAudit,
  generateJubileeCertificate,
  buildRetrospectiveMatrix,
  formatJubileeAudit,
} from "@/services/core/goldenJubilee50Sentinel";

export interface GoldenJubilee50SentinelModalProps {
  className?: string;
}

export function GoldenJubilee50SentinelModal({ className }: GoldenJubilee50SentinelModalProps) {
  const [totalTests, setTotalTests] = useState(10310);
  const [serviceCount, setServiceCount] = useState(109);
  const [showTimeline, setShowTimeline] = useState(false);

  const audit = useMemo(
    () => runJubileeAudit(totalTests, totalTests, serviceCount, 671, 82, 1820, 11),
    [totalTests, serviceCount]
  );
  const cert = useMemo(() => generateJubileeCertificate(audit), [audit]);
  const retrospective = useMemo(() => buildRetrospectiveMatrix(), []);

  const statusColor = (s: "ok" | "warn" | "fail") =>
    s === "ok" ? "var(--success)" : s === "warn" ? "var(--warn)" : "var(--error)";

  const maxTestCount = retrospective.entries.reduce((m, e) => Math.max(m, e.testCount), 1);

  return (
    <div
      className={className}
      data-testid="golden-jubilee-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🥇 50. Goldenes Jubiläums-Siegel &amp; Sentinel
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Audit {audit.id} · v{audit.version} · Meilenstein {audit.milestone} · Score {audit.overallScore}%
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
        <button
          onClick={() => setShowTimeline((v) => !v)}
          style={{ alignSelf: "flex-end", padding: "6px 12px", background: showTimeline ? "var(--accent)" : "var(--panel)", color: showTimeline ? "var(--bg)" : "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          {showTimeline ? "📜 Zeitstrahl ausblenden" : "📜 Retrospektive anzeigen"}
        </button>
      </div>

      <div style={{ marginBottom: 12, padding: 10, border: "2px solid var(--accent)", borderRadius: 8, background: "var(--panel)", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>50. GOLDENES JUBILÄUM</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {audit.totalTests} Tests · {audit.serviceCount} Services · Hash {audit.hash}
        </div>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔍 VOLL-SPEKTRUM-AUDIT
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
          🥇 GOLDENES 50TH-JUBILEE-SIEGEL
        </summary>
        <div
          style={{ marginTop: 8, display: "flex", justifyContent: "center", padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel)" }}
          dangerouslySetInnerHTML={{ __html: cert.svgBadge }}
        />
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>
          SHA-512-Signatur: {cert.sha512Signature.substring(0, 64)}…
        </div>
      </details>

      {showTimeline && (
        <details style={{ marginBottom: 12 }} open>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            🕰️ MEILENSTEIN-RETROSPEKTIVE-MATRIX ({retrospective.milestonesCount})
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {retrospective.entries.map((e) => (
              <div key={e.number} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span><strong style={{ color: "var(--accent)" }}>M{e.number}</strong> · v{e.version}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{e.testCount.toLocaleString("de-DE")} Tests</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{e.theme}</div>
                <div style={{ marginTop: 4, height: 5, borderRadius: 3, background: "var(--bg)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((e.testCount / maxTestCount) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Wachstum von v{retrospective.firstVersion} bis v{retrospective.latestVersion}: +{retrospective.totalGrowth.toLocaleString("de-DE")} Tests
            </div>
          </div>
        </details>
      )}

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📄 AUDIT-PROTOKOLL (TEXT)
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 220, overflow: "auto" }}>
          {formatJubileeAudit(audit)}
        </pre>
      </details>
    </div>
  );
}
