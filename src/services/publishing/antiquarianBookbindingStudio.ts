// AntiquarianBookbindingStudio (WP 117.2, Meilenstein 56.0 / v6.8.0)
// Antiquarisches Marmorpapier- und Buchbinder-Studio für gotische Belletristik.
//
// Enthält:
//  - Mathematischer Marmorpapier-Generator (Pfauenfeder, Schneckenmarmor,
//    Getöteter Stein) auf Basis von Sinuswellen, Spiralen und konzentrischen
//    Ringen.
//  - Buchrücken-Mockup mit erhabenen Querrippen (echten Bünden) und
//    Goldfolien-Prägung.
//  - Druckfertiger SVG/PDF-Export mit 300-DPI-, CMYK- und Beschnitt-Hinweisen.
//
// Deterministisch: FNV-1a + mulberry32. Ausschließlich Design-Tokens
// (var(--accent), var(--fg) usw.), keine Hex-Farben. Keine Node-Module,
// browserkompatibel.

// ---------------------------------------------------------------------------
// Deterministische Zufallsbasis
// ---------------------------------------------------------------------------

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

/** Wählt ein Element deterministisch; wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) throw new Error("pick: leeres Array");
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}

// ---------------------------------------------------------------------------
// Marmorpapier-Muster
// ---------------------------------------------------------------------------

export type MarblePatternId = "peacock" | "snail" | "stone";

export interface MarblePattern {
  id: MarblePatternId;
  name: string;
  description: string;
  /** Farbreihenfolge der Marmorierbäder — nur Design-Tokens, keine Hex-Farben. */
  tokens: readonly string[];
}

export const MARBLE_PATTERNS = [
  {
    id: "peacock",
    name: "Pfauenfeder",
    description:
      "Pfauenfedermarmor: konzentrische Feder-Augen mit schmalen Spiralen, die in Reihen über das Blatt laufen — das klassische englische Vorsatzpapier des 18. Jahrhunderts.",
    tokens: ["var(--accent)", "var(--accent-dim)", "var(--fg-dim)", "var(--fg-faint)"],
  },
  {
    id: "snail",
    name: "Schneckenmarmor",
    description:
      "Schneckenmarmor: ruhige Sinuswellen-Bänder mit einer zentralen archimedischen Spirale — benannt nach dem gewundenen Schneckenhaus, das die Farbe beim Abziehen hinterlässt.",
    tokens: ["var(--fg-dim)", "var(--accent)", "var(--accent-dim)", "var(--border-strong)"],
  },
  {
    id: "stone",
    name: "Getöteter Stein",
    description:
      "Getöteter Stein: unregelmäßig gestörte, konzentrische Ringe mit geäderten Rissen — das bei Buchbindern „stone marbling“ genannte, steinartig gesprenkelte Marmor.",
    tokens: ["var(--fg-faint)", "var(--fg-dim)", "var(--accent-dim)", "var(--accent)"],
  },
] as const satisfies readonly MarblePattern[];

