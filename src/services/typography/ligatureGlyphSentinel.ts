// LigatureGlyphSentinel (WP 89.2)
// Ligaturen- & Morphemgrenzen-Wächter.
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

export interface LigatureRule {
  pattern: string;
  replacement: string;
  condition?: "morpheme-boundary" | "word-boundary" | "always";
  description: string;
}

export interface LigatureViolation {
  position: number;
  original: string;
  corrected: string;
  rule: string;
  severity: "error" | "warning";
  context: string;
}

export interface MorphemeBoundary {
  position: number;
  leftMorpheme: string;
  rightMorpheme: string;
  needsZWNJ: boolean;
  reason: string;
}

export interface LigatureReport {
  text: string;
  violations: LigatureViolation[];
  morphemeBoundaries: MorphemeBoundary[];
  zwNJInserted: number;
  correctedText: string;
  stats: {
    totalLigatures: number;
    violationsFixed: number;
    zwNJInserted: number;
  };
}

const _LIGATURE_RULES: LigatureRule[] = [
  {
    pattern: "fi",
    replacement: "fi",
    condition: "morpheme-boundary",
    description: "fi-Ligatur an Morphemgrenze vermeiden (z.B. Auf-fahrt → Auf&#8204;fahrt)",
  },
  {
    pattern: "fl",
    replacement: "fl",
    condition: "morpheme-boundary",
    description: "fl-Ligatur an Morphemgrenze vermeiden (z.B. schlaf-los → schlaf&#8204;los)",
  },
  {
    pattern: "ff",
    replacement: "ff",
    condition: "morpheme-boundary",
    description: "ff-Ligatur an Morphemgrenze vermeiden (z.B. Schiff-fahrt → Schiff&#8204;fahrt)",
  },
  {
    pattern: "ffi",
    replacement: "ffi",
    condition: "morpheme-boundary",
    description: "ffi-Ligatur an Morphemgrenze vermeiden",
  },
  {
    pattern: "ffl",
    replacement: "ffl",
    condition: "morpheme-boundary",
    description: "ffl-Ligatur an Morphemgrenze vermeiden",
  },
  {
    pattern: "ft",
    replacement: "ft",
    condition: "morpheme-boundary",
    description: "ft-Ligatur an Morphemgrenze vermeiden (z.B. Auf-trag → Auf&#8204;trag)",
  },
  {
    pattern: "st",
    replacement: "st",
    condition: "morpheme-boundary",
    description: "st-Ligatur an Morphemgrenze vermeiden (z.B. Ein-stieg → Ein&#8204;stieg)",
  },
  {
    pattern: "ſs",
    replacement: "ſs",
    condition: "morpheme-boundary",
    description: "Lang-s + s Ligatur an Morphemgrenze vermeiden",
  },
  {
    pattern: "ſt",
    replacement: "ſt",
    condition: "morpheme-boundary",
    description: "Lang-s + t Ligatur an Morphemgrenze vermeiden",
  },
  {
    pattern: "ſl",
    replacement: "ſl",
    condition: "morpheme-boundary",
    description: "Lang-s + l Ligatur an Morphemgrenze vermeiden",
  },
  {
    pattern: "ſh",
    replacement: "ſh",
    condition: "morpheme-boundary",
    description: "Lang-s + h Ligatur an Morphemgrenze vermeiden",
  },
  {
    pattern: "ch",
    replacement: "ch",
    condition: "morpheme-boundary",
    description: "ch-Ligatur an Morphemgrenze vermeiden (z.B. Dach-decker → Dach&#8204;decker)",
  },
  {
    pattern: "ck",
    replacement: "ck",
    condition: "morpheme-boundary",
    description: "ck-Ligatur an Morphemgrenze vermeiden (z.B. Zu-cker → Zu&#8204;cker)",
  },
];

const ZWNJ = "\u200C"; // Zero Width Non-Joiner

// German prefixes that create morpheme boundaries
const GERMAN_PREFIXES = [
  "ab", "an", "auf", "aus", "bei", "da", "dar", "durch", "ein", "ent", "entgegen",
  "entlang", "er", "fehl", "für", "gegen", "heim", "her", "hin", "hoch", "hinter", "miss",
  "mit", "nach", "nieder", "nicht", "o", "ob", "statt", "über", "um", "unter",
  "ver", "vor", "weg", "wider", "wieder", "zu", "zurück", "zusammen", "zueinander",
];

// German suffixes that create morpheme boundaries
const GERMAN_SUFFIXES = [
  "bar", "chen", "er", "el", "en", "end", "e", "haft", "heit", "ig", "isch",
  "keit", "lich", "ling", "los", "nis", "sal", "schaft", "tum", "ung",
];

