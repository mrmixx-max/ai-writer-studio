// GlobalRoyaltyAggregatorModal (WP 83.2)
//
// Interaktiver globaler Tantiemen- & Abrechnungs-Aggregator.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateRoyaltyReport,
  formatRoyaltyReport,
  PLATFORM_LABELS,
  type Platform,
  type Sale,
} from "@/services/publishing/globalRoyaltyAggregator";

export interface GlobalRoyaltyAggregatorModalProps {
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

export function GlobalRoyaltyAggregatorModal({ className }: GlobalRoyaltyAggregatorModalProps) {
  const [sales, setSales] = useState<Sale[]>([
    { platform: "kdp", amount: 100, currency: "USD", date: "1970-01-01T00:00:00.000Z" },
    { platform: "apple", amount: 50, currency: "EUR", date: "1970-01-01T00:00:00.000Z" },
    { platform: "direct", amount: 200, currency: "EUR", date: "1970-01-01T00:00:00.000Z" },
  ]);

  const report = useMemo(() => generateRoyaltyReport(sales), [sales]);

  const addSale = () => {
    setSales((prev) => [
      ...prev,
      { platform: "kdp", amount: 0, currency: "EUR", date: "1970-01-01T00:00:00.000Z" },
    ]);
  };

  const updateSale = (index: number, field: keyof Sale, value: string | number) => {
    setSales((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  return (
    <div
      className={className}
      data-testid="global-royalty-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💰 Globaler Tantiemen- & Abrechnungs-Aggregator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {report.lines.length} Transaktionen · Netto {report.totalNet} {report.currency}
      </div>

      {/* Transaktionen */}
      <div
        data-testid="royalty-sales"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TRANSAKTIONEN</div>
        {sales.map((sale, i) => (
          <div key={i} data-testid={`royalty-sale-${i}`} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select
                data-testid={`royalty-platform-${i}`}
                value={sale.platform}
                onChange={(e) => updateSale(i, "platform", e.target.value)}
                style={{ ...inputStyle, width: "auto", minWidth: 100 }}
              >
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
              <input
                data-testid={`royalty-amount-${i}`}
                type="number"
                value={sale.amount}
                onChange={(e) => updateSale(i, "amount", Number(e.target.value) || 0)}
                style={{ ...inputStyle, width: "auto", minWidth: 80 }}
              />
              <select
                data-testid={`royalty-currency-${i}`}
                value={sale.currency}
                onChange={(e) => updateSale(i, "currency", e.target.value)}
                style={{ ...inputStyle, width: "auto", minWidth: 80 }}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
          </div>
        ))}
        <button
          data-testid="royalty-add-sale"
          onClick={addSale}
          style={{
            fontSize: 11,
            padding: "4px 12px",
            borderRadius: 4,
            cursor: "pointer",
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
          }}
        >
          + Transaktion
        </button>
      </div>

      {/* Bericht */}
      <div
        data-testid="royalty-report"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>ABRECHNUNG</div>
        {report.lines.map((line, i) => (
          <div key={i} data-testid={`royalty-line-${i}`} style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>●</span> {PLATFORM_LABELS[line.platform]}: {line.grossAmount} → {line.netAmount} {line.currency}
          </div>
        ))}
        <div
          data-testid="royalty-total"
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: "var(--accent)",
          }}
        >
          Netto: {report.totalNet} {report.currency}
        </div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="royalty-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="royalty-text"
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
          {formatRoyaltyReport(report)}
        </pre>
      </details>
    </div>
  );
}