export function getMarblePattern(id: string): MarblePattern | undefined {
  return MARBLE_PATTERNS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Mathematische Zeichenprimitive (rein deterministisch)
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Geschlossener, sinusgestörter Ring (konzentrisch). */
function wavyRing(cx: number, cy: number, radius: number, segments: number, amp: number, phase: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const r = radius + Math.sin(t * 3 + phase) * amp + Math.sin(t * 5 + phase * 1.7) * amp * 0.4;
    const x = round2(cx + Math.cos(t) * r);
    const y = round2(cy + Math.sin(t) * r);
    pts.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return pts.join(" ") + " Z";
}

/** Archimedische Spirale: r = t · maxR. */
function spiralPath(cx: number, cy: number, maxR: number, turns: number, phase: number): string {
  const steps = 48;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns + phase;
    const r = t * maxR;
    const x = round2(cx + Math.cos(angle) * r);
    const y = round2(cy + Math.sin(angle) * r);
    pts.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return pts.join(" ");
}

/** Offene Sinuswelle von x0 nach x1. */
function sineWavePath(x0: number, x1: number, y0: number, amp: number, freq: number, phase: number): string {
  const steps = 64;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = round2(x0 + (x1 - x0) * t);
    const y = round2(y0 + Math.sin(t * Math.PI * 2 * freq + phase) * amp);
    pts.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return pts.join(" ");
}

/** Geäderte Radiallinie (Riss) von innen nach außen. */
function radialVein(cx: number, cy: number, rInner: number, rOuter: number, angle: number, wobble: number, phase: number): string {
  const steps = 12;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = rInner + (rOuter - rInner) * t;
    const a = angle + Math.sin(t * Math.PI * 2 + phase) * wobble;
    const x = round2(cx + Math.cos(a) * r);
    const y = round2(cy + Math.sin(a) * r);
    pts.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return pts.join(" ");
}

// ---------------------------------------------------------------------------
// Musterkörper (liefern jeweils SVG-Fragmente)
// ---------------------------------------------------------------------------

function peacockBody(width: number, height: number, rng: () => number, tokens: readonly string[]): string {
  const parts: string[] = [];
  const cols = 4;
  const rows = 3;
  const cw = width / cols;
  const ch = height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = round2(cw * (c + 0.5) + (rng() - 0.5) * cw * 0.25);
      const cy = round2(ch * (r + 0.5) + (rng() - 0.5) * ch * 0.25);
      const rings = 3 + Math.floor(rng() * 3);
      const base = Math.min(cw, ch) * (0.16 + rng() * 0.08);
      const token = pick(tokens, rng);
      const phase = rng() * Math.PI * 2;
      for (let k = rings; k >= 1; k--) {
        const rad = base * k;
        const opacity = round2(0.35 + (rings - k) / (rings * 2));
        parts.push(
          `<path d="${wavyRing(cx, cy, rad, 28, k * 0.5, phase)}" style="fill: none; stroke: ${token}" stroke-width="1.1" opacity="${opacity}" />`
        );
      }
      parts.push(
        `<path d="${spiralPath(cx, cy, base * 0.6, 1.6, phase)}" style="fill: none; stroke: ${token}" stroke-width="1.4" opacity="0.9" />`
      );
    }
  }
  return parts.join("");
}

