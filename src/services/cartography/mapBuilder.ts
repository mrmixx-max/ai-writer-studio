// Kartenstudio (WP 21.1) — Vektor-Karten & Grundriss.
//
// Rein lokale, deterministische SVG-Vektorgrafik für Autoren-Weltkarten:
// Ebenen anlegen/normalisieren, Stil-Presets anwenden und als SVG bzw.
// hochauflösendes Dokument (Ziel-Rasterung 300 DPI) exportieren.
//
// Grundsätze:
// - KEIN LLM-Aufruf, kein Netzwerk, keine Zufalls-/Zeit-abhängigen IDs.
//   Gleiche Eingabe ⇒ gleiche Ausgabe (wichtig für Snapshots & Diffing).
// - Defensiv: fehlende/falsche Felder werden auf sichere Defaults gesetzt,
//   unbekannte Ebenen-/Elementtypen und Nicht-Arrays werden toleriert.
// - Koordinaten liegen im Welt-Raster 0..MAP_WIDTH / 0..MAP_HEIGHT (viewBox).

/** Ebene-Typen einer Karte. */
export type MapLayerType =
  | "land"
  | "river"
  | "mountain"
  | "road"
  | "settlement"
  | "label";

/** Element-Primitive, aus denen eine Ebene besteht. */
export type MapElementType = "path" | "circle" | "rect" | "text";

/** Verfügbare Stil-Presets. */
export type MapStyle = "parchment" | "blueprint" | "modern";

/** Optionale, element-spezifische Stil-Overrides (schlagen das Preset). */
export interface MapElementStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
}

/** Ein einzelnes Zeichen-Primitiv innerhalb einer Ebene. */
export interface MapElement {
  id: string;
  type: MapElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  style?: MapElementStyle;
}

/** Eine Kartenebene. */
export interface MapLayer {
  id: string;
  name: string;
  type: MapLayerType;
  elements: MapElement[];
  visible: boolean;
  /** Optional zugewiesenes Stil-Preset (via {@link applyMapStyle}). */
  style?: MapStyle;
}

/** Ein aufgelöstes Stil-Preset. */
export interface MapStylePreset {
  id: MapStyle;
  name: string;
  background: string;
  /** Standard-Stroke (Linien/Tinte). */
  ink: string;
  /** Standard-Textfarbe. */
  text: string;
  fontFamily: string;
  strokeWidth: number;
  /** Füllfarbe je Ebenen-Typ. */
  layerColors: Record<MapLayerType, string>;
}

/** Welt-Raster der viewBox. */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 1000;

/** Physische Kantenlänge der Karte in Zoll (Basis für DPI-Skalierung). */
export const MAP_INCHES = 10;

export const DEFAULT_DPI = 300;
export const MIN_DPI = 72;
export const MAX_DPI = 2400;

/** Neutrales Fallback-Preset für Ebenen ohne zugewiesenen Stil. */
export const DEFAULT_MAP_STYLE: MapStyle = "modern";

const LAYER_TYPES: readonly MapLayerType[] = [
  "land",
  "river",
  "mountain",
  "road",
  "settlement",
  "label",
];

const ELEMENT_TYPES: readonly MapElementType[] = ["path", "circle", "rect", "text"];

const MAP_STYLES: readonly MapStyle[] = ["parchment", "blueprint", "modern"];

/** Stil-Presets (Pergament, Blueprint, Modern Minimal). */
export const STYLE_PRESETS: Record<MapStyle, MapStylePreset> = {
  parchment: {
    id: "parchment",
    name: "Pergament",
    background: "#f3e3c3",
    ink: "#6b4f2a",
    text: "#4a3520",
    fontFamily: "Georgia, 'Times New Roman', serif",
    strokeWidth: 2,
    layerColors: {
      land: "#e8d5a8",
      river: "#5b8fb0",
      mountain: "#8a6b4a",
      road: "#9c7a4d",
      settlement: "#b5451f",
      label: "#4a3520",
    },
  },
  blueprint: {
    id: "blueprint",
    name: "Blueprint",
    background: "#0b2545",
    ink: "#cfe8ff",
    text: "#e6f1ff",
    fontFamily: "'Courier New', monospace",
    strokeWidth: 1.5,
    layerColors: {
      land: "#10315c",
      river: "#3fa7d6",
      mountain: "#6fa8dc",
      road: "#8fd3ff",
      settlement: "#ffd166",
      label: "#e6f1ff",
    },
  },
  modern: {
    id: "modern",
    name: "Modern Minimal",
    background: "#ffffff",
    ink: "#334155",
    text: "#0f172a",
    fontFamily: "system-ui, -apple-system, sans-serif",
    strokeWidth: 1.5,
    layerColors: {
      land: "#e2e8f0",
      river: "#60a5fa",
      mountain: "#94a3b8",
      road: "#f59e0b",
      settlement: "#ef4444",
      label: "#0f172a",
    },
  },
};

