// PortolanNauticalChart (WP 109.2)
// Historisches Portolan-Seekarten-Studio.
// Loxodromen-Netz, maritime Vignetten (SVG), 300-DPI-Export-Gliederung.
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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type VignetteKindId = "kraken" | "seaSerpent" | "siren" | "windGod" | "galleon" | "compassRose";

export interface VignetteKind {
  id: VignetteKindId;
  name: string;
  description: string;
  /** SVG-Pfadzeichnung als Zeichenanweisung (relative Koordinaten im 100×100-Rahmen). */
  svg: string;
}

const SVG_STYLE = 'style="fill: none; stroke: var(--accent)" stroke-width="1.5"';

export const VIGNETTE_KINDS: VignetteKind[] = [
  {
    id: "kraken",
    name: "Krake",
    description: "Ein Tintenfischungetüm mit geringelten Armen, das ein Schiff umschlingt.",
    svg: `<circle cx="50" cy="46" r="16" ${SVG_STYLE} /><path d="M40 58 Q34 76 26 86 M50 62 Q50 82 48 92 M60 58 Q66 76 74 86" ${SVG_STYLE} /><circle cx="44" cy="42" r="2.5" style="fill: var(--accent)" /><circle cx="56" cy="42" r="2.5" style="fill: var(--accent)" />`,
  },
  {
    id: "seaSerpent",
    name: "Seeschlange",
    description: "Ein geringelter Leib, der in Wellen aus dem Meer steigt.",
    svg: `<path d="M8 70 Q24 50 40 70 T72 70 T92 52" ${SVG_STYLE} /><circle cx="88" cy="48" r="5" ${SVG_STYLE} /><circle cx="90" cy="46" r="1.5" style="fill: var(--accent)" />`,
  },
  {
    id: "siren",
    name: "Sirene",
    description: "Eine Meeresjungfrau mit Fischschwanz, die auf einem Felsen singt.",
    svg: `<circle cx="50" cy="30" r="7" ${SVG_STYLE} /><path d="M50 37 L50 60 Q62 70 58 88 Q50 78 42 88 Q38 70 50 60" ${SVG_STYLE} />`,
  },
  {
    id: "windGod",
    name: "Blasender Windgott",
    description: "Ein Antlitz im Profil, das Sturm aus vollen Backen bläst.",
    svg: `<path d="M20 40 Q34 34 46 40 Q58 46 52 60 Q46 70 32 68 Q22 66 20 56 Z" ${SVG_STYLE} /><path d="M54 48 Q72 46 86 52 M54 54 Q74 56 88 64" ${SVG_STYLE} />`,
  },
  {
    id: "galleon",
    name: "Galeone",
    description: "Ein dreimastiges Segelschiff mit geblähten Segeln auf bewegter See.",
    svg: `<path d="M24 70 L76 70 L68 82 L32 82 Z" ${SVG_STYLE} /><path d="M40 70 L40 30 L56 30 L56 70" ${SVG_STYLE} /><path d="M36 34 L60 34 M36 46 L60 46" ${SVG_STYLE} />`,
  },
  {
    id: "compassRose",
    name: "Kompassrose",
    description: "Eine achtzackige Windrose mit Strahlen in alle Hauptrichtungen.",
    svg: `<path d="M50 8 L56 44 L92 50 L56 56 L50 92 L44 56 L8 50 L44 44 Z" ${SVG_STYLE} /><circle cx="50" cy="50" r="6" ${SVG_STYLE} />`,
  },
];

export function getVignetteKind(id: VignetteKindId): VignetteKind | undefined {
  return VIGNETTE_KINDS.find((v) => v.id === id);
}

/** Eine Kompassrose mit 16 Strahlen (8 Haupt- und 8 Nebenrichtungen). */
export const COMPASS_DIRECTIONS = [
  "N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export interface CompassRose {
  cx: number;
  cy: number;
  radius: number;
  /** 16 Richtungen mit Endkoordinaten. */
  rays: { direction: string; x1: number; y1: number; x2: number; y2: number }[];
}

export function buildCompassRose(cx: number, cy: number, radius: number): CompassRose {
  const rays = COMPASS_DIRECTIONS.map((direction, i) => {
    // 16 Strahlen: 22,5° je Richtung, Start bei Norden (−90°).
    const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
    return {
      direction,
      x1: Math.round(cx * 10) / 10,
      y1: Math.round(cy * 10) / 10,
      x2: Math.round((cx + Math.cos(angle) * radius) * 10) / 10,
      y2: Math.round((cy + Math.sin(angle) * radius) * 10) / 10,
    };
  });
  return { cx, cy, radius, rays };
}

