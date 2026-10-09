// CrowdfundingProfitMaximizerModal (Meilenstein 61.0 / v7.3.0)
//
// UI für den Crowdfunding-Gewinn- & Tier-Maximierer: Reingewinn-Kalkulator,
// Tier-Architektur und Stretch-Goal-ROI-Prüfer. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  TIER_TEMPLATES,
  calculateNetProfit,
  optimizeTiers,
  checkStretchGoal,
  createSampleCampaign,
  createSampleStretchGoal,
  formatEuro,
  type ProfitInput,
} from "@/services/marketing/crowdfundingProfitMaximizer";

export interface CrowdfundingProfitMaximizerModalProps {
  className?: string;
}

export function CrowdfundingProfitMaximizerModal({
  className,
}: CrowdfundingProfitMaximizerModalProps) {
  const [seed, setSeed] = useState(42);
  const [units, setUnits] = useState(500);
  const [pricePerUnit, setPricePerUnit] = useState(25);
  const [printCostPerUnit, setPrintCostPerUnit] = useState(8.5);

  const profitInput: ProfitInput = useMemo(
    () => ({
      units,
      pricePerUnit,
      printCostPerUnit,
      freightPalletCost: 1200,
      shippingPerUnit: 3.2,
      packagingPerUnit: 0.9,
      platformFeePercent: 5,
      paymentFeePercent: 3,
    }),
    [units, pricePerUnit, printCostPerUnit],
  );

  const profit = useMemo(() => calculateNetProfit(profitInput), [profitInput]);
  const tiers = useMemo(() => optimizeTiers(units, seed), [units, seed]);
  const sampleCampaign = useMemo(() => createSampleCampaign(), []);
  const stretch = useMemo(
    () => checkStretchGoal(createSampleStretchGoal(), profit.netProfit, seed),
    [profit.netProfit, seed],
  );

  return (
    <div
      data-testid="crowdfunding-modal"
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
      <h2 style={{ margin: "0 0 12px" }}>🚀 Crowdfunding-Gewinn- &amp; Tier-Maximierer</h2>

      <section style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>
          Seed{" "}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            style={{ background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)" }}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Einheiten{" "}
          <input
            type="number"
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            style={{ background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)" }}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Preis/Einheit{" "}
          <input
            type="number"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(Number(e.target.value))}
            style={{ background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)" }}
          />
        </label>
        <label>
          Druckkosten/Einheit{" "}
          <input
            type="number"
            value={printCostPerUnit}
            onChange={(e) => setPrintCostPerUnit(Number(e.target.value))}
            style={{ background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)" }}
          />
        </label>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>REINGEWINN-KALKULATOR</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Bruttoumsatz</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.grossRevenue)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Plattform-Gebühren</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.platformFees)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Zahlungsgebühren</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.paymentFees)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Druckkosten</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.printCosts)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Fracht</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.freightCosts)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Porto</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.shippingCosts)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Verpackung</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.packagingCosts)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>Gesamtkosten</td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>{formatEuro(profit.totalCosts)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                <strong>Reingewinn</strong>
              </td>
              <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                <strong>{formatEuro(profit.netProfit)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
          Marge {profit.marginPercent.toFixed(1)} % · Break-even bei {profit.breakEvenUnits} Einheiten
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{profit.description}</p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>TIER-ARCHITEKTUR</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {TIER_TEMPLATES.map((t) => {
            const alloc = tiers.tiers.find((x) => x.tierId === t.id);
            return (
              <li
                key={t.id}
                style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}
              >
                <strong>{t.name}</strong> — {formatEuro(t.price)}
                {alloc ? ` · ${alloc.backers} Unterstützer · ${formatEuro(alloc.profit)} Gewinn` : ""}
                <div style={{ color: "var(--muted)" }}>{t.contents.join(" · ")}</div>
              </li>
            );
          })}
        </ul>
        <p style={{ margin: "8px 0 0" }}>
          Gesamtumsatz {formatEuro(tiers.totalRevenue)} · Gesamtgewinn{" "}
          {formatEuro(tiers.totalProfit)} · Beste Stufe: {tiers.bestTierId} ·
          Beispiel-Kampagne {sampleCampaign.length} Stufen
        </p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>STRETCH-GOAL-ROI</h3>
        <p style={{ margin: 0 }}>
          {stretch.profitable ? "✅ profitabel" : "❌ unrentabel"} · ROI{" "}
          {stretch.roiPercent.toFixed(0)} % · Gewinn {formatEuro(stretch.profitBefore)} →{" "}
          {formatEuro(stretch.profitAfter)}
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{stretch.recommendation}</p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{stretch.description}</p>
      </section>
    </div>
  );
}
