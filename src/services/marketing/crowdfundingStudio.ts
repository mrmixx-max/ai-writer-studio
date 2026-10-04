// crowdfundingStudio.ts — Marketing-Studio: Crowdfunding-Studio (WP 46.1).
//
// Plant Crowdfunding-Kampagnen (Kickstarter & Co.): Tiers, Stretch-Goals,
// Kostenschätzung (Druck, Verpackung, Versand je Zone, Plattform-/Zahlungs-
// gebühren), Netto-Gewinn sowie Markdown- und HTML-Export der Kampagnenseite.
//
// Lokal, deterministisch, defensiv — KEINE LLM-Aufrufe, keine Netzwerkzugriffe,
// kein Math.random, keine Zeitabhängigkeit. Fehlende/ungültige Daten liefern
// sichere Fallbacks statt Ausnahmen.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Eine Unterstützungsstufe (Reward-Tier) der Kampagne. */
export interface CampaignTier {
  id: string;
  name: string;
  price: number;
  description: string;
  estimatedBackers: number;
  /** Optionale Obergrenze verfügbarer Plätze; begrenzt die Backer-Schätzung. */
  limit?: number;
}

/** Ein Stretch-Goal, das bei Erreichen eines Betrags freigeschaltet wird. */
export interface StretchGoal {
  id: string;
  amount: number;
  title: string;
  description: string;
}

/** Eine Versandzone mit Kosten pro Einheit. */
export interface ShippingZone {
  id: string;
  name: string;
  costPerUnit: number;
}

/** Eingabekonfiguration für eine neue Kampagne. */
export interface CampaignConfig {
  title: string;
  goalAmount: number;
  currency: string;
  tiers: CampaignTier[];
  stretchGoals: StretchGoal[];
  printCostPerUnit: number;
  packagingCostPerUnit: number;
  shippingZones: ShippingZone[];
}

/** Fertige Kampagne (Config + deterministische ID). */
export interface Campaign {
  id: string;
  title: string;
  goalAmount: number;
  currency: string;
  tiers: CampaignTier[];
  stretchGoals: StretchGoal[];
  printCostPerUnit: number;
  packagingCostPerUnit: number;
  shippingZones: ShippingZone[];
}

