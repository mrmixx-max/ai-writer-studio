// Grand9000CitadelSentinelModal (WP 87.2 UI)
import { useState, useMemo } from "react";
import {
  runCitadelAudit,
  generateCitadelCertificate,
  formatCitadelAudit,
} from "@/services/core/grand9000CitadelSentinel";

export interface Grand9000CitadelSentinelModalProps {
  className?: string;
}

export function Grand9000CitadelSentinelModal({ className }: Grand9000CitadelSentinelModalProps) {
  const [totalTests, setTotalTests] = useState(9050);
  const [passedTests, setPassedTests] = useState(9050);
  const [serviceCount, setServiceCount] = useState(89);
  const [chunkCount, setChunkCount] = useState(65);
  const [i18nKeyCount, setI18nKeyCount] = useState(1650);
  const [bundleSizeKb, setBundleSizeKb] = useState(2800);
  const [maxLatencyMs, setMaxLatencyMs] = useState(14);
  const [heapUsedMb, setHeapUsedMb] = useState(95);
  const [issuerKey, setIssuerKey] = useState("AIWS-CITADEL-9K");

  const audit = useMemo(
    () => runCitadelAudit(totalTests, passedTests, serviceCount, chunkCount, i18nKeyCount, bundleSizeKb, maxLatencyMs, heapUsedMb),
    [totalTests, passedTests, serviceCount, chunkCount, i18nKeyCount, bundleSizeKb, maxLatencyMs, heapUsedMb]
  );
  const certificate = useMemo(() => generateCitadelCertificate(audit, issuerKey), [audit, issuerKey]);
  const auditText = useMemo(() => formatCitadelAudit(audit), [audit]);

  return (
    <div
      className={className}
      data-testid="grand9000-citadel-modal"
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
        🏰 9.000-Tests-Citadel-Siegel & Sentinel
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Version: {audit.version} · Score: {audit.overallScore}% · Status: {audit.passed ? "BESTANDEN" : "WARNUNG"} · Hash: {audit.hash}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Gesamt-Tests
          <input type="number" value={totalTests} onChange={e => setTotalTests(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Bestanden
          <input type="number" value={passedTests} onChange={e => setPassedTests(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Services
          <input type="number" value={serviceCount} onChange={e => setServiceCount(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Chunks
          <input type="number" value={chunkCount} onChange={e => setChunkCount(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          i18n-Schlüssel
          <input type="number" value={i18nKeyCount} onChange={e => setI18nKeyCount(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Bundle (KB)
          <input type="number" value={bundleSizeKb} onChange={e => setBundleSizeKb(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Max Latenz (ms)
          <input type="number" value={maxLatencyMs} onChange={e => setMaxLatencyMs(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Heap (MB)
          <input type="number" value={heapUsedMb} onChange={e => setHeapUsedMb(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Issuer Key (HMAC)
          <input value={issuerKey} onChange={e => setIssuerKey(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <div
        data-testid="citadel-audit"
        style={{
          border: `2px solid ${audit.passed ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 6,
          padding: 12,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>⚔ CITADEL AUDIT ⚔</div>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 12,
              background: audit.passed ? "var(--success)" : "var(--warn)",
              color: "var(--bg)",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {audit.passed ? "✓ BESTANDEN" : "⚠ WARNUNG"}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>
          Hash: {audit.hash} | Version: {audit.version} | {audit.timestamp}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: audit.passed ? "var(--success)" : "var(--warn)", marginBottom: 8 }}>
          Gesamt-Score: {audit.overallScore}%
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6 }}>
          {audit.checks.map((check, i) => (
            <div key={i} style={{ padding: 6, border: `1px solid ${check.status === "ok" ? "var(--success)" : check.status === "warn" ? "var(--warn)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span>{check.name}</span>
                <span style={{ color: check.status === "ok" ? "var(--success)" : check.status === "warn" ? "var(--warn)" : "var(--error)", fontWeight: 700 }}>
                  {check.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                {check.value} / {check.threshold} — {check.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        data-testid="citadel-certificate"
        style={{
          border: "2px solid var(--accent)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 14,
          fontSize: 11,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", marginBottom: 8 }}>
          🏰 IMPERIALES 9.000-TESTS SIEGEL
        </div>
        <div style={{ marginBottom: 8, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
          {certificate.svgBadge}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", marginTop: 8, fontSize: 10 }}>
          <div><strong>ID:</strong> {certificate.id}</div>
          <div><strong>Tests:</strong> {certificate.testCount} | <strong>Services:</strong> {certificate.serviceCount}</div>
          <div><strong>Signatur:</strong> <code>{certificate.signature.substring(0, 32)}...</code></div>
          <div><strong>Ausgestellt:</strong> {certificate.issuedAt}</div>
        </div>
      </div>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 VOLLSTÄNDIGER AUDIT-BERICHT
        </summary>
        <pre
          data-testid="citadel-audit-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 300,
            overflow: "auto",
          }}
        >
          {auditText}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔐 ZERTIFIKAT-DETAILS (JSON)
        </summary>
        <pre
          data-testid="citadel-cert-json"
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
          {JSON.stringify(
            {
              id: certificate.id,
              title: certificate.title,
              version: certificate.version,
              issuedAt: certificate.issuedAt,
              auditHash: certificate.auditHash,
              testCount: certificate.testCount,
              serviceCount: certificate.serviceCount,
              signature: certificate.signature,
            },
            null,
            2
          )}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 BENCHMARK-COCKPIT (Live-Metriken)
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Test-Dichte</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{Math.round(audit.totalTests / Math.max(1, audit.serviceCount))} Tests/Service</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Chunk-Effizienz</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{Math.round((audit.chunkCount / Math.max(1, audit.serviceCount)) * 100)}%</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>i18n-Abdeckung</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{Math.round(audit.i18nKeyCount / 4)} Keys/Sprache</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Bundle/Test</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{Math.round(audit.bundleSizeKb / Math.max(1, audit.totalTests))} KB</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Latenz-Reserve</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: audit.maxLatencyMs <= 16 ? "var(--success)" : "var(--warn)" }}>
              {16 - audit.maxLatencyMs}ms
            </div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Heap-Reserve</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: audit.heapUsedMb <= 120 ? "var(--success)" : "var(--warn)" }}>
              {120 - audit.heapUsedMb}MB
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}