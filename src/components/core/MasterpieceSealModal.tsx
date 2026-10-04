// MasterpieceSealModal (WP 49.2): 6.000-Tests-Meisterwerk-Siegel.
//
// Ecosystem-Gesundheits-Scan, kryptografisches Jubiläums-Zertifikat
// und SVG-Siegel mit Verifikation.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  runEcosystemHealthScan,
  generateSealCertificate,
  generateSealSvg,
  verifySeal,
} from "@/services/core/masterpieceSeal";

export interface MasterpieceSealModalProps {
  open: boolean;
  onClose: () => void;
  testCount: number;
  version: string;
}

export function MasterpieceSealModal({
  open,
  onClose,
  testCount,
  version,
}: MasterpieceSealModalProps) {
  const [healthScan, setHealthScan] = useState<ReturnType<typeof runEcosystemHealthScan> | null>(null);
  const [certificate, setCertificate] = useState<ReturnType<typeof generateSealCertificate> | null>(null);
  const [sealSvg, setSealSvg] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);

  const handleScan = useCallback(() => {
    setHealthScan(runEcosystemHealthScan());
  }, []);

  const handleGenerate = useCallback(() => {
    const cert = generateSealCertificate(testCount, version);
    setCertificate(cert);
    setSealSvg(generateSealSvg(cert));
    setVerified(verifySeal(cert));
  }, [testCount, version]);

  const statusColor = useMemo(() => {
    if (!healthScan) return "var(--muted)";
    return healthScan.overallStatus === "ok"
      ? "var(--success)"
      : healthScan.overallStatus === "degraded"
        ? "var(--warn)"
        : "var(--error)";
  }, [healthScan]);

  if (!open) return null;

  return (
    <div
      data-testid="masterpiece-seal-modal"
      className="modal-backdrop"
      onClick={onClose}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 18,
          width: "min(680px, 94vw)",
          maxHeight: "88vh",
          overflow: "auto",
          color: "var(--fg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "var(--accent)" }}>
            🏆 Meisterwerk-Siegel
          </h3>
          <button
            data-testid="seal-close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--muted)",
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Schließen
          </button>
        </div>

        {/* Health Scan */}
        <div data-testid="seal-health-scan" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            ECOSYSTEM-GESUNDHEIT
          </div>
          <button
            data-testid="seal-scan-run"
            onClick={handleScan}
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Scan starten
          </button>
          {healthScan && (
            <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.7 }}>
              <div data-testid="seal-health-status" style={{ color: statusColor, fontWeight: 700 }}>
                Status: {healthScan.overallStatus}
              </div>
              <div data-testid="seal-health-cache">Cache: {healthScan.cacheStatus}</div>
              <div data-testid="seal-health-i18n">
                i18n-Vollständigkeit: {healthScan.i18nCompleteness}%
              </div>
              <div data-testid="seal-health-latency">
                Bundle-Latenz: {healthScan.bundleLatencyMs} ms
              </div>
              <div style={{ marginTop: 6 }}>
                {healthScan.tables.map((t) => (
                  <div key={t.name} data-testid={`seal-table-${t.name}`} style={{ fontSize: 10 }}>
                    · {t.name}: {t.rowCount} Zeilen, {(t.sizeBytes / 1024).toFixed(1)} KB — {t.status}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zertifikat */}
        <div data-testid="seal-certificate" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            JUBILÄUMS-ZERTIFIKAT
          </div>
          <button
            data-testid="seal-generate"
            onClick={handleGenerate}
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Siegel generieren
          </button>
          {certificate && (
            <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.7 }}>
              <div data-testid="seal-cert-id">ID: {certificate.id}</div>
              <div data-testid="seal-cert-tests">Tests: {certificate.testCount}</div>
              <div data-testid="seal-cert-version">Version: {certificate.version}</div>
              <div data-testid="seal-cert-hash">Hash: {certificate.hash.slice(0, 32)}…</div>
              <div data-testid="seal-cert-signature">Signatur: {certificate.signature.slice(0, 32)}…</div>
              <div data-testid="seal-cert-issuer">Aussteller: {certificate.issuer}</div>
              <div data-testid="seal-cert-verified" style={{ marginTop: 4, fontWeight: 700 }}>
                {verified ? "✓ Verifiziert" : "✗ Ungültig"}
              </div>
            </div>
          )}
        </div>

        {/* SVG-Siegel */}
        {sealSvg && (
          <div data-testid="seal-svg" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>SVG-SIEGEL</div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: sealSvg }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