/** Liefert das Preset zu einem Stil (defensiv: unbekannt ⇒ Default-Preset). */
export function getMapStylePreset(style?: MapStyle): MapStylePreset {
  return STYLE_PRESETS[isMapStyle(style) ? style : DEFAULT_MAP_STYLE];
}

function isLayerType(v: unknown): v is MapLayerType {
  return typeof v === "string" && (LAYER_TYPES as readonly string[]).includes(v);
}

function isElementType(v: unknown): v is MapElementType {
  return typeof v === "string" && (ELEMENT_TYPES as readonly string[]).includes(v);
}

function isMapStyle(v: unknown): v is MapStyle {
  return typeof v === "string" && (MAP_STYLES as readonly string[]).includes(v);
}

function toFinite(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Deterministischer djb2-Hash (stabile IDs ohne Zeit/Zufall). */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Normalisiert ein einzelnes Element auf ein vollständiges, sicheres Objekt. */
function normalizeElement(raw: unknown, index: number): MapElement {
  const e = (raw && typeof raw === "object" ? raw : {}) as Partial<MapElement>;
  const type = isElementType(e.type) ? e.type : "circle";
  const x = toFinite(e.x, 0);
  const y = toFinite(e.y, 0);
  const content = typeof e.content === "string" ? e.content : "";
  const id =
    typeof e.id === "string" && e.id.trim()
      ? e.id.trim()
      : `el-${type}-${index}-${hashString(`${type}:${x}:${y}:${content}`)}`;

  const out: MapElement = { id, type, x, y };
  if (typeof e.width === "number" && Number.isFinite(e.width)) out.width = e.width;
  if (typeof e.height === "number" && Number.isFinite(e.height)) out.height = e.height;
  if (typeof e.content === "string") out.content = e.content;
  if (e.style && typeof e.style === "object") out.style = { ...e.style };
  return out;
}

/**
 * Erstellt bzw. normalisiert eine Kartenebene (Landmassen, Flüsse, Bergketten,
 * Wege, Siedlungen, Beschriftungen). Fehlende Felder werden aufgefüllt,
 * unbekannte Typen auf sichere Defaults abgebildet — ohne die Eingabe zu
 * verändern.
 */
export function createMapLayer(layer: MapLayer): MapLayer {
  const input = (layer && typeof layer === "object" ? layer : {}) as Partial<MapLayer>;
  const type = isLayerType(input.type) ? input.type : "land";
  const rawElements = Array.isArray(input.elements) ? input.elements : [];
  const elements = rawElements
    .filter((e): e is MapElement => !!e && typeof e === "object")
    .map((e, i) => normalizeElement(e, i));

  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim()
      : `Ebene (${type})`;

  const id =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : `layer-${type}-${hashString(
          `${name}:${type}:${elements.map((e) => e.id).join(",")}`,
        )}`;

  const out: MapLayer = {
    id,
    name,
    type,
    elements,
    visible: input.visible !== false,
  };
  if (isMapStyle(input.style)) out.style = input.style;
  return out;
}

/**
 * Wendet ein Stil-Preset (Pergament, Blueprint, Modern Minimal) auf eine
 * Ebene an. Element-eigene Styles bleiben als Overrides erhalten.
 * Unbekannter Stil ⇒ Default-Preset. Die Eingabe wird nicht verändert.
 */
export function applyMapStyle(layer: MapLayer, style: MapStyle): MapLayer {
  const normalized = createMapLayer(layer);
  const preset = getMapStylePreset(style);
  const elements = normalized.elements.map((el) => ({
    ...el,
    style: {
      fill: preset.layerColors[normalized.type] ?? preset.ink,
      stroke: preset.ink,
      strokeWidth: preset.strokeWidth,
      color: preset.text,
      fontFamily: preset.fontFamily,
      ...(el.style ?? {}),
    },
  }));
  return { ...normalized, elements, style: preset.id };
}

/** Baut eine Attribut-Zeichenkette; `undefined`/leere Werte werden übersprungen. */
function attrs(map: Record<string, string | number | undefined>): string {
  return Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => ` ${k}="${typeof v === "string" ? escapeXml(v) : v}"`)
    .join("");
}

