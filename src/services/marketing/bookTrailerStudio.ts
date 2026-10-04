// bookTrailerStudio.ts — Marketing-Studio: Book-Trailer-Studio (WP 44.1).
// Erzeugt deterministische Trailer-Timelines, Frame-Beschreibungen und einen
// animierten SVG-Fallback-Export (SMIL). Lokal, keine LLM-/Netzwerkaufrufe.
// Alle Funktionen sind defensiv: fehlende/ungültige Daten liefern sichere
// Fallbacks statt Ausnahmen.

export type TrailerFormat = "vertical" | "horizontal";

export type TrailerKeyframeKind =
  | "hook"
  | "particles"
  | "title"
  | "cover-rotate"
  | "cta";

export interface TrailerConfig {
  title: string;
  author: string;
  hookQuote: string;
  callToAction: string;
  coverImageUrl?: string;
  format: TrailerFormat;
}

export interface TrailerKeyframe {
  id: string;
  kind: TrailerKeyframeKind;
  startMs: number;
  durationMs: number;
  content: string;
}

export interface TrailerTimeline {
  id: string;
  format: TrailerFormat;
  width: number;
  height: number;
  keyframes: TrailerKeyframe[];
  totalDurationMs: number;
}

export interface TrailerFrame {
  timeMs: number;
  activeKeyframe: string;
  opacity: number;
  scale: number;
  rotationDeg: number;
  text: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const FORMAT_DIMENSIONS: Record<TrailerFormat, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 }, // 9:16
  horizontal: { width: 1920, height: 1080 }, // 16:9
};

const DEFAULT_FORMAT: TrailerFormat = "vertical";

// Jeder Keyframe dauert 3 s → Gesamtdauer 5 × 3 s = 15 s.
const KEYFRAME_DURATION_MS = 3000;

const KIND_SEQUENCE: TrailerKeyframeKind[] = [
  "hook",
  "particles",
  "title",
  "cover-rotate",
  "cta",
];

// Scale-Verlauf [start, ende] je Keyframe-Typ (deterministisch, ohne Zufall).
const SCALE_RANGE: Record<TrailerKeyframeKind, [number, number]> = {
  hook: [1.0, 1.08],
  particles: [1.0, 1.15],
  title: [0.92, 1.0],
  "cover-rotate": [1.0, 1.06],
  cta: [1.0, 1.1],
};

// Anteil der Keyframe-Dauer, über den ein-/ausgeblendet wird (Crossfade).
const FADE_RATIO = 0.2;

const COLOR_BG = "#0b0b14";
const COLOR_TEXT = "#f8fafc";
const COLOR_ACCENT = "#7dd3fc";
const COLOR_COVER = "#1e293b";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Liefert einen bereinigten String oder den Fallback bei leer/undefined/null. */
function safe(value: string | undefined | null, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Rundet auf 4 Nachkommastellen, damit Ausgaben stabil/deterministisch sind. */
function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

/** Deterministischer djb2-Hash (hex) — kein Math.random, keine Zeit. */
function deterministicHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

/** Escaped XML/SVG-spezifische Zeichen. */
function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Löst ein Format defensiv auf: ungültig/undefined → Default. */
function resolveFormat(format: TrailerFormat | undefined | null): TrailerFormat {
  return validateFormat(format as TrailerFormat) ? (format as TrailerFormat) : DEFAULT_FORMAT;
}

/** Blendkurve: 0 → 1 → 0 über die Keyframe-Dauer (Crossfade). */
function fadeEnvelope(progress: number, fadeRatio = FADE_RATIO): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 0;
  if (progress < fadeRatio) return progress / fadeRatio;
  if (progress > 1 - fadeRatio) return (1 - progress) / fadeRatio;
  return 1;
}

// ---------------------------------------------------------------------------
// 5. validateFormat
// ---------------------------------------------------------------------------

/** Prüft, ob ein Format gültig ist ('vertical' | 'horizontal'). */
export function validateFormat(format: TrailerFormat): boolean {
  return format === "vertical" || format === "horizontal";
}

// ---------------------------------------------------------------------------
// 1. createTrailerTimeline
// ---------------------------------------------------------------------------

/**
 * Erzeugt aus einer TrailerConfig eine deterministische Keyframe-Timeline.
 * Ablauf: Hook (0–3 s) → Partikel (3–6 s) → Titel (6–9 s) →
 * 3D-Cover-Drehung (9–12 s) → Call-to-Action (12–15 s).
 * Defensive Fallbacks bei fehlenden Texten oder ungültigem Format.
 */
