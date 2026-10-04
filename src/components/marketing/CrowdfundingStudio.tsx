// CrowdfundingStudio (WP 46.1): Crowdfunding- & Kickstarter-Studio.
//
// Tier- & Belohnungs-Planer, Stretch-Goal-Roadmap, Kalkulations-Engine
// und 1-Klick-Export der Kampagnen-Seite als Markdown/HTML.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  createCampaign,
  calculateCosts,
  calculateNetProfit,
  exportCampaignMarkdown,
  exportCampaignHtml,
  type CampaignConfig,
} from "@/services/marketing/crowdfundingStudio";

export interface CrowdfundingStudioProps {
  className?: string;
}

const DEFAULT_CONFIG: CampaignConfig = {
  title: "Der letzte Winter — Prachtausgabe",
  goalAmount: 15000,
  currency: "EUR",
  tiers: [
    { id: "t1", name: "Frühbucher E-Book", price: 9, description: "Digitales E-Book (EPUB/PDF)", estimatedBackers: 200 },
    { id: "t2", name: "Signiertes Hardcover", price: 35, description: "Hardcover mit Signatur", estimatedBackers: 150 },
    { id: "t3", name: "Collector's Box", price: 89, description: "Box mit Goodies, Lesezeichen, Wallpaper", estimatedBackers: 50 },
  ],
  stretchGoals: [
    { id: "s1", amount: 5000, title: "Lesebändchen", description: "Bei 5.000 €: Lesebändchen für alle" },
    { id: "s2", amount: 10000, title: "Farbschnitt", description: "Bei 10.000 €: Farbschnitt im Buch" },
    { id: "s3", amount: 15000, title: "Bonus-Hörspiel", description: "Bei 15.000 €: Bonus-Hörspiel-Kapitel" },
  ],
  printCostPerUnit: 12,
  packagingCostPerUnit: 3,
  shippingZones: [
    { id: "de", name: "Deutschland", costPerUnit: 4 },
    { id: "eu", name: "EU", costPerUnit: 8 },
    { id: "world", name: "Welt", costPerUnit: 15 },
  ],
};

export function CrowdfundingStudio({ className }: CrowdfundingStudioProps) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [exportFormat, setExportFormat] = useState<"markdown" | "html">("markdown");
  const [exported, setExported] = useState("");

  const campaign = useMemo(() => createCampaign(config), [config]);
  const costs = useMemo(() => calculateCosts(campaign), [campaign]);
  const netProfit = useMemo(() => calculateNetProfit(campaign), [campaign]);

  const totalBackers = config.tiers.reduce((s, t) => s + t.estimatedBackers, 0);
  const totalRevenue = config.tiers.reduce((s, t) => s + t.price * t.estimatedBackers, 0);

  const handleExport = useCallback(() => {
    setExported(exportFormat === "markdown" ? exportCampaignMarkdown(campaign) : exportCampaignHtml(campaign));
  }, [campaign, exportFormat]);

  return (
    <div
      className={className}
      data-testid="crowdfunding-studio"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💰 {config.title}
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Ziel: {config.goalAmount.toLocaleString("de-DE")} € · {totalBackers} Backer ·{" "}
        {totalRevenue.toLocaleString("de-DE")} € Umsatz
      </div>

      {/* Kampagnentitel */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12, maxWidth: 520 }}>
        Kampagnentitel
        <input
          data-testid="crowdfunding-title"
          value={config.title}
          onChange={(e) => setConfig({ ...config, title: e.target.value })}
          style={{
            display: "block",
            width: "100%",
            marginTop: 3,
            background: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "5px 7px",
            fontSize: 12,
            boxSizing: "border-box",
          }}
        />
      </label>

      {/* Tiers */}
      <div data-testid="crowdfunding-tiers" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          TIERS ({config.tiers.length})
        </div>
        {config.tiers.map((t) => (
          <div
            key={t.id}
            data-testid={`crowdfunding-tier-${t.id}`}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "8px 12px",
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 12, color: "var(--accent)" }}>{t.name}</strong>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t.price} €</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.description}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              ~{t.estimatedBackers} Backer · {t.price * t.estimatedBackers} €
            </div>
          </div>
        ))}
      </div>

      {/* Stretch Goals */}
      <div data-testid="crowdfunding-stretch-goals" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          STRETCH-GOALS ({config.stretchGoals.length})
        </div>
        {config.stretchGoals.map((sg) => {
          const reached = totalRevenue >= sg.amount;
          return (
            <div
              key={sg.id}
              data-testid={`crowdfunding-stretch-${sg.id}`}
              style={{
                borderLeft: `3px solid ${reached ? "var(--success)" : "var(--border)"}`,
                paddingLeft: 10,
                marginBottom: 6,
                opacity: reached ? 1 : 0.7,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>
                {reached ? "✓" : "○"} {sg.amount.toLocaleString("de-DE")} € — {sg.title}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{sg.description}</div>
            </div>
          );
        })}
      </div>

      {/* Kosten */}
      <div
        data-testid="crowdfunding-costs"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>KOSTEN</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          <div data-testid="crowdfunding-print-costs">Druck: {costs.printCosts.toFixed(2)} €</div>
          <div data-testid="crowdfunding-packaging-costs">Verpackung: {costs.packagingCosts.toFixed(2)} €</div>
          <div data-testid="crowdfunding-shipping-costs">
            Versand: {costs.shippingCosts.reduce((s, z) => s + z.cost, 0).toFixed(2)} €
          </div>
          <div data-testid="crowdfunding-platform-fees">
            Plattformgebühren (8%): {costs.platformFees.toFixed(2)} €
          </div>
          <div data-testid="crowdfunding-total-costs">
            <strong>Gesamt: {costs.totalCosts.toFixed(2)} €</strong>
          </div>
          <div
            data-testid="crowdfunding-net-profit"
            style={{ marginTop: 6, color: netProfit >= 0 ? "var(--success)" : "var(--error)" }}
          >
            Netto-Gewinn: {netProfit.toFixed(2)} €
          </div>
        </div>
      </div>

      {/* Export */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <select
          data-testid="crowdfunding-export-format"
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "markdown" | "html")}
          style={{
            background: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "5px 7px",
            fontSize: 11,
          }}
        >
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
        </select>
        <button
          data-testid="crowdfunding-export"
          onClick={handleExport}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Exportieren
        </button>
      </div>

      {exported && (
        <pre
          data-testid="crowdfunding-export-output"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
            maxHeight: 240,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {exported}
        </pre>
      )}
    </div>
  );
}
