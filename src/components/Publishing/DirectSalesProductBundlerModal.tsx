// DirectSalesProductBundlerModal (Meilenstein 61.0 / v7.3.0)
//
// UI für den Direktvertriebs-Produkt- & Bundle-Generator: 3-Stufen-Preistreppe,
// Echtzeit-Margenvergleich gegen Amazon-KDP, Shopify-/WooCommerce-CSV-Export
// und verkaufspsychologische Produkttexte. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  PRICE_TIERS,
  compareMargins,
  generateShopifyCsv,
  generateWooCommerceCsv,
  generateProductCopy,
  createSamplePriceTier,
  createSampleBundle,
} from "@/services/publishing/directSalesProductBundler";

export interface DirectSalesProductBundlerModalProps {
  className?: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "3px 6px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
};

const euro = (v: number) => `${v.toFixed(2)} €`;

export function DirectSalesProductBundlerModal({ className }: DirectSalesProductBundlerModalProps) {
  const [seed, setSeed] = useState(42);
  const [tierId, setTierId] = useState(PRICE_TIERS[1].id);
  const [ebookListPrice, setEbookListPrice] = useState(7.99);
  const [amazonRoyaltyRate, setAmazonRoyaltyRate] = useState(0.7);

  const bundle = useMemo(() => createSampleBundle(), []);
  const sampleTier = useMemo(() => createSamplePriceTier(), []);

  const tier = useMemo(
    () => PRICE_TIERS.find((t) => t.id === tierId) ?? PRICE_TIERS[0],
    [tierId],
  );

  const comparison = useMemo(
    () => compareMargins(tier.id, ebookListPrice, amazonRoyaltyRate),
    [tier.id, ebookListPrice, amazonRoyaltyRate],
  );

  const shopify = useMemo(() => generateShopifyCsv(tier.id, seed), [tier.id, seed]);
  const woo = useMemo(() => generateWooCommerceCsv(tier.id, seed), [tier.id, seed]);
  const copy = useMemo(() => generateProductCopy(tier.id, seed), [tier.id, seed]);

  return (
    <div
      data-testid="direct-sales-modal"
      className={className}
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
      <h2 style={{ margin: "0 0 4px" }}>🛒 Direktvertriebs-Produkt- &amp; Bundle-Generator</h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
        {bundle.name} · Bundle {bundle.id} · {euro(bundle.price)}
      </p>

      <section style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>
          Seed{" "}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          E-Book-Listenpreis{" "}
          <input
            type="number"
            step="0.01"
            value={ebookListPrice}
            onChange={(e) => setEbookListPrice(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label>
          Amazon-Tantieme{" "}
          <input
            type="number"
            step="0.01"
            value={amazonRoyaltyRate}
            onChange={(e) => setAmazonRoyaltyRate(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>PREISSTUFEN</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {PRICE_TIERS.map((t) => (
            <li
              key={t.id}
              style={{
                border: "1px solid var(--border)",
                padding: 8,
                marginBottom: 6,
                background: t.id === tierId ? "var(--panel)" : "transparent",
              }}
            >
              <button
                onClick={() => setTierId(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {t.name}
              </button>{" "}
              — {euro(t.price)} (Reingewinn {euro(t.netProfit)})
              <div style={{ color: "var(--muted)" }}>{t.contents.join(" · ")}</div>
            </li>
          ))}
        </ul>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
          Beispiel-Sonderedition: {sampleTier.name} — {euro(sampleTier.price)} ·{" "}
          {euro(sampleTier.netProfit)} Reingewinn
        </p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>MARGENVERGLEICH</h3>
        <p style={{ margin: 0 }}>
          Stufe: <strong>{tier.name}</strong>
        </p>
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 6 }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Direktvertrieb netto</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{euro(comparison.directNet)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Amazon netto</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{euro(comparison.amazonNet)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Vorteil</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                {euro(comparison.advantage)} ({comparison.advantagePercent.toFixed(1)} %)
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{comparison.description}</p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>CSV-EXPORT</h3>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          {shopify.platform}: {shopify.rowCount} Zeile(n) — {shopify.description}
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
          {woo.platform}: {woo.rowCount} Zeile(n) — {woo.description}
        </p>
        <pre
          style={{
            margin: "8px 0 0",
            padding: 8,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {shopify.csv}
        </pre>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>PRODUKTTEXT</h3>
        <p style={{ margin: "0 0 6px", fontWeight: 700 }}>{copy.headline}</p>
        <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
          {copy.bulletPoints.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <p style={{ margin: 0, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{copy.description}</p>
      </section>
    </div>
  );
}