function snailBody(width: number, height: number, rng: () => number, tokens: readonly string[]): string {
  const parts: string[] = [];
  const bands = 5 + Math.floor(rng() * 4);
  for (let b = 0; b < bands; b++) {
    const y0 = (height / (bands + 1)) * (b + 1);
    const amp = 8 + rng() * 20;
    const freq = 1.4 + rng() * 2.6;
    const phase = rng() * Math.PI * 2;
    const token = pick(tokens, rng);
    parts.push(
      `<path d="${sineWavePath(-10, width + 10, round2(y0), amp, freq, phase)}" style="fill: none; stroke: ${token}" stroke-width="1.3" opacity="0.75" />`
    );
  }
  const cx = round2(width * 0.5 + (rng() - 0.5) * width * 0.12);
  const cy = round2(height * 0.5 + (rng() - 0.5) * height * 0.12);
  const maxR = Math.min(width, height) * 0.32;
  const phase = rng() * Math.PI * 2;
  const turns = 2.4 + rng() * 1.2;
  const token = pick(tokens, rng);
  parts.push(
    `<path d="${spiralPath(cx, cy, maxR, turns, phase)}" style="fill: none; stroke: ${token}" stroke-width="1.6" opacity="0.9" />`
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="2.4" style="fill: ${token}" opacity="0.9" />`
  );
  return parts.join("");
}

function stoneBody(width: number, height: number, rng: () => number, tokens: readonly string[]): string {
  const parts: string[] = [];
  const cx = round2(width * 0.5 + (rng() - 0.5) * width * 0.1);
  const cy = round2(height * 0.5 + (rng() - 0.5) * height * 0.1);
  const rings = 6 + Math.floor(rng() * 4);
  const maxR = Math.min(width, height) * 0.46;
  for (let k = rings; k >= 1; k--) {
    const rad = (maxR * k) / rings;
    const token = pick(tokens, rng);
    const opacity = round2(0.3 + (rings - k) / (rings * 2.2));
    parts.push(
      `<path d="${wavyRing(cx, cy, rad, 24, rad * 0.14, k * 1.3)}" style="fill: none; stroke: ${token}" stroke-width="1" opacity="${opacity}" />`
    );
  }
  const veins = 5 + Math.floor(rng() * 4);
  for (let v = 0; v < veins; v++) {
    const angle = (v / veins) * Math.PI * 2 + rng() * 0.4;
    const token = pick(tokens, rng);
    parts.push(
      `<path d="${radialVein(cx, cy, maxR * 0.15, maxR * (0.7 + rng() * 0.3), angle, 0.12, rng() * Math.PI * 2)}" style="fill: none; stroke: ${token}" stroke-width="0.8" opacity="0.5" />`
    );
  }
  return parts.join("");
}

function renderMarbleSvg(def: MarblePattern, width: number, height: number, body: string): string {
  const ground = `<rect x="0" y="0" width="${width}" height="${height}" style="fill: var(--bg-elev)" />`;
  const frame = `<rect x="6" y="6" width="${width - 12}" height="${height - 12}" style="fill: none; stroke: var(--border-strong)" stroke-width="1.5" />`;
  const label = `<text x="${width / 2}" y="${height - 14}" text-anchor="middle" style="fill: var(--fg-faint); font-family: serif" font-size="9">${escapeXml(def.name)} · Marmorpapier</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${ground}
  ${body}
  ${frame}
  ${label}
</svg>`;
}

// ---------------------------------------------------------------------------
// WP 117.2.1 — Mathematischer Marmorpapier-Generator
// ---------------------------------------------------------------------------

export interface MarbledPaper {
  svg: string;
  pattern: string;
  width: number;
  height: number;
  dpi: number;
  description: string;
}

export function generateMarbledPaper(pattern: string, width: number, height: number, seed: number): MarbledPaper {
  const def = getMarblePattern(pattern) ?? MARBLE_PATTERNS[0];
  const w = Math.max(40, Math.floor(width));
  const h = Math.max(40, Math.floor(height));
  const rng = createSeededRandom(hashString(`marble:${def.id}:${w}x${h}:${seed}`));

  let body: string;
  if (def.id === "peacock") body = peacockBody(w, h, rng, def.tokens);
  else if (def.id === "snail") body = snailBody(w, h, rng, def.tokens);
  else body = stoneBody(w, h, rng, def.tokens);

  return {
    svg: renderMarbleSvg(def, w, h, body),
    pattern: def.id,
    width: w,
    height: h,
    dpi: 300,
    description: def.description,
  };
}

// ---------------------------------------------------------------------------
// WP 117.2.2 — Buchrücken-Mockup mit echten Bünden (erhabene Querrippen)
// ---------------------------------------------------------------------------

export interface SpineMockup {
  svg: string;
  title: string;
  author: string;
  bands: number;
  description: string;
}

export function generateSpineMockup(title: string, author: string, bands: number = 5): SpineMockup {
  const b = Math.max(1, Math.min(9, Math.floor(bands)));
  const width = 140;
  const height = 520;
  const rng = createSeededRandom(hashString(`spine:${title}:${author}:${b}`));

  const marginTop = 44;
  const marginBottom = 44;
  const usable = height - marginTop - marginBottom;
  const gap = usable / (b + 1);

  // Lederdeckel.
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" rx="4" style="fill: var(--panel-2); stroke: var(--border-strong)" stroke-width="2" />`);

  // Erhabene Bünde (Querrippen) mit Goldfolien-Kanten.
  for (let i = 0; i < b; i++) {
    const y = round2(marginTop + gap * (i + 1));
    parts.push(
      `<rect x="7" y="${y - 7}" width="${width - 14}" height="14" rx="3" style="fill: var(--bg-elev); stroke: var(--border-strong)" stroke-width="1" />`
    );
    parts.push(`<line x1="7" y1="${y - 7}" x2="${width - 7}" y2="${y - 7}" style="stroke: var(--accent)" stroke-width="1.6" />`);
    parts.push(`<line x1="7" y1="${y + 7}" x2="${width - 7}" y2="${y + 7}" style="stroke: var(--accent)" stroke-width="1.6" />`);
    parts.push(`<line x1="7" y1="${y}" x2="${width - 7}" y2="${y}" style="stroke: var(--accent-dim)" stroke-width="0.8" opacity="0.7" />`);
  }

  // Kapitelbänder (head/tail bands) oben und unten.
  const stripeCount = 6 + Math.floor(rng() * 4);
  for (const capY of [marginTop - 22, height - marginBottom + 8]) {
    for (let s = 0; s < stripeCount; s++) {
      const sx = 7 + (s / stripeCount) * (width - 14);
      const token = s % 2 === 0 ? "var(--accent)" : "var(--fg-dim)";
      parts.push(`<line x1="${round2(sx)}" y1="${capY}" x2="${round2(sx)}" y2="${capY + 14}" style="stroke: ${token}" stroke-width="${round2((width - 14) / stripeCount)}" opacity="0.85" />`);
    }
  }

  // Titel im oberen Feld, Autor im unteren Feld — Goldfolien-Prägung, längs des Rückens.
  const titleY = round2(marginTop + gap * 0.5);
  const authorY = round2(height - marginBottom - gap * 0.5);
  const cx = width / 2;

  const titleSvg = `<text transform="translate(${cx} ${titleY}) rotate(-90)" text-anchor="middle" style="fill: var(--accent); font-family: serif; font-weight: bold" font-size="20">${escapeXml(title)}</text>`;
  const authorSvg = `<text transform="translate(${cx} ${authorY}) rotate(-90)" text-anchor="middle" style="fill: var(--fg-dim); font-family: serif; font-style: italic" font-size="13">${escapeXml(author)}</text>`;

  // Zierlinien (Rollen) über und unter den Feldern.
  const ruleTop = round2(marginTop + gap * 0.5 - 40);
  const ruleBottom = round2(height - marginBottom - gap * 0.5 - 34);
  const rules =
    `<line x1="34" y1="${ruleTop}" x2="${width - 34}" y2="${ruleTop}" style="stroke: var(--accent-dim)" stroke-width="1" />` +
    `<line x1="34" y1="${round2(ruleTop + 4)}" x2="${width - 34}" y2="${round2(ruleTop + 4)}" style="stroke: var(--accent-dim)" stroke-width="0.6" opacity="0.7" />` +
    `<line x1="34" y1="${ruleBottom}" x2="${width - 34}" y2="${ruleBottom}" style="stroke: var(--accent-dim)" stroke-width="1" />` +
    `<line x1="34" y1="${round2(ruleBottom - 4)}" x2="${width - 34}" y2="${round2(ruleBottom - 4)}" style="stroke: var(--accent-dim)" stroke-width="0.6" opacity="0.7" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${parts.join("")}
  ${rules}
  ${titleSvg}
  ${authorSvg}
</svg>`;

  return {
    svg,
    title,
    author,
    bands: b,
    description:
      `Buchrücken-Mockup „${title}“ von ${author} mit ${b} erhabenen Querrippen (echten Bünden) und Goldfolien-Prägung. ` +
      "Die Bünde tragen den Deckel über die Heftung und prägen das klassische Rippenbild des Handeinbands.",
  };
}

