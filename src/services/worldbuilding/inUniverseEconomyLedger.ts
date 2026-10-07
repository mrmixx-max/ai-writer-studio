// InUniverseEconomyLedger (WP 90.2)
// In-Universe Währungs- & Kaufkraft-Hauptbuch.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CurrencyTier {
  name: string;
  symbol: string;
  valueInBase: number; // Wert in kleinster Einheit (z.B. 1 Gold = 240 Kupfer)
  description: string;
}

export interface CurrencySystem {
  id: string;
  name: string;
  baseUnit: string; // Name der kleinsten Einheit
  tiers: CurrencyTier[];
  seed: number;
}

export interface PriceEntry {
  item: string;
  category: "food" | "lodging" | "wages" | "equipment" | "luxury" | "transport";
  price: number; // in Base-Einheiten
  unit: string;
}

export interface EconomyLedger {
  currency: CurrencySystem;
  prices: PriceEntry[];
  dailyWage: number; // in Base-Einheiten
  inflationRate: number; // Prozent
  plausibility: { valid: boolean; issues: string[] };
}

const FANTASY_CURRENCY = {
  name: "Klassisches Fantasy-System",
  baseUnit: "Kupferheller",
  tiers: [
    { name: "Goldkrone", symbol: "👑", valueInBase: 240, description: "20 Silberschillinge" },
    { name: "Silberschilling", symbol: "🥈", valueInBase: 12, description: "12 Kupferheller" },
    { name: "Kupferheller", symbol: "🥉", valueInBase: 1, description: "Basiseinheit" },
  ],
};

const SCIFI_CURRENCY = {
  name: "Sci-Fi Credits",
  baseUnit: "Micro-Credit",
  tiers: [
    { name: "Mega-Credit", symbol: "💳", valueInBase: 1000000, description: "1.000.000 Micro-Credits" },
    { name: "Kilo-Credit", symbol: "💰", valueInBase: 1000, description: "1.000 Micro-Credits" },
    { name: "Credit", symbol: "🪙", valueInBase: 1, description: "Basiseinheit" },
  ],
};

const HISTORICAL_CURRENCY = {
  name: "Historisch (Mittelalterlich)",
  baseUnit: "Pfennig",
  tiers: [
    { name: "Gulden", symbol: "💰", valueInBase: 240, description: "60 Kreuzer / 240 Pfennig" },
    { name: "Kreuzer", symbol: "✝️", valueInBase: 4, description: "4 Pfennig" },
    { name: "Pfennig", symbol: "🪙", valueInBase: 1, description: "Basiseinheit" },
  ],
};

const PRICE_TEMPLATES: Record<string, { base: number; variance: number; unit: string }> = {
  // Nahrung
  "Brotlaib": { base: 4, variance: 2, unit: "Stück" },
  "Bier (Krug)": { base: 2, variance: 1, unit: "Krug" },
  "Wein (Flasche)": { base: 24, variance: 12, unit: "Flasche" },
  "Käse (Laib)": { base: 12, variance: 6, unit: "Laib" },
  "Fleisch (Pfund)": { base: 20, variance: 10, unit: "Pfund" },
  "Gemüse (Korb)": { base: 6, variance: 3, unit: "Korb" },
  
  // Unterkunft
  "Gasthof (Nacht, einfach)": { base: 8, variance: 4, unit: "Nacht" },
  "Gasthof (Nacht, gut)": { base: 40, variance: 20, unit: "Nacht" },
  "Stallplatz (Pferd)": { base: 4, variance: 2, unit: "Nacht" },
  
  // Löhne
  "Tagelöhner (Tag)": { base: 12, variance: 4, unit: "Tag" },
  "Handwerksgeselle (Tag)": { base: 24, variance: 8, unit: "Tag" },
  "Söldner (Tag)": { base: 48, variance: 16, unit: "Tag" },
  
  // Ausrüstung
  "Einfaches Schwert": { base: 1200, variance: 400, unit: "Stück" },
  "Qualitätsschwert": { base: 4800, variance: 1600, unit: "Stück" },
  "Lederrüstung": { base: 600, variance: 200, unit: "Stück" },
  "Kettenhemd": { base: 4800, variance: 1600, unit: "Stück" },
  "Plattenrüstung": { base: 48000, variance: 16000, unit: "Stück" },
  "Reitpferd (gut)": { base: 24000, variance: 8000, unit: "Stück" },
  "Lastpferd": { base: 12000, variance: 4000, unit: "Stück" },
  
  // Transport
  "Kutschfahrt (Meile)": { base: 24, variance: 12, unit: "Meile" },
  "Schiffspassage (Tag)": { base: 120, variance: 40, unit: "Tag" },
};