export function createTrailerTimeline(config: TrailerConfig): TrailerTimeline {
  const safeConfig = (config ?? {}) as Partial<TrailerConfig>;
  const format = resolveFormat(safeConfig.format);
  const dims = FORMAT_DIMENSIONS[format];

  const title = safe(safeConfig.title, "Unbekannter Titel");
  const author = safe(safeConfig.author, "Unbekannter Autor");
  const hookQuote = safe(safeConfig.hookQuote, "Eine Geschichte, die unter die Haut geht.");
  const callToAction = safe(safeConfig.callToAction, "Jetzt lesen!");
  const coverImageUrl = safe(safeConfig.coverImageUrl, "");

  const id = `trailer-${format}-${deterministicHash(`${title}|${author}|${format}`)}`;

  const contents: Record<TrailerKeyframeKind, string> = {
    hook: `„${hookQuote}“`,
    particles: "",
    title,
    "cover-rotate": `${title} · ${author}`,
    cta: callToAction,
  };

  let cursor = 0;
  const keyframes: TrailerKeyframe[] = KIND_SEQUENCE.map((kind, index) => {
    const keyframe: TrailerKeyframe = {
      id: `${id}-kf-${index}-${kind}`,
      kind,
      startMs: cursor,
      durationMs: KEYFRAME_DURATION_MS,
      content: contents[kind],
    };
    cursor += KEYFRAME_DURATION_MS;
    return keyframe;
  });

  // coverImageUrl wird an die Timeline gehängt (nicht Teil des Schemas, aber
  // für den SVG-Export nützlich) — nur wenn vorhanden.
  const timeline: TrailerTimeline = {
    id,
    format,
    width: dims.width,
    height: dims.height,
    keyframes,
    totalDurationMs: cursor,
  };

  if (coverImageUrl.length > 0) {
    (timeline as TrailerTimeline & { coverImageUrl?: string }).coverImageUrl = coverImageUrl;
  }

  return timeline;
}

// ---------------------------------------------------------------------------
// 4. calculateTrailerDuration
// ---------------------------------------------------------------------------

/**
 * Summiert die Dauer aller Keyframes. Defensiv: leere/fehlende Timeline → 0,
 * negative/ungültige Dauern werden als 0 gewertet.
 */
