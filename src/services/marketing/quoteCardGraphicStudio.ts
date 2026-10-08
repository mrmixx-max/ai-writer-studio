// QuoteCardGraphicStudio (WP 110.2)
// Zitat-Karten- & Karussell-Grafik-Studio.
// Seitenverhältnisse, Stil-Themes, SVG-Layout-Engine.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type AspectRatioId = "square" | "portrait" | "story";

export interface AspectRatio {
  id: AspectRatioId;
  name: string;
  width: number;
  height: number;
  label: string;
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { id: "square", name: "Quadratisch", width: 1080, height: 1080, label: "1:1 / 1080×1080 px" },
  { id: "portrait", name: "Porträt", width: 1080, height: 1350, label: "4:5 / 1080×1350 px" },
  { id: "story", name: "Story / Reels", width: 1080, height: 1920, label: "9:16 / 1080×1920 px" },
];

export function getAspectRatio(id: AspectRatioId): AspectRatio | undefined {
  return ASPECT_RATIOS.find((a) => a.id === id);
}

export type ThemeId = "darkAcademia" | "gothicRomance" | "cozyFantasy" | "minimalModern";

export interface Theme {
  id: ThemeId;
  name: string;
  /** SVG-Farbwerte als Design-Tokens. */
  bgToken: string;
  fgToken: string;
  accentToken: string;
  /** Schriftart als CSS-Font-Family. */
  fontFamily: string;
  /** Dekorative Vignette als SVG-Element. */
  vignette: string;
  description: string;
}

const SVG_STYLE = 'style="fill: none; stroke: var(--accent)" stroke-width="1.5"';

export const THEMES: Theme[] = [
  {
    id: "darkAcademia",
    name: "Dark Academia",
    bgToken: "var(--bg)",
    fgToken: "var(--text)",
    accentToken: "var(--accent)",
    fontFamily: "Georgia, 'Times New Roman', serif",
    vignette: `<path d="M20 20 L40 20 L40 40 L20 40 Z" ${SVG_STYLE} /><path d="M25 25 L35 25 L35 35 L25 35 Z" ${SVG_STYLE} />`,
    description: "Pergament & Serifenschrift — klassisch, akademisch, zeitlos",
  },
  {
    id: "gothicRomance",
    name: "Gothic Romance",
    bgToken: "var(--bg)",
    fgToken: "var(--text)",
    accentToken: "var(--accent)",
    fontFamily: "'Playfair Display', Georgia, serif",
    vignette: `<path d="M30 15 Q35 25 30 35 Q25 25 30 15 Z" ${SVG_STYLE} /><circle cx="30" cy="25" r="3" style="fill: var(--accent)" />`,
    description: "Dunkel & Rosen — dramatisch, romantisch, geheimnisvoll",
  },
  {
    id: "cozyFantasy",
    name: "Cozy Fantasy",
    bgToken: "var(--bg)",
    fgToken: "var(--text)",
    accentToken: "var(--accent)",
    fontFamily: "'Courier New', monospace",
    vignette: `<path d="M15 30 Q25 20 35 30 Q45 20 55 30" ${SVG_STYLE} /><circle cx="35" cy="25" r="4" ${SVG_STYLE} />`,
    description: "Warm & Zierleiten — gemütlich, einladend, märchenhaft",
  },
  {
    id: "minimalModern",
    name: "Minimal Modern",
    bgToken: "var(--bg)",
    fgToken: "var(--text)",
    accentToken: "var(--accent)",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    vignette: `<line x1="20" y1="30" x2="50" y2="30" ${SVG_STYLE} />`,
    description: "Reduziert & klar — modern, elegant, fokussiert",
  },
];

export function getTheme(id: ThemeId): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

export interface QuoteCard {
  id: string;
  quote: string;
  author: string;
  bookTitle: string;
  aspectRatio: AspectRatio;
  theme: Theme;
  svg: string;
  /** Geschätzte Textzeilen im SVG. */
  lineCount: number;
}

export interface QuoteCardOptions {
  quote: string;
  author: string;
  bookTitle: string;
  aspectRatioId?: AspectRatioId;
  themeId?: ThemeId;
  seed?: number;
}