function _pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function createCurrencySystem(type: "fantasy" | "scifi" | "historical" = "fantasy", seed: number = 42): CurrencySystem {
  const rng = createSeededRandom(seed);
  
  let base: typeof FANTASY_CURRENCY;
  switch (type) {
    case "scifi": base = SCIFI_CURRENCY; break;
    case "historical": base = HISTORICAL_CURRENCY; break;
    default: base = FANTASY_CURRENCY;
  }
  
  // Leichte Variation der Tauschwerte
  const tiers = base.tiers.map(t => ({
    ...t,
    valueInBase: Math.max(1, Math.round(t.valueInBase * (0.9 + rng() * 0.2))),
  }));
  
  return {
    id: `CUR-${hashString(base.name + seed).toString(16).padStart(6, "0").toUpperCase()}`,
    name: base.name,
    baseUnit: base.baseUnit,
    tiers,
    seed,
  };
}

export function generatePrices(currency: CurrencySystem, seed: number = 42): PriceEntry[] {
  const rng = createSeededRandom(seed + 1000);
  const baseValue = currency.tiers.find(t => t.valueInBase === 1)?.valueInBase || 1;
  
  return Object.entries(PRICE_TEMPLATES).map(([item, tmpl]) => {
    let category: PriceEntry["category"];
    if (["Brotlaib", "Bier (Krug)", "Wein (Flasche)", "Käse (Laib)", "Fleisch (Pfund)", "Gemüse (Korb)"].includes(item)) category = "food";
    else if (["Gasthof (Nacht, einfach)", "Gasthof (Nacht, gut)", "Stallplatz (Pferd)"].includes(item)) category = "lodging";
    else if (["Tagelöhner (Tag)", "Handwerksgeselle (Tag)", "Söldner (Tag)"].includes(item)) category = "wages";
    else if (["Kutschfahrt (Meile)", "Schiffspassage (Tag)"].includes(item)) category = "transport";
    else if (["Einfaches Schwert", "Qualitätsschwert", "Lederrüstung", "Kettenhemd", "Plattenrüstung", "Reitpferd (gut)", "Lastpferd"].includes(item)) category = "equipment";
    else category = "luxury";
    
    const price = Math.max(1, Math.round(tmpl.base * (0.8 + rng() * 0.4) * baseValue));
    
    return { item, category, price, unit: tmpl.unit };
  });
}

export function calculateDailyWage(prices: PriceEntry[]): number {
  const wage = prices.find(p => p.item === "Tagelöhner (Tag)");
  return wage?.price || 12;
}

export function simulateInflation(prices: PriceEntry[], inflationRate: number, days: number): PriceEntry[] {
  const factor = Math.pow(1 + inflationRate / 100, days / 30);
  return prices.map(p => ({ ...p, price: Math.max(1, Math.round(p.price * factor)) }));
}