/** Aufschlüsselung der Kosten einer Kampagne. */
export interface CostBreakdown {
  printCosts: number;
  packagingCosts: number;
  shippingCosts: { zone: string; cost: number }[];
  platformFees: number;
  paymentProcessingFees: number;
  totalCosts: number;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Kickstarter-Plattformgebühr: 5 % der Gesamteinnahmen. */
export const PLATFORM_FEE_RATE = 0.05;
/** Zahlungsabwicklungsgebühr: 3 % der Gesamteinnahmen. */
export const PAYMENT_PROCESSING_FEE_RATE = 0.03;
/** Gesamtgebührensatz: 8 % der Gesamteinnahmen. */
export const TOTAL_FEE_RATE = PLATFORM_FEE_RATE + PAYMENT_PROCESSING_FEE_RATE;

/** Standardwährung, wenn keine (gültige) angegeben ist. */
const DEFAULT_CURRENCY = "EUR";
/** Standard-Kampagnentitel, wenn keiner angegeben ist. */
const DEFAULT_TITLE = "Ohne Titel";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Liefert einen bereinigten String oder den Fallback bei leer/undefined/null. */
function safe(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Koerziert auf eine endliche, nicht-negative Zahl; sonst 0. */
function safeNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Rundet auf 2 Nachkommastellen — stabile, deterministische Geldbeträge. */
function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Deterministischer djb2-Hash (hex) — kein Math.random, keine Zeit. */
function deterministicHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

/** Escaped HTML-spezifische Zeichen. */
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Koerziert auf eine endliche Zahl (auch negativ); sonst 0. */
function finiteNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Formatiert einen Geldbetrag deterministisch: "EUR 12.34" (negativ erlaubt). */
function formatMoney(amount: number, currency: string): string {
  return `${safe(currency, DEFAULT_CURRENCY)} ${round2(finiteNumber(amount)).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

/** Normalisiert einen Tier defensiv. */
function normalizeTier(tier: CampaignTier | null | undefined, index: number): CampaignTier {
  const t = tier && typeof tier === "object" ? tier : ({} as CampaignTier);
  const hasLimit = typeof t.limit === "number" && Number.isFinite(t.limit) && t.limit >= 0;
  return {
    id: safe(t.id, `tier-${index + 1}`),
    name: safe(t.name, `Stufe ${index + 1}`),
    price: safeNumber(t.price),
    description: safe(t.description, ""),
    estimatedBackers: safeNumber(t.estimatedBackers),
    ...(hasLimit ? { limit: Math.floor(safeNumber(t.limit)) } : {}),
  };
}

/** Normalisiert ein Stretch-Goal defensiv. */
function normalizeStretchGoal(
  goal: StretchGoal | null | undefined,
  index: number,
): StretchGoal {
  const g = goal && typeof goal === "object" ? goal : ({} as StretchGoal);
  return {
    id: safe(g.id, `goal-${index + 1}`),
    amount: safeNumber(g.amount),
    title: safe(g.title, `Stretch-Goal ${index + 1}`),
    description: safe(g.description, ""),
  };
}

/** Normalisiert eine Versandzone defensiv. */
function normalizeShippingZone(
  zone: ShippingZone | null | undefined,
  index: number,
): ShippingZone {
  const z = zone && typeof zone === "object" ? zone : ({} as ShippingZone);
  return {
    id: safe(z.id, `zone-${index + 1}`),
    name: safe(z.name, `Zone ${index + 1}`),
    costPerUnit: safeNumber(z.costPerUnit),
  };
}

// ---------------------------------------------------------------------------
// Kampagne erzeugen
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine Kampagne aus der Konfiguration.
 *
 * Defensiv: `null`/`undefined`-Config, fehlende/ungültige Zahlen und Arrays
 * werden auf sichere Defaults abgebildet. Die ID ist deterministisch aus Titel,
 * Zielbetrag und Währung abgeleitet (gleiche Eingabe → gleiche ID).
 */
export function createCampaign(config: CampaignConfig | null | undefined): Campaign {
  const c: Partial<CampaignConfig> =
    config && typeof config === "object" ? config : {};

  const title = safe(c.title, DEFAULT_TITLE);
  const currency = safe(c.currency, DEFAULT_CURRENCY);
  const goalAmount = safeNumber(c.goalAmount);

  const tiers: CampaignTier[] = Array.isArray(c.tiers)
    ? c.tiers.map((t, i) => normalizeTier(t, i))
    : [];
  const stretchGoals: StretchGoal[] = Array.isArray(c.stretchGoals)
    ? c.stretchGoals.map((g, i) => normalizeStretchGoal(g, i))
    : [];
  const shippingZones: ShippingZone[] = Array.isArray(c.shippingZones)
    ? c.shippingZones.map((z, i) => normalizeShippingZone(z, i))
    : [];

  const id = `campaign-${deterministicHash(`${title}|${goalAmount}|${currency}`)}`;

  return {
    id,
    title,
    goalAmount,
    currency,
    tiers,
    stretchGoals,
    printCostPerUnit: safeNumber(c.printCostPerUnit),
    packagingCostPerUnit: safeNumber(c.packagingCostPerUnit),
    shippingZones,
  };
}

// ---------------------------------------------------------------------------
// Kennzahlen
// ---------------------------------------------------------------------------

/**
 * Effektive Backer-Zahl eines Tiers: `estimatedBackers`, begrenzt durch ein
 * gesetztes `limit` (falls vorhanden).
 */
function effectiveBackers(tier: CampaignTier): number {
  const estimate = safeNumber(tier.estimatedBackers);
  if (typeof tier.limit === "number" && Number.isFinite(tier.limit)) {
    return Math.min(estimate, Math.floor(safeNumber(tier.limit)));
  }
  return estimate;
}

/** Summe der geschätzten Backer über alle Tiers (limit-gedeckelt). */
export function calculateTotalBackers(campaign: Campaign | null | undefined): number {
  const tiers = campaign && Array.isArray(campaign.tiers) ? campaign.tiers : [];
  return tiers.reduce((sum, tier) => sum + effectiveBackers(tier), 0);
}

/** Brutto-Einnahmen: Summe (Preis × effektive Backer) über alle Tiers. */
export function calculateGrossRevenue(campaign: Campaign | null | undefined): number {
  const tiers = campaign && Array.isArray(campaign.tiers) ? campaign.tiers : [];
  const total = tiers.reduce(
    (sum, tier) => sum + safeNumber(tier.price) * effectiveBackers(tier),
    0,
  );
  return round2(total);
}

// ---------------------------------------------------------------------------
// Kostenkalkulation
// ---------------------------------------------------------------------------

/**
 * Berechnet die Kostenaufschlüsselung einer Kampagne.
 *
 * - Druckkosten:        printCostPerUnit × Gesamt-Backer
 * - Verpackungskosten:  packagingCostPerUnit × Gesamt-Backer
 * - Versandkosten:      je Zone costPerUnit × Gesamt-Backer
 * - Plattformgebühren:  5 % der Brutto-Einnahmen
 * - Zahlungsgebühren:   3 % der Brutto-Einnahmen (zusammen 8 %)
 *
 * Defensiv: `null`/`undefined`-Kampagne → alle Kosten 0.
 */
export function calculateCosts(campaign: Campaign | null | undefined): CostBreakdown {
  const safeCampaign: Partial<Campaign> =
    campaign && typeof campaign === "object" ? campaign : {};

  const backers = calculateTotalBackers(safeCampaign as Campaign);
  const revenue = calculateGrossRevenue(safeCampaign as Campaign);

  const printCosts = round2(safeNumber(safeCampaign.printCostPerUnit) * backers);
  const packagingCosts = round2(
    safeNumber(safeCampaign.packagingCostPerUnit) * backers,
  );

  const zones = Array.isArray(safeCampaign.shippingZones)
    ? safeCampaign.shippingZones
    : [];
  const shippingCosts = zones.map((zone) => ({
    zone: safe(zone?.name, "Zone"),
    cost: round2(safeNumber(zone?.costPerUnit) * backers),
  }));
  const totalShipping = round2(
    shippingCosts.reduce((sum, entry) => sum + entry.cost, 0),
  );

  const platformFees = round2(revenue * PLATFORM_FEE_RATE);
  const paymentProcessingFees = round2(revenue * PAYMENT_PROCESSING_FEE_RATE);

  const totalCosts = round2(
    printCosts +
      packagingCosts +
      totalShipping +
      platformFees +
      paymentProcessingFees,
  );

  return {
    printCosts,
    packagingCosts,
    shippingCosts,
    platformFees,
    paymentProcessingFees,
    totalCosts,
  };
}

/**
 * Netto-Gewinn nach allen Kosten: Brutto-Einnahmen − Gesamtkosten.
 * Kann negativ sein, wenn die Kosten die Einnahmen übersteigen.
 * Defensiv: `null`/`undefined`-Kampagne → 0.
 */
export function calculateNetProfit(campaign: Campaign | null | undefined): number {
  const revenue = calculateGrossRevenue(campaign);
  const { totalCosts } = calculateCosts(campaign);
  return round2(revenue - totalCosts);
}

// ---------------------------------------------------------------------------
// Export: Markdown
// ---------------------------------------------------------------------------

/**
 * Formatiert die Kampagnenseite als Markdown.
 * Defensiv: `null`/`undefined`-Kampagne → minimaler, gültiger Text.
 */
export function exportCampaignMarkdown(campaign: Campaign | null | undefined): string {
  const c: Partial<Campaign> = campaign && typeof campaign === "object" ? campaign : {};
  const title = safe(c.title, DEFAULT_TITLE);
  const currency = safe(c.currency, DEFAULT_CURRENCY);
  const goalAmount = safeNumber(c.goalAmount);

  const tiers = Array.isArray(c.tiers) ? c.tiers : [];
  const stretchGoals = Array.isArray(c.stretchGoals) ? c.stretchGoals : [];
  const costs = calculateCosts(c as Campaign);
  const revenue = calculateGrossRevenue(c as Campaign);
  const netProfit = calculateNetProfit(c as Campaign);
  const backers = calculateTotalBackers(c as Campaign);

  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`**Finanzierungsziel:** ${formatMoney(goalAmount, currency)}`);
  lines.push(`**Geschätzte Unterstützer:innen:** ${backers}`);
  lines.push("");

  lines.push("## Belohnungsstufen");
  lines.push("");
  if (tiers.length === 0) {
    lines.push("_Keine Stufen definiert._");
  } else {
    lines.push("| Stufe | Preis | Geschätzte Backer | Beschreibung |");
    lines.push("| --- | --- | --- | --- |");
    for (const tier of tiers) {
      const price = formatMoney(tier.price, currency);
      const limitNote =
        typeof tier.limit === "number" && Number.isFinite(tier.limit)
          ? ` (max. ${Math.floor(safeNumber(tier.limit))})`
          : "";
      lines.push(
        `| ${tier.name} | ${price} | ${effectiveBackers(tier)}${limitNote} | ${tier.description} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Stretch-Goals");
  lines.push("");
  if (stretchGoals.length === 0) {
    lines.push("_Keine Stretch-Goals definiert._");
  } else {
    for (const goal of stretchGoals) {
      lines.push(`- **${formatMoney(goal.amount, currency)} — ${goal.title}**: ${goal.description}`);
    }
  }
  lines.push("");

  lines.push("## Kostenaufschlüsselung");
  lines.push("");
  lines.push(`- Brutto-Einnahmen: ${formatMoney(revenue, currency)}`);
  lines.push(`- Druckkosten: ${formatMoney(costs.printCosts, currency)}`);
  lines.push(`- Verpackungskosten: ${formatMoney(costs.packagingCosts, currency)}`);
  if (costs.shippingCosts.length === 0) {
    lines.push(`- Versandkosten: ${formatMoney(0, currency)}`);
  } else {
    for (const entry of costs.shippingCosts) {
      lines.push(`- Versand ${entry.zone}: ${formatMoney(entry.cost, currency)}`);
    }
  }
  lines.push(`- Plattformgebühren (5 %): ${formatMoney(costs.platformFees, currency)}`);
  lines.push(
    `- Zahlungsabwicklung (3 %): ${formatMoney(costs.paymentProcessingFees, currency)}`,
  );
  lines.push(`- **Gesamtkosten: ${formatMoney(costs.totalCosts, currency)}**`);
  lines.push("");
  lines.push(`## Netto-Gewinn: ${formatMoney(netProfit, currency)}`);
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Export: HTML
// ---------------------------------------------------------------------------

/**
 * HTML-Version der Kampagnenseite. Alle dynamischen Inhalte werden escaped.
 * Defensiv: `null`/`undefined`-Kampagne → minimale, gültige HTML-Seite.
 */
export function exportCampaignHtml(campaign: Campaign | null | undefined): string {
  const c: Partial<Campaign> = campaign && typeof campaign === "object" ? campaign : {};
  const title = safe(c.title, DEFAULT_TITLE);
  const currency = safe(c.currency, DEFAULT_CURRENCY);
  const goalAmount = safeNumber(c.goalAmount);

  const tiers = Array.isArray(c.tiers) ? c.tiers : [];
  const stretchGoals = Array.isArray(c.stretchGoals) ? c.stretchGoals : [];
  const costs = calculateCosts(c as Campaign);
  const revenue = calculateGrossRevenue(c as Campaign);
  const netProfit = calculateNetProfit(c as Campaign);
  const backers = calculateTotalBackers(c as Campaign);

  const tierItems =
    tiers.length === 0
      ? `      <li class="empty">Keine Stufen definiert.</li>`
      : tiers
          .map((tier) => {
            const limitNote =
              typeof tier.limit === "number" && Number.isFinite(tier.limit)
                ? ` <span class="limit">(max. ${escapeHtml(Math.floor(safeNumber(tier.limit)))})</span>`
                : "";
            return [
              `      <li class="tier">`,
              `        <h3>${escapeHtml(tier.name)} — ${escapeHtml(formatMoney(tier.price, currency))}</h3>`,
              `        <p class="backers">Geschätzte Backer: ${escapeHtml(effectiveBackers(tier))}${limitNote}</p>`,
              `        <p>${escapeHtml(tier.description)}</p>`,
              `      </li>`,
            ].join("\n");
          })
          .join("\n");

  const goalItems =
    stretchGoals.length === 0
      ? `      <li class="empty">Keine Stretch-Goals definiert.</li>`
      : stretchGoals
          .map(
            (goal) =>
              `      <li><strong>${escapeHtml(formatMoney(goal.amount, currency))} — ${escapeHtml(
                goal.title,
              )}</strong>: ${escapeHtml(goal.description)}</li>`,
          )
          .join("\n");

  const shippingItems =
    costs.shippingCosts.length === 0
      ? `      <li>Versandkosten: ${escapeHtml(formatMoney(0, currency))}</li>`
      : costs.shippingCosts
          .map(
            (entry) =>
              `      <li>Versand ${escapeHtml(entry.zone)}: ${escapeHtml(
                formatMoney(entry.cost, currency),
              )}</li>`,
          )
          .join("\n");

  return [
    "<!DOCTYPE html>",
    `<html lang="de">`,
    "  <head>",
    `    <meta charset="utf-8" />`,
    `    <title>${escapeHtml(title)} — Crowdfunding</title>`,
    "  </head>",
    "  <body>",
    `    <main class="campaign">`,
    `      <h1>${escapeHtml(title)}</h1>`,
    `      <p class="goal"><strong>Finanzierungsziel:</strong> ${escapeHtml(
      formatMoney(goalAmount, currency),
    )}</p>`,
    `      <p class="backers"><strong>Geschätzte Unterstützer:innen:</strong> ${escapeHtml(backers)}</p>`,
    `      <section class="tiers">`,
    `        <h2>Belohnungsstufen</h2>`,
    `        <ul>`,
    tierItems,
    `        </ul>`,
    `      </section>`,
    `      <section class="stretch-goals">`,
    `        <h2>Stretch-Goals</h2>`,
    `        <ul>`,
    goalItems,
    `        </ul>`,
    `      </section>`,
    `      <section class="costs">`,
    `        <h2>Kostenaufschlüsselung</h2>`,
    `        <ul>`,
    `      <li>Brutto-Einnahmen: ${escapeHtml(formatMoney(revenue, currency))}</li>`,
    `      <li>Druckkosten: ${escapeHtml(formatMoney(costs.printCosts, currency))}</li>`,
    `      <li>Verpackungskosten: ${escapeHtml(formatMoney(costs.packagingCosts, currency))}</li>`,
    shippingItems,
    `      <li>Plattformgebühren (5 %): ${escapeHtml(formatMoney(costs.platformFees, currency))}</li>`,
    `      <li>Zahlungsabwicklung (3 %): ${escapeHtml(
      formatMoney(costs.paymentProcessingFees, currency),
    )}</li>`,
    `      <li><strong>Gesamtkosten: ${escapeHtml(formatMoney(costs.totalCosts, currency))}</strong></li>`,
    `        </ul>`,
    `      </section>`,
    `      <p class="net-profit"><strong>Netto-Gewinn:</strong> ${escapeHtml(
      formatMoney(netProfit, currency),
    )}</p>`,
    `    </main>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}
