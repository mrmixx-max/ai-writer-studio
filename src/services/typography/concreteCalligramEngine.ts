// ConcreteCalligramEngine (WP 125.1 / Meilenstein 60.0 / v7.2.0)
// Konkrete Poesie & Vektor-Calligramm-Engine für experimentelle Typografie.
// Vektor-Formenmasken, pfadgebundener Satz und druckfertiger 300-DPI-Export.
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

/** Eine Vektor-Formenmaske als Pfadzeichnung im 100×100-Rahmen. */
export interface ShapeMask {
  id: string;
  name: string;
  description: string;
  /** SVG-Pfadzeichnung (Pfaddaten). */
  pathData: string;
  /** SVG-viewBox der Maske. */
  viewBox: string;
}

/**
 * Fünf Vektor-Formenmasken für Calligramme.
 * Alle Pfade sind im gemeinsamen 100×100-Rahmen definiert.
 */
export const SHAPE_MASKS: ShapeMask[] = [
  {
    id: "hourglass",
    name: "Sanduhr",
    description:
      "Zwei gegenläufige Dreiecke, die sich in der Taille treffen — die Zeit als Form des Textes.",
    pathData: "M18 8 L82 8 L54 50 L82 92 L18 92 L46 50 Z",
    viewBox: "0 0 100 100",
  },
  {
    id: "spiral",
    name: "Spirale",
    description:
      "Archimedische Spirale aus Bézier-Segmenten — der Text windet sich nach innen zum Zentrum.",
    pathData:
      "M50 50 C50 44 56 44 56 50 C56 58 44 58 44 50 C44 38 62 38 62 50 C62 66 34 66 34 50 C34 30 70 30 70 50 C70 74 26 74 26 50 C26 22 78 22 78 50 C78 82 18 82 18 50",
    viewBox: "0 0 100 100",
  },
  {
    id: "keyhole",
    name: "Schlüsselloch",
    description:
      "Runder Kopf über einem ausgestellten Schaft — das geheime Wort hinter der Tür.",
    pathData:
      "M50 12 A16 16 0 1 0 50 44 A16 16 0 1 0 50 12 M42 42 L34 88 L66 88 L58 42 Z",
    viewBox: "0 0 100 100",
  },
  {
    id: "prison",
    name: "Gefängnisgitter",
    description:
      "Senkrechte und waagerechte Stäbe hinter einem Rahmen — eingesperrte Zeilen.",
    pathData:
      "M10 10 H90 V90 H10 Z M24 10 V90 M40 10 V90 M56 10 V90 M72 10 V90 M10 32 H90 M10 56 H90",
    viewBox: "0 0 100 100",
  },
  {
    id: "teardrop",
    name: "Träne",
    description:
      "Spitze nach oben, runde Wölbung nach unten — der Text als fallender Tropfen.",
    pathData: "M50 8 C64 34 84 52 84 66 A34 34 0 0 1 16 66 C16 52 36 34 50 8 Z",
    viewBox: "0 0 100 100",
  },
];

/** Liefert eine Formenmaske anhand ihrer ID. */
export function getShapeMask(id: string): ShapeMask | undefined {
  return SHAPE_MASKS.find((s) => s.id === id);
}

const SVG_TEXT_STYLE = 'style="fill: var(--accent)"';

/**
 * Baut konzentrische Kreis-Pfade als Fließlinien.
 * Deterministisch aus Anzahl, Mittelpunkt und Radius-Schritt.
 */
function buildConcentricCircles(
  cx: number,
  cy: number,
  count: number,
  r0: number,
  step: number
): string {
  const segments: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = r0 + i * step;
    // Zwei Halbbögen pro Kreis für geschlossene Fließlinie.
    segments.push(
      `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy}`
    );
  }
  return segments.join(" ");
}

/** Ergebnis eines pfadgebundenen Satzes. */
export interface PathLayoutResult {
  /** Vollständiges SVG-Markup. */
  svg: string;
  /** Der entlang des Pfades fließende Text. */
  textPath: string;
  /** SVG-viewBox der Ausgabe. */
  viewBox: string;
  /** Anzahl der auf dem Pfad gesetzten Zeichen. */
  charCount: number;
}

/**
 * Setzt Text pfadgebunden auf Bézier-Kurven und konzentrische Kreise.
 * Deterministisch: gleicher Text, gleiche Form und gleicher Seed ergeben
 * stets dasselbe Layout.
 */