// ---------------------------------------------------------------------------
// WP 117.2.3 — Druckfertiger PDF-Export
// ---------------------------------------------------------------------------

export interface PrintExport {
  format: "svg";
  width: number;
  height: number;
  dpi: number;
  notes: string[];
}

export function buildPrintExport(
  marbledPaper: { svg: string; width: number; height: number },
  spine: { svg: string; title: string }
): PrintExport {
  const width = Math.max(40, Math.floor(marbledPaper.width));
  const height = Math.max(40, Math.floor(marbledPaper.height));
  const dpi = 300;
  const widthInches = Math.round((width / dpi) * 1000) / 1000;
  const heightInches = Math.round((height / dpi) * 1000) / 1000;
  const bleedInches = 0.125;

  return {
    format: "svg",
    width,
    height,
    dpi,
    notes: [
      `Vektor-Ausgabe bei ${dpi} DPI (${widthInches}″ × ${heightInches}″) — im PDF als Pfade, nicht als Bitmap.`,
      "Alle Farben sind Design-Tokens; vor dem Druck zwingend in CMYK wandeln (z. B. Profil ISO Coated v2, relatives farbmetrisches Rendering).",
      `Beschnittzugabe von ${bleedInches}″ (≈ 3 mm) rundum für den Buchbinder einplanen; Bundzugabe am Rücken zusätzlich.`,
      `Rückenbeschriftung „${spine.title}“ mindestens 12 mm vom Bund und vom Kopf-/Fußbeschnitt fernhalten.`,
      "Schwarze Flächen als reines Schwarz (K-only) anlegen, um Registerfehler im Mehrfarbdruck zu vermeiden.",
      "Goldfolien-Prägung des Rückens ist ein separater Prägegang und nicht im CMYK-Satz enthalten.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Beispielfabriken
// ---------------------------------------------------------------------------

export function createSampleMarbledPaper(): MarbledPaper {
  return generateMarbledPaper("peacock", 300, 400, 42);
}

export function createSampleSpineMockup(): SpineMockup {
  return generateSpineMockup("Der Schatten über Innsmouth", "H. P. Lovecraft", 5);
}
