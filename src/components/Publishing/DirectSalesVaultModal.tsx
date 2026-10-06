// DirectSalesVaultModal (WP 75.2)
//
// Interaktiver Ex-Libris- & Lizenz-Tresor für Direktvertrieb.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createProduct,
  formatProduct,
  verifyWatermark,
  verifyLicense,
  generateExLibrisFrontispiz,
} from "@/services/publishing/directSalesVault";

export interface DirectSalesVaultModalProps {
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

export function DirectSalesVaultModal({ className }: DirectSalesVaultModalProps) {
  const [title, setTitle] = useState("Der Schatten des Vergessens");
  const [format, setFormat] = useState<"epub" | "pdf" | "mobi">("epub");
  const [price, setPrice] = useState(14.99);
  const [ownerName, setOwnerName] = useState("Erik Gieske");
  const [transactionId, setTransactionId] = useState("TXN-2026-001");
  const [edition, setEdition] = useState("Sammler-Edition");

  const product = useMemo(
    () => createProduct(title, format, price, ownerName, transactionId, edition),
    [title, format, price, ownerName, transactionId, edition],
  );

  const watermarkValid = useMemo(() => verifyWatermark(product.watermark), [product]);
  const licenseValid = useMemo(() => verifyLicense(product.license), [product]);

  return (
    <div
      className={className}
      data-testid="direct-sales-vault-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔐 Direktvertriebs-Ex-Libris- & Lizenz-Tresor
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {product.title} · {product.format.toUpperCase()} · {product.price} {product.currency}
      </div>

      {/* Eingabe */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Titel
          <input
            data-testid="vault-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Format
          <select
            data-testid="vault-format-select"
            value={format}
            onChange={(e) => setFormat(e.target.value as "epub" | "pdf" | "mobi")}
            style={inputStyle}
          >
            <option value="epub">EPUB</option>
            <option value="pdf">PDF</option>
            <option value="mobi">MOBI</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Preis (EUR)
          <input
            data-testid="vault-price-input"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Käufer
          <input
            data-testid="vault-owner-input"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Transaktion
          <input
            data-testid="vault-transaction-input"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Edition
          <input
            data-testid="vault-edition-input"
            value={edition}
            onChange={(e) => setEdition(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Wasserzeichen */}
      <div
        data-testid="vault-watermark"
        style={{
          border: `1px solid ${watermarkValid ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>WASSERZEICHEN</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Besitzer: {product.watermark.ownerName}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Transaktion: {product.watermark.transactionId}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Signatur: {product.watermark.signature}
        </div>
        <div
          data-testid="vault-watermark-valid"
          style={{
            fontSize: 10,
            color: watermarkValid ? "var(--success)" : "var(--error)",
            marginTop: 4,
          }}
        >
          {watermarkValid ? "✓ Verifiziert" : "✗ Ungültig"}
        </div>
      </div>

      {/* Lizenz */}
      <div
        data-testid="vault-license"
        style={{
          border: `1px solid ${licenseValid ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>LIZENZ</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>ID: {product.license.id}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Edition: {product.license.edition}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Seriennummer: {product.license.serialNumber}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Hash: {product.license.authenticityHash}
        </div>
        <div
          data-testid="vault-license-valid"
          style={{
            fontSize: 10,
            color: licenseValid ? "var(--success)" : "var(--error)",
            marginTop: 4,
          }}
        >
          {licenseValid ? "✓ Verifiziert" : "✗ Ungültig"}
        </div>
      </div>

      {/* Ex-Libris-Frontispiz */}
      <div
        data-testid="vault-frontispiz"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>EX-LIBRIS-FRONTSPIZ</div>
        <div
          data-testid="vault-frontispiz-svg"
          dangerouslySetInnerHTML={{ __html: generateExLibrisFrontispiz(ownerName) }}
        />
      </div>

      {/* Vollständige Ausgabe */}
      <details data-testid="vault-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="vault-report-text"
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
          {formatProduct(product)}
        </pre>
      </details>
    </div>
  );
}