export function layoutTextOnPath(
  text: string,
  shapeId: string,
  seed: number
): PathLayoutResult {
  const rng = createSeededRandom(hashString(`${shapeId}:${text}:${seed}`));
  const mask = getShapeMask(shapeId) || pick(SHAPE_MASKS, rng);
  const viewBox = mask.viewBox;

  // Konzentrische Kreise als zusätzliche Fließlinien.
  const ringCount = 3 + Math.floor(rng() * 3); // 3-5 Ringe
  const ringStep = 6 + Math.floor(rng() * 4); // 6-9 Einheiten
  const circles = buildConcentricCircles(50, 50, ringCount, 14, ringStep);

  // Pfad-ID deterministisch aus Form und Seed.
  const pathId = `calligram-${hashString(`${mask.id}:${seed}`)
    .toString(16)
    .padStart(8, "0")}`;

  // Schriftgröße deterministisch aus dem Seed ableiten.
  const fontSize = 2.4 + rng() * 1.6; // 2.4-4.0 Einheiten
  const letterSpacing = 0.1 + rng() * 0.4;

  const flowingText = text.length > 0 ? text : " ";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <defs>
    <path id="${pathId}" d="${mask.pathData}" />
    <path id="${pathId}-rings" d="${circles}" />
  </defs>
  <path d="${mask.pathData}" style="fill: none; stroke: var(--accent)" stroke-width="0.4" />
  <path d="${circles}" style="fill: none; stroke: var(--accent)" stroke-width="0.2" opacity="0.35" />
  <text ${SVG_TEXT_STYLE} font-size="${fontSize.toFixed(2)}" letter-spacing="${letterSpacing.toFixed(2)}">
    <textPath href="#${pathId}" startOffset="2%">${flowingText}</textPath>
    <textPath href="#${pathId}-rings" startOffset="0%">${flowingText}</textPath>
  </text>
</svg>`;

  return {
    svg,
    textPath: flowingText,
    viewBox,
    charCount: text.length,
  };
}

/** Ergebnis eines druckfertigen Vektor-Exports. */
export interface CalligramExport {
  /** Vollständiges, druckfertiges SVG-Markup. */
  svg: string;
  /** Breite in Pixeln bei der angegebenen Auflösung. */
  width: number;
  /** Höhe in Pixeln bei der angegebenen Auflösung. */
  height: number;
  /** Auflösung in DPI. */
  dpi: number;
}

/** Physische Kantenlänge der Druckfläche in Zoll (quadratisch). */
const PRINT_INCHES = 4;

/**
 * Erzeugt einen druckfertigen Vektor-Export bei 300 DPI.
 * Deterministisch: gleicher Text, gleiche Form und gleicher Seed ergeben
 * stets dasselbe SVG.
 */
export function exportCalligramSVG(
  text: string,
  shapeId: string,
  seed: number
): CalligramExport {
  const dpi = 300;
  const width = PRINT_INCHES * dpi; // 1200 px
  const height = PRINT_INCHES * dpi; // 1200 px

  const layout = layoutTextOnPath(text, shapeId, seed);
  const rng = createSeededRandom(hashString(`${shapeId}:${text}:${seed}:export`));
  const mask = getShapeMask(shapeId) || pick(SHAPE_MASKS, rng);

  // Die Formenmaske wird aus dem 100×100-Rahmen auf die Druckfläche skaliert.
  const inner = layout.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>Calligramm — ${mask.name}</title>
  <desc>Konkrete Poesie, ${width}×${height} px bei ${dpi} DPI, Seed ${seed}.</desc>
  <rect width="${width}" height="${height}" style="fill: var(--bg)" />
  <g transform="scale(${(width / 100).toFixed(4)})">
${inner}
  </g>
</svg>`;

  return { svg, width, height, dpi };
}

/** Erstellt eine Beispiel-Formenmaske. */
export function createSampleShapeMask(): ShapeMask {
  return getShapeMask("hourglass") || SHAPE_MASKS[0];
}

/** Erstellt ein Beispiel-Calligramm (Sanduhr-Form). */
export function createSampleCalligram(): PathLayoutResult {
  return layoutTextOnPath(
    "Die Zeit rinnt wie Sand durch die Hände der Erzähler",
    "hourglass",
    42
  );
}