export function checkPlausibility(ledger: EconomyLedger): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const wage = ledger.dailyWage;
  
  // Brot sollte < Tageslohn kosten (sehr locker)
  const bread = ledger.prices.find(p => p.item === "Brotlaib");
  if (bread && bread.price > wage) {
    issues.push(`Brot zu teuer: ${bread.price} > ${wage} (Tageslohn)`);
  }
  
  // Einfaches Gasthof sollte < Tageslohn kosten
  const inn = ledger.prices.find(p => p.item === "Gasthof (Nacht, einfach)");
  if (inn && inn.price > wage) {
    issues.push(`Einfaches Gasthof zu teuer: ${inn.price} > ${wage} (Tageslohn)`);
  }
  
  // Pferd sollte nicht mehr als 20 Jahre Lohn kosten
  const horse = ledger.prices.find(p => p.item === "Reitpferd (gut)");
  if (horse && horse.price > wage * 365 * 20) {
    issues.push(`Reitpferd zu teuer: ${horse.price} > ${wage * 365 * 20} (20 Jahre Lohn)`);
  }
  
  // Plattenrüstung sollte nicht mehr als 50 Jahre Lohn kosten
  const plate = ledger.prices.find(p => p.item === "Plattenrüstung");
  if (plate && plate.price > wage * 365 * 50) {
    issues.push(`Plattenrüstung zu teuer: ${plate.price} > ${wage * 365 * 50} (50 Jahre Lohn)`);
  }
  
  return { valid: issues.length === 0, issues };
}

export function createEconomyLedger(
  currencyType: "fantasy" | "scifi" | "historical" = "fantasy",
  seed: number = 42,
  inflationRate: number = 0
): EconomyLedger {
  const currency = createCurrencySystem(currencyType, seed);
  const prices = generatePrices(currency, seed);
  const dailyWage = calculateDailyWage(prices);
  const finalPrices = inflationRate > 0 ? simulateInflation(prices, inflationRate, 30) : prices;
  const plausibility = checkPlausibility({ currency, prices: finalPrices, dailyWage, inflationRate, plausibility: { valid: true, issues: [] } });
  
  return {
    currency,
    prices: finalPrices,
    dailyWage,
    inflationRate,
    plausibility,
  };
}

export function formatLedger(ledger: EconomyLedger): string {
  const lines = [
    `💰 WIRTSCHAFTS-HAUPBUCH: ${ledger.currency.name}`,
    `Basiseinheit: ${ledger.currency.baseUnit} | Inflation: ${ledger.inflationRate}%`,
    `Tageslohn (Tagelöhner): ${ledger.dailyWage} ${ledger.currency.baseUnit}`,
    "",
    "💴 WÄHRUNGSSTUFEN:",
    ...ledger.currency.tiers.map(t => `  ${t.symbol} ${t.name} = ${t.valueInBase} ${ledger.currency.baseUnit} (${t.description})`),
    "",
    "🛒 PREISE & LÖHNE:",
    ...["food", "lodging", "wages", "equipment", "transport"].map(cat => {
      const items = ledger.prices.filter(p => p.category === cat);
      if (items.length === 0) return "";
      return [
        `\n${cat.toUpperCase()}:`,
        ...items.map(p => {
          const gold = ledger.currency.tiers[0];
          const inGold = (p.price / gold.valueInBase).toFixed(2);
          return `  ${p.item}: ${p.price} ${ledger.currency.baseUnit} (~${inGold} ${gold.name}) / ${p.unit}`;
        }),
      ].join("\n");
    }).filter(Boolean).join("\n"),
    "",
    ledger.plausibility.valid 
      ? "✅ PLAUSIBILITÄT: Alle Prüfungen bestanden."
      : `⚠️ PLAUSIBILITÄT: ${ledger.plausibility.issues.join("; ")}`,
  ];
  return lines.join("\n");
}

export function createSampleLedger(): EconomyLedger {
  return createEconomyLedger("fantasy", 42, 0);
}

export function createSampleInflationLedger(): EconomyLedger {
  return createEconomyLedger("fantasy", 42, 150); // 150% Inflation = Belagerung
}