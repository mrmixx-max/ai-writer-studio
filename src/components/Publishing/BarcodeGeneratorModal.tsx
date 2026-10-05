// BarcodeGeneratorModal (WP 53.1): Vektor-ISBN- & Barcode-Generator (EAN-13).
//
// EAN-13-Prüfziffern-Validierung, 100% K-Only Vektor-SVG und QR-Code-Generator.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useMemo, useState } from "react";
import {
  validateEan13,
  generateBarcodeSvg,
  generateQrSvg,
} from "@/services/publishing/barcodeGenerator";

export interface BarcodeGeneratorModalProps {
  open: boolean;
  onClose: () => void;
}

export function BarcodeGeneratorModal({ open, onClose }: BarcodeGeneratorModalProps) {
  const [ean, setEan] = useState("9783161484100");
  const [showPrice, setShowPrice] = useState(false);
  const [price, setPrice] = useState("19,99");
  const [qrData, setQrData] = useState("https://example.com/autor");

  const isValid = useMemo(() => validateEan13(ean), [ean]);
  const barcodeSvg = useMemo(
    () => (isValid ? generateBarcodeSvg(ean, { showPrice, price }) : ""),
    [ean, isValid, showPrice, price],
  );
  const qrSvg = useMemo(() => generateQrSvg(qrData), [qrData]);


  if (!open) return null;

  return (
    <div
      data-testid="barcode-generator-modal"
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
            📊 Barcode-Generator
          </h3>
          <button
            data-testid="barcode-close"
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

        {/* EAN-13 */}
        <div data-testid="barcode-ean" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>EAN-13</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              data-testid="barcode-ean-input"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              style={{
                flex: 1,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            />
            <div
              data-testid="barcode-valid"
              style={{
                padding: "5px 12px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                background: isValid ? "var(--success)" : "var(--error)",
                color: "var(--bg)",
              }}
            >
              {isValid ? "Gültig" : "Ungültig"}
            </div>
          </div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
            <input
              data-testid="barcode-show-price"
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
            />
            Preis anzeigen
          </label>
          {showPrice && (
            <input
              data-testid="barcode-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                width: 100,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "4px 6px",
                fontSize: 11,
              }}
            />
          )}
        </div>

        {/* Barcode-Vorschau */}
        {barcodeSvg && (
          <div data-testid="barcode-preview" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>BARCODE (K-ONLY)</div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                display: "flex",
                justifyContent: "center",
                background: "var(--bg)",
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
            </div>
          </div>
        )}

        {/* QR-Code */}
        <div data-testid="barcode-qr" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>QR-CODE</div>
          <input
            data-testid="barcode-qr-input"
            value={qrData}
            onChange={(e) => setQrData(e.target.value)}
            style={{
              width: "100%",
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 12,
              boxSizing: "border-box",
              marginBottom: 8,
            }}
          />
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              display: "flex",
              justifyContent: "center",
              background: "var(--bg)",
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
        </div>
      </div>
    </div>
  );
}