export interface RhumbLine {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Zielrichtung der Loxodrome. */
  bearing: string;
}

/**
 * Loxodromen-Netz: von jeder Kompassrose laufen Strahlen in alle 16 Richtungen
 * bis zum Kartenrand. Hier als Linien von Rose zu Rose oder zum Rand modelliert.
 */
export function buildRhumbNetwork(roses: CompassRose[], width: number, height: number): RhumbLine[] {
  const lines: RhumbLine[] = [];
  for (const rose of roses) {
    for (const ray of rose.rays) {
      const dx = ray.x2 - rose.cx;
      const dy = ray.y2 - rose.cy;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      // Verlängere den Strahl bis zum Kartenrand (Parametrisierung über t).
      let t = Infinity;
      if (dx > 0) t = Math.min(t, (width - rose.cx) / dx);
      if (dx < 0) t = Math.min(t, (0 - rose.cx) / dx);
      if (dy > 0) t = Math.min(t, (height - rose.cy) / dy);
      if (dy < 0) t = Math.min(t, (0 - rose.cy) / dy);
      if (!Number.isFinite(t) || t <= 0) continue;
      lines.push({
        fromX: rose.cx,
        fromY: rose.cy,
        toX: Math.round((rose.cx + dx * t) * 10) / 10,
        toY: Math.round((rose.cy + dy * t) * 10) / 10,
        bearing: ray.direction,
      });
    }
  }
  return lines;
}

export interface PlacedVignette {
  kind: VignetteKindId;
  x: number;
  y: number;
  scale: number;
}

export interface PortolanChart {
  id: string;
  title: string;
  width: number;
  height: number;
  roses: CompassRose[];
  rhumbLines: RhumbLine[];
  vignettes: PlacedVignette[];
  svg: string;
  dpi: number;
}

export interface ChartOptions {
  title: string;
  width?: number;
  height?: number;
  roseCount?: number;
  vignetteCount?: number;
  seed?: number;
}

export function createPortolanChart(options: ChartOptions): PortolanChart {
  const width = Math.max(200, Math.floor(options.width ?? 900));
  const height = Math.max(200, Math.floor(options.height ?? 650));
  const roseCount = Math.max(1, Math.min(4, Math.floor(options.roseCount ?? 2)));
  const vignetteCount = Math.max(0, Math.min(8, Math.floor(options.vignetteCount ?? 4)));
  const seed = options.seed ?? 42;
  const rng = createSeededRandom(hashString(`portolan:${options.title}:${seed}`));

  const roses: CompassRose[] = [];
  for (let i = 0; i < roseCount; i++) {
    const cx = Math.round(width * (0.25 + (i * 0.5) / Math.max(1, roseCount - 1 || 1)));
    const cy = Math.round(height * (i % 2 === 0 ? 0.35 : 0.65));
    roses.push(buildCompassRose(cx, cy, 55 + Math.floor(rng() * 25)));
  }

  const rhumbLines = buildRhumbNetwork(roses, width, height);

  const vignettes: PlacedVignette[] = [];
  const usedKinds = new Set<VignetteKindId>();
  let guard = 0;
  while (vignettes.length < vignetteCount && guard < 100) {
    guard++;
    const kind = pick(VIGNETTE_KINDS, rng);
    if (usedKinds.has(kind.id)) continue;
    usedKinds.add(kind.id);
    vignettes.push({
      kind: kind.id,
      x: Math.round(width * (0.08 + rng() * 0.84)),
      y: Math.round(height * (0.08 + rng() * 0.84)),
      scale: Math.round((0.6 + rng() * 0.7) * 100) / 100,
    });
  }

  const svg = renderPortolanSvg({ title: options.title, width, height, roses, rhumbLines, vignettes });

  return {
    id: `PORTOLAN-${hashString(`${options.title}:${width}x${height}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    title: options.title,
    width,
    height,
    roses,
    rhumbLines,
    vignettes,
    svg,
    dpi: 300,
  };
}

interface RenderInput {
  title: string;
  width: number;
  height: number;
  roses: CompassRose[];
  rhumbLines: RhumbLine[];
  vignettes: PlacedVignette[];
}

