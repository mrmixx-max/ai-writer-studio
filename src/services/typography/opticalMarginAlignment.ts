// OpticalMarginAlignment (WP 83.1)
//
// Optischer Randausgleich (Hängende Interpunktion) für Meistertypografie.
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

/** Glyphen-Typ. */
export type GlyphType = "hyphen" | "period" | "quote" | "dash" | "comma";

/** Überhangs-Prozente je Glyphen-Typ. */
export const GLYPH_PROTRUSION: Record<GlyphType, number> = {
  hyphen: 100,
  period: 70,
  quote: 80,
  dash: 50,
  comma: 60,
};

/** Glyphen-Labels. */
export const GLYPH_LABELS: Record<GlyphType, string> = {
  hyphen: "Bindestrich",
  period: "Punkt",
  quote: "Anführungszeichen",
  dash: "Gedankenstrich",
  comma: "Komma",
};

/** Ein Ausgleichs-Ergebnis. */
export interface AlignmentResult {
  glyph: GlyphType;
  protrusionPercent: number;
  cssValue: string;
  svgOffsetMm: number;
}

/** Berechnet den optischen Ausgleich für eine Glyphe. */
export function computeAlignment(glyph: GlyphType): AlignmentResult {
  const protrusion = GLYPH_PROTRUSION[glyph];
  const cssValue = `hanging-punctuation: first last`;
  const svgOffsetMm = (protrusion / 100) * 2.5;
  return { glyph, protrusionPercent: protrusion, cssValue, svgOffsetMm };
}

/** Berechnet alle Ausgleiche. */
export function computeAllAlignments(): AlignmentResult[] {
  const glyphs: GlyphType[] = ["hyphen", "period", "quote", "dash", "comma"];
  return glyphs.map((g) => computeAlignment(g));
}

/** Generiert CSS für hängende Interpunktion. */
export function generateHangingPunctuationCSS(): string {
  return `p {\n  hanging-punctuation: first last;\n  text-align: justify;\n  hyphens: auto;\n}`;
}

/** Generiert SVG-Fallback für eine Glyphe. */
export function generateSVGFallback(glyph: GlyphType): string {
  const offset = (GLYPH_PROTRUSION[glyph] / 100) * 2.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20" viewBox="0 0 100 20">
  <text x="${10 - offset}" y="15" fill="var(--fg)" font-family="serif" font-size="14">${GLYPH_LABELS[glyph]}</text>
</svg>`;
}

/** Formatiert alle Ausgleiche als Text. */
export function formatAlignments(results: AlignmentResult[]): string {
  const lines: string[] = [];
  lines.push(`=== OPTISCHER RANDAUSGLEICH ===`);
  for (const r of results) {
    lines.push(`  ${GLYPH_LABELS[r.glyph]}: ${r.protrusionPercent}% Überhang, SVG-Offset: ${r.svgOffsetMm}mm`);
  }
  return lines.join("\n");
}

/** Erstellt Beispiel-Ausgleiche. */
export function createSampleAlignments(): AlignmentResult[] {
  return computeAllAlignments();
}
