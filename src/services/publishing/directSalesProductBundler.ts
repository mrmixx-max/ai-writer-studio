// DirectSalesProductBundler (WP 126.1, Meilenstein 61.0 / v7.3.0)
//
// Direktvertriebs-Produkt- & Bundle-Generator für Shopify und WooCommerce.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module, browser-kompatibel.
//
// Features:
// - 3-Stufen-Preistreppe (Standard / Deluxe / Collector)
// - Echtzeit-Margenvergleich (Direktvertrieb vs. Amazon)
// - 1-Klick-CSV-Export (Shopify & WooCommerce)
// - Verkaufspsychologische Produktbeschreibung

// ---------------------------------------------------------------------------
// Deterministische Zufalls- und Hash-Funktionen
// ---------------------------------------------------------------------------

/** FNV-1a-Hash einer Zeichenkette (32 Bit, unsigned). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministischer Zufallsgenerator (mulberry32). Liefert [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wählt ein zufälliges Element aus einem Array. Wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error('pick(): Array darf nicht leer sein');
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Typdefinitionen
// ---------------------------------------------------------------------------

/** Eine Preisstufe im Direktvertrieb. */
export interface PriceTier {
  id: string;
  name: string;
  price: number;
  netProfit: number;
  contents: string[];
  description: string;
}

/** Ergebnis des Margenvergleichs. */
export interface MarginComparison {
  directNet: number;
  amazonNet: number;
  advantage: number;
  advantagePercent: number;
  description: string;
}

/** CSV-Export-Ergebnis. */
export interface CsvExport {
  csv: string;
  rowCount: number;
  platform: string;
  description: string;
}

/** Verkaufspsychologische Produktbeschreibung. */
export interface ProductCopy {
  headline: string;
  bulletPoints: string[];
  description: string;
}