export function createQuoteCard(options: QuoteCardOptions): QuoteCard {
  const aspectRatio = getAspectRatio(options.aspectRatioId || "square") || ASPECT_RATIOS[0];
  const theme = getTheme(options.themeId || "darkAcademia") || THEMES[0];
  const w = aspectRatio.width;
  const h = aspectRatio.height;
  const cx = w / 2;
  const cy = h / 2;

  // Textumbruch: schätze Zeilen basierend auf Zeichenzahl und Breite
  const maxCharsPerLine = Math.floor(w / 12);
  const words = options.quote.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);

  const lineHeight = Math.floor(h / 20);
  const startY = cy - (lines.length * lineHeight) / 2;

  const textElements = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<text x="${cx}" y="${y}" text-anchor="middle" style="fill: ${theme.fgToken}" font-size="${Math.floor(h / 25)}" font-family="${theme.fontFamily}">${line}</text>`;
    })
    .join("");

  const authorY = startY + lines.length * lineHeight + lineHeight;
  const titleY = authorY + lineHeight;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" style="fill: ${theme.bgToken}" />
  <rect x="20" y="20" width="${w - 40}" height="${h - 40}" style="fill: none; stroke: ${theme.accentToken}" stroke-width="2" />
  ${theme.vignette}
  ${textElements}
  <text x="${cx}" y="${authorY}" text-anchor="middle" style="fill: ${theme.accentToken}" font-size="${Math.floor(h / 35)}" font-family="${theme.fontFamily}">— ${options.author}</text>
  <text x="${cx}" y="${titleY}" text-anchor="middle" style="fill: ${theme.fgToken}" font-size="${Math.floor(h / 40)}" font-family="${theme.fontFamily}" opacity="0.7">${options.bookTitle}</text>
</svg>`;

  return {
    id: `CARD-${hashString(`${options.quote}:${options.aspectRatioId}:${options.themeId}`).toString(16).padStart(8, "0").toUpperCase()}`,
    quote: options.quote,
    author: options.author,
    bookTitle: options.bookTitle,
    aspectRatio,
    theme,
    svg,
    lineCount: lines.length,
  };
}

export interface CarouselTemplate {
  id: string;
  slides: QuoteCard[];
  aspectRatio: AspectRatio;
  theme: Theme;
}

export function createCarouselTemplate(quotes: string[], author: string, bookTitle: string, aspectRatioId: AspectRatioId = "square", themeId: ThemeId = "darkAcademia", seed: number = 42): CarouselTemplate {
  const slides = quotes.map((q, i) =>
    createQuoteCard({ quote: q, author, bookTitle, aspectRatioId, themeId, seed: seed + i })
  );
  return {
    id: `CAROUSEL-${hashString(`${quotes.join("|")}:${aspectRatioId}:${themeId}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    slides,
    aspectRatio: getAspectRatio(aspectRatioId) || ASPECT_RATIOS[0],
    theme: getTheme(themeId) || THEMES[0],
  };
}

export interface ExportSpec {
  format: "svg" | "png";
  width: number;
  height: number;
  dpi: number;
  notes: string[];
}

export function buildExportSpec(card: QuoteCard, format: "svg" | "png" = "svg", dpi: number = 300): ExportSpec {
  return {
    format,
    width: card.aspectRatio.width,
    height: card.aspectRatio.height,
    dpi,
    notes: [
      `Vektor-Ausgabe im Format ${format.toUpperCase()} — ${card.aspectRatio.label}`,
      `Auflösung ${card.aspectRatio.width}×${card.aspectRatio.height} px bei ${dpi} DPI`,
      "Alle Farben als Design-Tokens; im PNG-Export in sRGB wandeln.",
      "Text als Pfade rendern, wenn die Schriftart nicht verfügbar ist.",
    ],
  };
}

export function createSampleQuoteCard(): QuoteCard {
  return createQuoteCard({
    quote: "Manchmal ist der größte Mut, den eigenen Weg zu gehen.",
    author: "Erik Gieske",
    bookTitle: "Die Stille zwischen den Worten",
    aspectRatioId: "square",
    themeId: "darkAcademia",
    seed: 42,
  });
}

export function createSampleCarouselTemplate(): CarouselTemplate {
  return createCarouselTemplate(
    [
      "Manchmal ist der größte Mut, den eigenen Weg zu gehen.",
      "Die Worte, die wir nicht sagen, sind die lautesten.",
      "In der Stille liegt die Antwort, die wir suchen.",
    ],
    "Erik Gieske",
    "Die Stille zwischen den Worten",
    "portrait",
    "gothicRomance",
    42
  );
}