export function findMorphemeBoundaries(word: string): MorphemeBoundary[] {
  const boundaries: MorphemeBoundary[] = [];
  const lower = word.toLowerCase();
  
  // Check for prefixes at the start of the word
  for (const prefix of GERMAN_PREFIXES) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      boundaries.push({
        position: prefix.length,
        leftMorpheme: lower.slice(0, prefix.length),
        rightMorpheme: lower.slice(prefix.length),
        needsZWNJ: true,
        reason: `Präfix "${prefix}" erkannt`,
      });
    }
  }
  
  // Check for suffixes at the end of the word
  for (const suffix of GERMAN_SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length > suffix.length) {
      const pos = lower.length - suffix.length;
      boundaries.push({
        position: pos,
        leftMorpheme: lower.slice(0, pos),
        rightMorpheme: lower.slice(pos),
        needsZWNJ: true,
        reason: `Suffix "${suffix}" erkannt`,
      });
    }
  }
  
  // Deduplizieren: gleiche Position nur einmal
  const unique = boundaries.filter((b, i, arr) => 
    arr.findIndex(b2 => b2.position === b.position) === i
  );
  
  return unique.sort((a, b) => a.position - b.position);
}

export function scanLigatureViolations(text: string): LigatureViolation[] {
  const violations: LigatureViolation[] = [];
  // Split on whitespace and punctuation but NOT on hyphens between letters (German compounds)
  const words = text.split(/(\s+|[.,;:!?()[\]{}"'])/);
  let position = 0;
  
  for (const word of words) {
    if (!word.trim() || /^[\s.,;:!?()[\]{}"'-]+$/.test(word)) {
      position += word.length;
      continue;
    }
    
    const boundaries = findMorphemeBoundaries(word);
    
    for (const boundary of boundaries) {
      const globalPos = position + boundary.position;
      const contextStart = Math.max(0, globalPos - 20);
      const contextEnd = Math.min(text.length, globalPos + 20);
      const context = text.slice(contextStart, contextEnd);
      
      violations.push({
        position: globalPos,
        original: word,
        corrected: word.slice(0, boundary.position) + ZWNJ + word.slice(boundary.position),
        rule: `Morphemgrenze: ${boundary.leftMorpheme}|${boundary.rightMorpheme}`,
        severity: "error",
        context: `...${context}...`,
      });
    }
    
    position += word.length;
  }
  
  return violations;
}

export function correctLigatures(text: string): { corrected: string; violations: LigatureViolation[] } {
  const violations = scanLigatureViolations(text);
  let corrected = text;
  let offset = 0;
  
  // Von hinten nach vorne einfügen, um Offsets beizubehalten
  const sortedViolations = [...violations].sort((a, b) => b.position - a.position);
  
  for (const v of sortedViolations) {
    const pos = v.position + offset;
    corrected = corrected.slice(0, pos) + ZWNJ + corrected.slice(pos);
    offset += ZWNJ.length;
  }
  
  return { corrected, violations };
}

export function applyZWNJAtBoundaries(text: string): string {
  const { corrected } = correctLigatures(text);
  return corrected;
}

export function scanAndReport(text: string): LigatureReport {
  const violations = scanLigatureViolations(text);
  const { corrected: _corrected } = correctLigatures(text);

  // Morphemgrenzen für alle Wörter sammeln
  // Split on whitespace and punctuation but NOT on hyphens between letters (German compounds)
  const words = text.split(/(\s+|[.,;:!?()[\]{}"'])/);
  let position = 0;
  const allBoundaries: MorphemeBoundary[] = [];

  for (const word of words) {
    if (!word.trim() || /^[\s.,;:!?()[\]{}"']+$/.test(word)) {
      position += word.length;
      continue;
    }
    
    const boundaries = findMorphemeBoundaries(word);
    for (const b of boundaries) {
      allBoundaries.push({
        ...b,
        position: position + b.position,
      });
    }
    position += word.length;
  }
  
  const correctedText = applyZWNJAtBoundaries(text);
  const zwNJCount = (correctedText.match(/\u200C/g) || []).length;
  
  return {
    text,
    violations,
    morphemeBoundaries: allBoundaries,
    zwNJInserted: zwNJCount,
    correctedText,
    stats: {
      totalLigatures: violations.length,
      violationsFixed: violations.filter(v => v.severity === "error").length,
      zwNJInserted: zwNJCount,
    },
  };
}

export function createSampleReport(): LigatureReport {
  const text = "Auf-fahrt schlaf-los Schiff-fahrt Auf-trag Ein-stieg Zu-cker Dach-decker";
  return scanAndReport(text);
}

export function createSampleText(): string {
  return "Auf-fahrt schlaf-los Schiff-fahrt Auf-trag Ein-stieg Zu-cker Dach-decker";
}