/** Ein Produkt-Bundle. */
export interface ProductBundle {
  id: string;
  name: string;
  tierId: string;
  price: number;
  contents: string[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// 3-Stufen-Preistreppe
// ---------------------------------------------------------------------------

/**
 * Die drei Preisstufen für den Direktvertrieb.
 * - Standard: E-Book 7,99 € (Reingewinn 7,50 €)
 * - Deluxe: E-Book + Hörbuch 19,99 € (Reingewinn 18,90 €)
 * - Collector: Buch + Hörbuch + Artbook + Soundtrack + Zoom-Leseticket 49,00 € (Reingewinn ~46,50 €)
 */
export const PRICE_TIERS: readonly PriceTier[] = [
  {
    id: 'standard',
    name: 'Standard',
    price: 7.99,
    netProfit: 7.5,
    contents: ['E-Book (EPUB & PDF)'],
    description:
      'Das E-Book in den Formaten EPUB und PDF — optimiert für alle gängigen Reader und Geräte.',
  },
  {
    id: 'deluxe',
    name: 'Deluxe',
    price: 19.99,
    netProfit: 18.9,
    contents: ['E-Book (EPUB & PDF)', 'Hörbuch (MP3 & M4B)'],
    description:
      'Das E-Book plus das komplette Hörbuch — für Leser und Hörer, die beides wollen.',
  },
  {
    id: 'collector',
    name: 'Collector',
    price: 49.0,
    netProfit: 46.5,
    contents: [
      'E-Book (EPUB & PDF)',
      'Hörbuch (MP3 & M4B)',
      'Artbook (PDF, 80 Seiten)',
      'Soundtrack (MP3 & FLAC)',
      'Zoom-Leseticket',
    ],
    description:
      'Die komplette Sammler-Edition: E-Book, Hörbuch, Artbook, Soundtrack und ein persönliches Zoom-Leseticket mit dem Autor.',
  },
] as const;

// ---------------------------------------------------------------------------
// Echtzeit-Margenvergleich
// ---------------------------------------------------------------------------

/**
 * Vergleicht die Marge des Direktvertriebs mit der Amazon-Marge.
 *
 * @param tierId - ID der Preisstufe ('standard' | 'deluxe' | 'collector')
 * @param ebookListPrice - Unverbindlicher Preis des E-Books (z. B. 7.99)
 * @param amazonRoyaltyRate - Amazon-Royalty-Satz (Standard: 0.7 für 2.99–9.99 €)
 */
export function compareMargins(
  tierId: string,
  ebookListPrice: number,
  amazonRoyaltyRate: number = 0.7,
): MarginComparison {
  const tier = PRICE_TIERS.find((t) => t.id === tierId);
  if (!tier) {
    throw new Error(`compareMargins(): Unbekannte tierId "${tierId}"`);
  }

  const directNet = tier.netProfit;
  const amazonNet = Math.round(ebookListPrice * amazonRoyaltyRate * 100) / 100;
  const advantage = Math.round((directNet - amazonNet) * 100) / 100;
  const advantagePercent =
    amazonNet > 0
      ? Math.round((advantage / amazonNet) * 10000) / 100
      : 0;

  const description =
    advantage >= 0
      ? `Der Direktvertrieb liegt um ${advantage.toFixed(2)} € (${advantagePercent.toFixed(1)} %) über Amazon.`
      : `Amazon liegt um ${Math.abs(advantage).toFixed(2)} € (${Math.abs(advantagePercent).toFixed(1)} %) über dem Direktvertrieb.`;

  return { directNet, amazonNet, advantage, advantagePercent, description };
}

// ---------------------------------------------------------------------------
// 1-Klick-CSV-Export
// ---------------------------------------------------------------------------

/** Plattform-Typ für den CSV-Export. */
export type StorePlatform = 'shopify' | 'woocommerce';

/**
 * Generiert einen CSV-Export für eine Preisstufe.
 * Gemeinsame Implementierung für Shopify und WooCommerce.
 */
export function generateStoreCsv(
  tierId: string,
  platform: StorePlatform,
  seed: number,
): CsvExport {
  const tier = PRICE_TIERS.find((t) => t.id === tierId);
  if (!tier) {
    throw new Error(`generateStoreCsv(): Unbekannte tierId "${tierId}"`);
  }

  const rng = createSeededRandom(seed);
  const handle = `${tier.id}-buch`;
  const vendor = 'AI Writer Studio';
  const type = 'Digitales Produkt';
  const tags = pick(
    ['Buch', 'E-Book', 'Hörbuch', 'Sammler', 'Direktvertrieb', 'Limited'],
    rng,
  );

  if (platform === 'shopify') {
    const csv = buildShopifyCsv(tier, handle, vendor, type, tags);
    return {
      csv,
      rowCount: 1,
      platform: 'Shopify',
      description: `Shopify-Import-CSV für die Preisstufe "${tier.name}" (${tier.price.toFixed(2)} €).`,
    };
  }

  const csv = buildWooCommerceCsv(tier, handle, vendor, type, tags);
  return {
    csv,
    rowCount: 1,
    platform: 'WooCommerce',
    description: `WooCommerce-Import-CSV für die Preisstufe "${tier.name}" (${tier.price.toFixed(2)} €).`,
  };
}

/** Generiert einen Shopify-kompatiblen CSV-Export. */
export function generateShopifyCsv(tierId: string, seed: number): CsvExport {
  return generateStoreCsv(tierId, 'shopify', seed);
}

/** Generiert einen WooCommerce-kompatiblen CSV-Export. */
export function generateWooCommerceCsv(tierId: string, seed: number): CsvExport {
  return generateStoreCsv(tierId, 'woocommerce', seed);
}

// ---------------------------------------------------------------------------
// Verkaufspsychologische Produktbeschreibung
// ---------------------------------------------------------------------------

/**
 * Generiert eine verkaufspsychologische Produktbeschreibung.
 * Deterministisch über den Seed.
 */
export function generateProductCopy(tierId: string, seed: number): ProductCopy {
  const tier = PRICE_TIERS.find((t) => t.id === tierId);
  if (!tier) {
    throw new Error(`generateProductCopy(): Unbekannte tierId "${tierId}"`);
  }

  const rng = createSeededRandom(seed);

  const headlines = [
    `${tier.name}: Dein Buch, deine Regeln.`,
    `Alles, was dieses Buch bietet — in einer Ausgabe.`,
    `Die ${tier.name}-Edition: Mehr als nur ein Buch.`,
    `Für Leser:innen, die das Besondere suchen.`,
  ];

  const bulletPool = [
    'Sofortiger Download nach dem Kauf',
    'Exklusiv im Direktvertrieb erhältlich',
    'Inklusive Bonus-Material',
    'Persönliche Widmung der Autorin möglich',
    'Kostenloser Versand innerhalb Deutschlands',
    '30 Tage Rückgaberecht',
    'Hochwertige Gestaltung',
    'Regelmäßige Updates inklusive',
  ];

  const headline = pick(headlines, rng);

  // Wähle 3–4 Bullet Points
  const numBullets = 3 + Math.floor(rng() * 2);
  const shuffled = [...bulletPool].sort(() => rng() - 0.5);
  const bulletPoints = shuffled.slice(0, numBullets);

  const description = `${tier.description} Diese Ausgabe enthält: ${tier.contents.join(', ')}.`;

  return { headline, bulletPoints, description };
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/** Erstellt eine Beispiel-Preisstufe. */
export function createSamplePriceTier(): PriceTier {
  return {
    id: 'sample',
    name: 'Beispiel',
    price: 14.99,
    netProfit: 14.0,
    contents: ['E-Book (EPUB & PDF)', 'Bonus-Kapitel'],
    description: 'Eine Beispiel-Preisstufe für Testzwecke.',
  };
}

/** Erstellt ein Beispiel-Bundle. */
export function createSampleBundle(): ProductBundle {
  return {
    id: `BND-${hashString('Der Schatten des Vergessens').toString(16).padStart(8, '0').toUpperCase()}`,
    name: 'Der Schatten des Vergessens',
    tierId: 'deluxe',
    price: 19.99,
    contents: ['E-Book (EPUB & PDF)', 'Hörbuch (MP3 & M4B)'],
    tags: ['Buch', 'E-Book', 'Hörbuch'],
  };
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** CSV-Feld nach RFC-4180 maskieren. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Baut die Shopify-CSV-Zeile. */
function buildShopifyCsv(
  tier: PriceTier,
  handle: string,
  vendor: string,
  type: string,
  tags: string,
): string {
  const header = [
    'Handle',
    'Title',
    'Body (HTML)',
    'Vendor',
    'Type',
    'Tags',
    'Published',
    'Variant SKU',
    'Variant Price',
    'Variant Compare At Price',
    'Variant Inventory Qty',
    'Variant Grams',
  ];

  const bodyHtml = `<p>${tier.description}</p><ul>${tier.contents.map((c) => `<li>${c}</li>`).join('')}</ul>`;

  const row = [
    handle,
    tier.name,
    bodyHtml,
    vendor,
    type,
    tags,
    'TRUE',
    `SKU-${tier.id.toUpperCase()}`,
    tier.price.toFixed(2),
    '',
    '0',
    '0',
  ];

  return [header.join(','), row.map(csvField).join(',')].join('\n');
}

/** Baut die WooCommerce-CSV-Zeile. */
function buildWooCommerceCsv(
  tier: PriceTier,
  handle: string,
  vendor: string,
  type: string,
  tags: string,
): string {
  const header = [
    'ID',
    'Type',
    'SKU',
    'Name',
    'Published',
    'Is featured?',
    'Visibility in catalog',
    'Short description',
    'Description',
    'Date sale price starts',
    'Date sale price ends',
    'Tax status',
    'Tax class',
    'In stock?',
    'Stock',
    'Backorders allowed?',
    'Sold individually?',
    'Weight (kg)',
    'Length (cm)',
    'Width (cm)',
    'Height (cm)',
    'Allow customer reviews?',
    'Purchase note',
    'Sale price',
    'Regular price',
    'Categories',
    'Tags',
    'Shipping class',
    'Images',
    'Download limit',
    'Download expiry days',
    'Parent',
    'Grouped products',
    'Upsells',
    'Cross-sells',
    'External URL',
    'Button text',
    'Position',
    'Attribute 1 name',
    'Attribute 1 value(s)',
    'Attribute 1 visible',
    'Attribute 1 global',
  ];

  const row = [
    '',
    'simple',
    `SKU-${tier.id.toUpperCase()}`,
    tier.name,
    '1',
    '0',
    'visible',
    tier.description,
    `<p>${tier.description}</p><ul>${tier.contents.map((c) => `<li>${c}</li>`).join('')}</ul>`,
    '',
    '',
    'taxable',
    '',
    '1',
    '100',
    '0',
    '0',
    '',
    '',
    '',
    '',
    '1',
    '',
    '',
    '',
    tier.price.toFixed(2),
    '',
    tags,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  return [header.join(','), row.map(csvField).join(',')].join('\n');
}