/** Rendert ein Element passend zu Ebenen-Typ und Preset. */
function renderElement(el: MapElement, layer: MapLayer, preset: MapStylePreset): string {
  const isArea = layer.type === "land";
  const baseFill = preset.layerColors[layer.type] ?? preset.ink;
  const st = el.style ?? {};
  const stroke = st.stroke ?? preset.ink;
  const strokeWidth = st.strokeWidth ?? preset.strokeWidth;
  const opacity = st.opacity;
  const dataId = { "data-element-id": el.id };

  switch (el.type) {
    case "circle": {
      // `width` wird als Radius interpretiert (Default 5).
      const r = toFinite(el.width, 5);
      return `<circle${attrs({
        cx: el.x,
        cy: el.y,
        r,
        fill: st.fill ?? baseFill,
        stroke,
        "stroke-width": strokeWidth,
        opacity,
        ...dataId,
      })}/>`;
    }
    case "rect": {
      const w = toFinite(el.width, 0);
      const h = toFinite(el.height, 0);
      return `<rect${attrs({
        x: el.x,
        y: el.y,
        width: w,
        height: h,
        fill: st.fill ?? (isArea ? baseFill : "none"),
        stroke,
        "stroke-width": strokeWidth,
        opacity,
        ...dataId,
      })}/>`;
    }
    case "text": {
      return `<text${attrs({
        x: el.x,
        y: el.y,
        fill: st.fill ?? st.color ?? preset.text,
        "font-family": st.fontFamily ?? preset.fontFamily,
        "font-size": st.fontSize ?? 14,
        opacity,
        ...dataId,
      })}>${escapeXml(el.content ?? "")}</text>`;
    }
    case "path":
    default: {
      const d =
        typeof el.content === "string" && el.content.trim()
          ? el.content
          : `M ${el.x} ${el.y}`;
      return `<path${attrs({
        d,
        fill: st.fill ?? (isArea ? baseFill : "none"),
        stroke,
        "stroke-width": strokeWidth,
        opacity,
        ...dataId,
      })}/>`;
    }
  }
}

function renderLayer(layer: MapLayer): string {
  const preset = getMapStylePreset(layer.style);
  const els = layer.elements
    .map((el) => `    ${renderElement(el, layer, preset)}`)
    .join("\n");
  return `  <g class="layer"${attrs({
    "data-layer-id": layer.id,
    "data-layer-type": layer.type,
    "data-layer-name": layer.name,
  })}>\n${els}\n  </g>`;
}

/** Normalisiert eine Ebenen-Liste defensiv (Nicht-Arrays/Null ⇒ leere Liste). */
function normalizeLayers(layers: MapLayer[]): MapLayer[] {
  if (!Array.isArray(layers)) return [];
  return layers
    .filter((l): l is MapLayer => !!l && typeof l === "object")
    .map((l) => createMapLayer(l));
}

interface SvgOptions {
  width?: number;
  height?: number;
  dpi?: number;
}

function buildSvg(layers: MapLayer[], opts: SvgOptions = {}): string {
  const safe = normalizeLayers(layers);
  const visible = safe.filter((l) => l.visible !== false);
  const background = visible.length
    ? getMapStylePreset(visible[0].style).background
    : STYLE_PRESETS[DEFAULT_MAP_STYLE].background;
  const width = toFinite(opts.width, MAP_WIDTH);
  const height = toFinite(opts.height, MAP_HEIGHT);
  const body = visible.map(renderLayer).join("\n");
  const meta = opts.dpi ? ` data-dpi="${opts.dpi}" data-resolution="${width}x${height}"` : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="img"${meta}>\n` +
    `  <title>Karte</title>\n` +
    `  <rect x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" fill="${escapeXml(background)}"/>\n` +
    (body ? `${body}\n` : "") +
    `</svg>`
  );
}

/**
 * Exportiert die sichtbaren Ebenen als skalierbares SVG (viewBox im
 * Welt-Raster 0..1000). Unsichtbare Ebenen werden übersprungen; leere oder
 * ungültige Eingaben ergeben ein valides, leeres SVG.
 */
export function exportToSvg(layers: MapLayer[]): string {
  return buildSvg(layers);
}

function normalizeDpi(dpi?: number): number {
  if (typeof dpi !== "number" || !Number.isFinite(dpi) || dpi <= 0) return DEFAULT_DPI;
  return Math.min(MAX_DPI, Math.max(MIN_DPI, Math.round(dpi)));
}

/**
 * Exportiert die Kartenebenen als hochauflösendes Vektor-Dokument für die
 * Rasterung nach TIFF/PNG. Die viewBox bleibt im Welt-Raster; Breite/Höhe
 * werden aus der physischen Kartengröße ({@link MAP_INCHES} Zoll) × DPI
 * berechnet (Default 300 DPI ⇒ 3000×3000 px). Die Rasterung selbst
 * übernimmt die Export-Pipeline (Canvas/Tauri) — diese Funktion bleibt rein
 * und deterministisch. Ungültige DPI-Werte fallen auf 300 zurück und werden
 * auf [72, 2400] begrenzt.
 */
export function exportToHighRes(layers: MapLayer[], dpi: number = DEFAULT_DPI): string {
  const safeDpi = normalizeDpi(dpi);
  const px = Math.round(MAP_INCHES * safeDpi);
  return buildSvg(layers, { width: px, height: px, dpi: safeDpi });
}