export function calculateTrailerDuration(timeline: TrailerTimeline): number {
  const keyframes = timeline?.keyframes;
  if (!Array.isArray(keyframes) || keyframes.length === 0) return 0;

  let total = 0;
  for (const keyframe of keyframes) {
    const duration = keyframe?.durationMs;
    if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
      total += duration;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// 2. renderTrailerFrame
// ---------------------------------------------------------------------------

/**
 * Rendert die Frame-Beschreibung (Canvas-Metadaten) zu einem Zeitpunkt.
 * Bestimmt den aktiven Keyframe und leitet Opacity (Crossfade), Scale und
 * Rotation ab. Defensiv: leere Timeline → sicherer Leer-Frame, Zeitwerte
 * außerhalb des Bereichs werden geklemmt.
 */
export function renderTrailerFrame(timeline: TrailerTimeline, timeMs: number): TrailerFrame {
  const keyframes = timeline?.keyframes;

  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    return {
      timeMs: Number.isFinite(timeMs) ? timeMs : 0,
      activeKeyframe: "",
      opacity: 0,
      scale: 1,
      rotationDeg: 0,
      text: "",
    };
  }

  const total = calculateTrailerDuration(timeline);
  const upperBound = total > 0 ? total - 1 : 0;
  const rawTime = Number.isFinite(timeMs) ? timeMs : 0;
  const clampedTime = Math.max(0, Math.min(rawTime, upperBound));

  // Aktiven Keyframe suchen (Intervall [start, start+duration)).
  let active = keyframes[0];
  for (const keyframe of keyframes) {
    const start = keyframe.startMs;
    const end = keyframe.startMs + keyframe.durationMs;
    if (clampedTime >= start && clampedTime < end) {
      active = keyframe;
      break;
    }
    // Fallback, falls Zeit hinter allen Keyframes liegt: letzten nehmen.
    if (clampedTime >= end) {
      active = keyframe;
    }
  }

  const local = clampedTime - active.startMs;
  const progress =
    active.durationMs > 0
      ? Math.min(1, Math.max(0, local / active.durationMs))
      : 0;

  const opacity = round4(fadeEnvelope(progress));

  const range = SCALE_RANGE[active.kind] ?? [1, 1];
  const scale = round4(range[0] + (range[1] - range[0]) * progress);

  const rotationDeg = active.kind === "cover-rotate" ? round4(progress * 360) : 0;

  return {
    timeMs: clampedTime,
    activeKeyframe: active.id,
    opacity,
    scale,
    rotationDeg,
    text: active.content,
  };
}

// ---------------------------------------------------------------------------
// 3. exportTimelineAsSvg
// ---------------------------------------------------------------------------

/** Baut deterministische Partikel-Kreise (Positionen aus Index abgeleitet). */
function buildParticles(width: number, height: number, count: number): string {
  const circles: string[] = [];
  for (let i = 0; i < count; i++) {
    const cx = (((i * 137) % 100) / 100) * width;
    const cy = (((i * 79) % 100) / 100) * height;
    const r = 3 + (i % 5);
    const delay = (i % 7) * 120;
    circles.push(
      `      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${COLOR_ACCENT}" opacity="0.7">` +
        `<animate attributeName="opacity" values="0.2;0.9;0.2" dur="2400ms" begin="${delay}ms" repeatCount="indefinite"/></circle>`
    );
  }
  return circles.join("\n");
}

/**
 * Exportiert die Timeline als animiertes SVG (SMIL). Dient als Fallback,
 * wenn kein Canvas/Video-Rendering verfügbar ist. Das Format bestimmt die
 * Zielmaße (9:16 bzw. 16:9); bei ungültigem Format wird auf das
 * Timeline-Format bzw. den Default zurückgegriffen.
 */
export function exportTimelineAsSvg(timeline: TrailerTimeline, format: TrailerFormat): string {
  const resolvedFormat = validateFormat(format)
    ? format
    : resolveFormat(timeline?.format);
  const dims = FORMAT_DIMENSIONS[resolvedFormat];
  const width = dims.width;
  const height = dims.height;

  const keyframes = timeline?.keyframes;
  const coverImageUrl = (timeline as TrailerTimeline & { coverImageUrl?: string })?.coverImageUrl ?? "";

  const cx = width / 2;
  const cy = height / 2;

  const groups: string[] = [];

  if (Array.isArray(keyframes)) {
    for (const keyframe of keyframes) {
      const begin = Math.max(0, keyframe.startMs);
      const dur = Math.max(0, keyframe.durationMs);
      const lines: string[] = [];

      lines.push(`    <g opacity="0">`);
      lines.push(
        `      <animate attributeName="opacity" begin="${begin}ms" dur="${dur}ms" values="0;1;1;0" keyTimes="0;0.2;0.8;1" fill="freeze"/>`
      );

      if (keyframe.kind === "particles") {
        lines.push(buildParticles(width, height, 18));
      }

      if (keyframe.kind === "cover-rotate") {
        const boxW = Math.round(width * 0.5);
        const boxH = Math.round(height * 0.45);
        const boxX = Math.round(cx - boxW / 2);
        const boxY = Math.round(cy - boxH / 2);
        lines.push(
          `      <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="16" fill="${COLOR_COVER}" stroke="${COLOR_ACCENT}" stroke-width="3">`
        );
        lines.push(
          `        <animateTransform attributeName="transform" type="rotate" begin="${begin}ms" dur="${dur}ms" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" fill="freeze"/>`
        );
        lines.push(`      </rect>`);
        if (coverImageUrl.length > 0) {
          lines.push(
            `      <image href="${escapeXml(coverImageUrl)}" x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" preserveAspectRatio="xMidYMid slice"/>`
          );
        }
      }

      if (keyframe.content.length > 0) {
        const fontSize =
          keyframe.kind === "hook" ? Math.round(height * 0.045) : Math.round(height * 0.055);
        lines.push(
          `      <text x="${cx}" y="${cy}" font-family="Georgia, serif" font-size="${fontSize}" fill="${COLOR_TEXT}" text-anchor="middle">${escapeXml(
            keyframe.content
          )}</text>`
        );
      }

      lines.push(`    </g>`);
      groups.push(lines.join("\n"));
    }
  }

  const total = calculateTrailerDuration(timeline);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-trailer-id="${escapeXml(
    safe(timeline?.id, "trailer")
  )}" data-duration-ms="${total}">
  <rect width="${width}" height="${height}" fill="${COLOR_BG}"/>
${groups.join("\n")}
</svg>`;
}
