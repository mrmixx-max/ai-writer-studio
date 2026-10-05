// GrandJubileeArchiveModal (WP 61.2)
//
// Zeigt den Vollständigkeits-Scan, das signierte 7.000-Tests-Zertifikat mit
// SVG-Badge und den Performance-Audit.
//
// Design-Token-only — keine Hardcoded-Farben (Badge-SVG ist Export-Artefakt).
import { useState, useMemo } from "react";
import {
  runGrandCompletenessScan,
  issueJubileeCertificate,
  verifyJubileeCertificate,
  generateJubileeBadgeSvg,
  runPerformanceAudit,
  formatCompletenessReport,
  JUBILEE_TARGET,
} from "@/services/core/grandJubileeArchive";

export interface GrandJubileeArchiveModalProps {
  /** Gefeierte Testzahl. */
  testCount?: number;
  /** Version. */
  version?: string;
  /** Anzahl registrierter Services. */
  serviceCount?: number;
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

const STATUS_COLORS: Record<string, string> = {
  ok: "var(--success)",
  warn: "var(--warn)",
  fail: "var(--error)",
};

export function GrandJubileeArchiveModal({
  testCount = 7000,
  version = "3.9.0",
  serviceCount = 70,
  className,
}: GrandJubileeArchiveModalProps) {
  const [tests, setTests] = useState(testCount);
  const [ver, setVer] = useState(version);
  const [services, setServices] = useState(serviceCount);

  const certificate = useMemo(() => issueJubileeCertificate(tests, ver, 1759672000), [tests, ver]);
  const verified = useMemo(() => verifyJubileeCertificate(certificate), [certificate]);
  const badgeSvg = useMemo(() => generateJubileeBadgeSvg(certificate), [certificate]);

  const scan = useMemo(
    () =>
      runGrandCompletenessScan({
        serviceCount: services,
        modeCount: services * 2,
        i18nKeysPerLocale: [1100, 1100, 1100, 1100],
        lazyChunks: services * 2,
        reachableServices: services,
      }),
    [services],
  );

  const performance = useMemo(() => runPerformanceAudit(services), [services]);
  const report = useMemo(() => formatCompletenessReport(scan), [scan]);

  return (
    <div
      className={className}
      data-testid="grand-jubilee-archive-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏆 7.000-Tests-Jubiläums-Siegel
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        System-Sentinel · Vollständigkeits-Audit über {services} Services
      </div>

      {/* Eingaben */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 110 }}>
          Testzahl
          <input
            data-testid="jubilee-testcount-input"
            type="number"
            value={tests}
            onChange={(e) => setTests(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 90 }}>
          Version
          <input
            data-testid="jubilee-version-input"
            type="text"
            value={ver}
            onChange={(e) => setVer(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 90 }}>
          Services
          <input
            data-testid="jubilee-services-input"
            type="number"
            value={services}
            onChange={(e) => setServices(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Zertifikat */}
      <div
        data-testid="jubilee-certificate"
        style={{
          border: "2px solid var(--accent)",
          borderRadius: 6,
          padding: 14,
          marginBottom: 14,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
        <div
          data-testid="jubilee-medal"
          style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, marginBottom: 6 }}
        >
          {certificate.medal.toUpperCase()}-ZERTIFIKAT
        </div>
        <div
          data-testid="jubilee-testcount"
          style={{ fontSize: 32, fontWeight: 700, color: "var(--fg)" }}
        >
          {certificate.testCount}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
          bestandene Tests · Version {certificate.version}
        </div>
        <div
          data-testid="jubilee-hash"
          style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)" }}
        >
          {certificate.hash.slice(0, 32)}…
        </div>
        <div
          data-testid="jubilee-verification"
          style={{
            marginTop: 8,
            fontSize: 11,
            fontWeight: 700,
            color: verified ? "var(--success)" : "var(--error)",
          }}
        >
          {verified ? "✓ Signatur verifiziert" : "✗ Signatur ungültig"}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          {certificate.issuer}
        </div>
      </div>

      {/* Badge-Vorschau */}
      <div data-testid="jubilee-badge" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SVG-BADGE (EXPORT)
        </div>
        <div
          data-testid="jubilee-badge-svg"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            overflowX: "auto",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            maxHeight: 130,
          }}
        >
          {badgeSvg}
        </div>
      </div>

      {/* Vollständigkeits-Scan */}
      <div
        data-testid="jubilee-scan"
        style={{
          border: `1px solid ${STATUS_COLORS[scan.status]}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          VOLLSTÄNDIGKEITS-SCAN
        </div>
        <div
          data-testid="jubilee-scan-score"
          style={{ color: STATUS_COLORS[scan.status], fontWeight: 700, marginBottom: 8 }}
        >
          {Math.round(scan.overallScore * 100)}% · {scan.passed} bestanden, {scan.failed} fehlgeschlagen
        </div>
        {scan.checks.map((c) => (
          <div
            key={c.name}
            data-testid={`jubilee-check-${c.name}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 3,
              fontSize: 10,
            }}
          >
            <span style={{ color: STATUS_COLORS[c.status] }}>
              [{c.status.toUpperCase()}] {c.name}
            </span>
            <span style={{ color: "var(--muted)" }}>{c.detail}</span>
          </div>
        ))}
      </div>

      {/* Performance-Audit */}
      <div
        data-testid="jubilee-performance"
        style={{
          border: `1px solid ${performance.withinBudget ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          PERFORMANCE-AUDIT
        </div>
        <div>
          Tipp-Latenz:{" "}
          <strong data-testid="jubilee-latency">{performance.keystrokeLatencyMs}</strong> ms bei{" "}
          {performance.serviceCount} Diensten
        </div>
        <div
          data-testid="jubilee-performance-verdict"
          style={{
            marginTop: 4,
            color: performance.withinBudget ? "var(--success)" : "var(--error)",
            fontWeight: 700,
          }}
        >
          {performance.verdict}
        </div>
      </div>

      {/* Bericht */}
      <details data-testid="jubilee-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="jubilee-report-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {report}
        </pre>
      </details>

      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 10 }}>
        Ziel-Marke: {JUBILEE_TARGET} Tests
      </div>
    </div>
  );
}