function renderPortolanSvg(input: RenderInput): string {
  const { title, width, height, roses, rhumbLines, vignettes } = input;

  const frame = `<rect x="8" y="8" width="${width - 16}" height="${height - 16}" style="fill: none; stroke: var(--accent)" stroke-width="3" />`;
  const innerFrame = `<rect x="20" y="20" width="${width - 40}" height="${height - 40}" style="fill: none; stroke: var(--border-strong)" stroke-width="1" />`;

  const lines = rhumbLines
    .map((l) => `<line x1="${l.fromX}" y1="${l.fromY}" x2="${l.toX}" y2="${l.toY}" style="stroke: var(--border-strong)" stroke-width="0.5" opacity="0.55" />`)
    .join("");

  const roseSvg = roses
    .map((r) => {
      const rays = r.rays
        .map((ray) => `<line x1="${ray.x1}" y1="${ray.y1}" x2="${ray.x2}" y2="${ray.y2}" style="stroke: var(--accent)" stroke-width="1" />`)
        .join("");
      const labels = r.rays
        .filter((_, i) => i % 4 === 0)
        .map((ray) => {
          const dx = ray.x2 - r.cx;
          const dy = ray.y2 - r.cy;
          const len = Math.hypot(dx, dy) || 1;
          const lx = r.cx + (dx / len) * (r.radius + 12);
          const ly = r.cy + (dy / len) * (r.radius + 12);
          return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" style="fill: var(--accent)" font-size="9">${ray.direction}</text>`;
        })
        .join("");
      return `<g><circle cx="${r.cx}" cy="${r.cy}" r="${r.radius}" style="fill: none; stroke: var(--accent)" stroke-width="1.5" />${rays}${labels}</g>`;
    })
    .join("");

  const vignetteSvg = vignettes
    .map((v) => {
      const kind = getVignetteKind(v.kind);
      if (!kind) return "";
      return `<g transform="translate(${v.x} ${v.y}) scale(${v.scale}) translate(-50 -50)">${kind.svg}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${frame}
  ${innerFrame}
  ${lines}
  ${roseSvg}
  ${vignetteSvg}
  <text x="${width / 2}" y="46" text-anchor="middle" style="fill: var(--accent)" font-size="20" font-weight="bold">${title}</text>
</svg>`;
}

export interface PrintSheet {
  dpi: number;
  widthInches: number;
  heightInches: number;
  pixelWidth: number;
  pixelHeight: number;
  bleedInches: number;
  notes: string[];
}

/** Druckfertige Blattgröße für das Buchvorsatzpapier (300 DPI, 0,125″ Beschnitt). */
export function buildPrintSheet(chart: PortolanChart, dpi: number = 300, bleedInches: number = 0.125): PrintSheet {
  const widthInches = Math.round((chart.width / dpi) * 1000) / 1000;
  const heightInches = Math.round((chart.height / dpi) * 1000) / 1000;
  const effectiveDpi = Math.max(72, dpi);
  return {
    dpi: effectiveDpi,
    widthInches,
    heightInches,
    pixelWidth: Math.round((widthInches + bleedInches * 2) * effectiveDpi),
    pixelHeight: Math.round((heightInches + bleedInches * 2) * effectiveDpi),
    bleedInches,
    notes: [
      `Vektor-Ausgabe für ${effectiveDpi} DPI — im PDF als Pfade, nicht als Bitmap.`,
      `Beschnittzugabe ${bleedInches}″ rundum für den Buchbinder.`,
      "Alle Farben als Design-Tokens; im PDF-Export in CMYK wandeln.",
      "Titel und Kompassrosen mindestens 12 mm vom Bund halten.",
    ],
  };
}

export interface PortolanReport {
  id: string;
  chart: PortolanChart;
  printSheet: PrintSheet;
  rhumbLineCount: number;
  roseCount: number;
  vignetteCount: number;
}

export function analyzePortolanChart(options: ChartOptions): PortolanReport {
  const chart = createPortolanChart(options);
  const printSheet = buildPrintSheet(chart);
  return {
    id: `PORTREP-${hashString(`${chart.id}:${chart.vignettes.length}`).toString(16).padStart(8, "0").toUpperCase()}`,
    chart,
    printSheet,
    rhumbLineCount: chart.rhumbLines.length,
    roseCount: chart.roses.length,
    vignetteCount: chart.vignettes.length,
  };
}

export function createSamplePortolanChart(): PortolanChart {
  return createPortolanChart({ title: "Das Zwölfgestirn-Meer", seed: 42 });
}

export function createSamplePortolanReport(): PortolanReport {
  return analyzePortolanChart({ title: "Das Zwölfgestirn-Meer", seed: 42 });
}
