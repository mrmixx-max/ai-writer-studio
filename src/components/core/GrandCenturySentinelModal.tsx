// GrandCenturySentinelModal (WP 65.2)
//
// Gesamt-Ökosystem-Audit, 7.500er-Century-Zertifikat als SVG + PDF
// und Latenz-Audit für Modal-Komponenten.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  runEcosystemAudit,
  generateCenturyCertificate,
  auditModalLatency,
} from "@/services/core/grandCenturySentinel";

export interface GrandCenturySentinelModalProps {
  className?: string;
}

export function GrandCenturySentinelModal({ className }: GrandCenturySentinelModalProps) {
  const [testCount, setTestCount] = useState(7500);
  const [version, setVersion] = useState("4.1.0");
  const [latencyComponent, setLatencyComponent] = useState("GrandCenturySentinelModal");
  const [latencyMs, setLatencyMs] = useState(12);

  const audit = useMemo(
    () =>
      runEcosystemAudit({
        schemaCount: 12,
        cacheIndexCount: 8,
        i18nKeyCount: 1200,
        bundleSizeKb: 4200,
        serviceCount: 65,
      }),
    [],
  );

  const certificate = useMemo(
    () => generateCenturyCertificate(testCount, version),
    [testCount, version],
  );

  const latency = useMemo(
    () => auditModalLatency(latencyComponent, latencyMs),
    [latencyComponent, latencyMs],
  );

  return (
    <div
      className={className}
      data-testid="grand-century-sentinel-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏅 7.500er Grand-Century-Sentinel & Audit
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {audit.passed}/{audit.checks.length} Checks · Score {Math.round(audit.overallScore * 100)}%
      </div>

      {/* Ökosystem-Audit */}
      <div
        data-testid="sentinel-audit"
        style={{
          border: `1px solid ${audit.healthy ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          GESAMT-ÖKOSYSTEM-AUDIT
        </div>
        {audit.checks.map((check) => (
          <div
            key={check.name}
            data-testid={`sentinel-check-${check.name}`}
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
          data-testid="sentinel-healthy"
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: audit.healthy ? "var(--success)" : "var(--error)",
          }}
        >
          {audit.healthy ? "✓ System gesund" : "⚠ System nicht gesund"}
        </div>
      </div>

      {/* Century-Zertifikat */}
      <div
        data-testid="sentinel-certificate"
        style={{
          border: `1px solid ${certificate.verified ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          7.500ER-CENTURY-ZERTIFIKAT
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
            Tests
            <input
              data-testid="sentinel-test-count"
              type="number"
              min={0}
              value={testCount}
              onChange={(e) => setTestCount(Number(e.target.value) || 0)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
            Version
            <input
              data-testid="sentinel-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
              }}
            />
          </label>
        </div>
        <div
          data-testid="sentinel-verified"
          style={{
            fontWeight: 700,
            color: certificate.verified ? "var(--success)" : "var(--warn)",
          }}
        >
          {certificate.verified ? "✓ Zertifikat verifiziert" : "⚠ Unter 7.500 Tests"}
        </div>
        <div
          data-testid="sentinel-hash"
          style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}
        >
          {certificate.hash.slice(0, 32)}…
        </div>
        <details data-testid="sentinel-svg" style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
            SVG-Badge anzeigen
          </summary>
          <div
            data-testid="sentinel-svg-content"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              marginTop: 6,
              overflow: "auto",
            }}
            dangerouslySetInnerHTML={{ __html: certificate.svg }}
          />
        </details>
        <details data-testid="sentinel-pdf" style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
            PDF-Inhalt anzeigen
          </summary>
          <pre
            data-testid="sentinel-pdf-content"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              marginTop: 6,
              maxHeight: 120,
              overflow: "auto",
            }}
          >
            {certificate.pdf}
          </pre>
        </details>
      </div>

      {/* Latenz-Audit */}
      <div
        data-testid="sentinel-latency"
        style={{
          border: `1px solid ${latency.withinBudget ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          LATENZ-AUDIT (60 FPS = 16 ms)
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 2, minWidth: 140 }}>
            Komponente
            <input
              data-testid="sentinel-latency-component"
              value={latencyComponent}
              onChange={(e) => setLatencyComponent(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            ms
            <input
              data-testid="sentinel-latency-ms"
              type="number"
              min={0}
              value={latencyMs}
              onChange={(e) => setLatencyMs(Number(e.target.value) || 0)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
              }}
            />
          </label>
        </div>
        <div>
          <strong data-testid="sentinel-latency-result">
            {latency.durationMs} ms
          </strong>{" "}
          / {latency.budgetMs} ms
        </div>
        <div
          data-testid="sentinel-latency-status"
          style={{
            marginTop: 4,
            fontWeight: 700,
            color: latency.withinBudget ? "var(--success)" : "var(--error)",
          }}
        >
          {latency.withinBudget ? "✓ Innerhalb des Budgets" : "⚠ Budget überschritten"}
        </div>
      </div>
    </div>
  );
}
