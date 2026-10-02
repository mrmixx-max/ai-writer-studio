// Literarische-Übersetzungs-Service (WP 18.2, Dual-Editor).
//
// Lokal, deterministisch, KEIN LLM. Die drei Prüf-/Align-Funktionen laufen
// rein auf Strings und liefern bei fehlenden Daten leere/defensive Ergebnisse
// statt zu werfen. Sie ergänzen das bestehende BilingualPanel (DE↔EN), das
// die eigentliche Übersetzung über einen injizierbaren Provider macht.
//
//   alignDualText           — Original ↔ Übersetzung satz-/absatzweise syncen
//   checkGlossaryCompliance — nicht übersetzte Glossar-Begriffe finden
//   checkVoiceConsistency   — Sprechstil-Divergenzen der Zielsprache melden

// --- Typen ---------------------------------------------------------------------

/** Ein synchronisiertes Original/Übersetzungs-Paar. */
export interface AlignedSegment {
  /** Deterministische ID im Schema `p<Absatz>-s<Satz>` (1-basiert). */
  id: string;
  /** Quellsatz; leer, wenn die Übersetzung mehr Sätze hat. */
  original: string;
  /** Zielsatz; leer, wenn das Original mehr Sätze hat. */
  translation: string;
  /**
   * true für den ersten Satz jedes Absatzes (Absatzgrenze) — auch für
   * Leerabsätze, die als Segment mit leerem original/translation erhalten
   * bleiben, damit die Struktur im Dual-Editor nicht kollabiert.
   */
  isParagraphBreak: boolean;
}

/** Kategorie eines Glossar-Eintrags. */
export type GlossaryCategory = "name" | "rank" | "term" | "idiom";

/** Ein Glossar-Eintrag: Quellbegriff → verbindliche Übersetzung. */
export interface GlossaryEntry {
  /** Begriff in der Ausgangssprache. */
  source: string;
  /** Verbindliche Übersetzung in der Zielsprache. */
  target: string;
  /** Art des Begriffs. */
  category: GlossaryCategory;
}

/** Ein Glossar-Verstoß: der Quellbegriff steht unübersetzt im Zieltext. */
export interface GlossaryViolation {
  /** Der definierte Quellbegriff. */
  source: string;
  /** Erwartete Übersetzung (target des Eintrags). */
  expected: string;
  /** Tatsächlich gefundener Text im Zieltext. */
  found: string;
  /** Startindex des Fundes im Zieltext. */
  position: number;
}

/** Ergebnis der Sprechstil-Prüfung. */
export interface VoiceConsistencyResult {
  /** true, wenn keine Stil-Divergenz erkannt wurde. */
  consistent: boolean;
  /** Menschlich lesbare Befunde (leer, wenn konsistent). */
  issues: string[];
}

// --- Hilfsfunktionen -----------------------------------------------------------

/** Bekannte Abkürzungen, die keinen Satz beenden (DE + EN). */
const ABBREVIATIONS = [
  "z.B.",
  "d.h.",
  "u.a.",
  "u.U.",
  "bzw.",
  "etc.",
  "usw.",
  "vgl.",
  "ggf.",
  "evtl.",
  "sog.",
  "bspw.",
  "ca.",
  "Nr.",
  "Abb.",
  "Bd.",
  "Kap.",
  "Dr.",
  "Prof.",
  "Mr.",
  "Mrs.",
  "Ms.",
  "St.",
  "vs.",
  "i.e.",
  "e.g.",
];

/** Escaped Regex-Sonderzeichen in einem Literal. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ersetzt Abkürzungen durch neutrale Platzhalter (ohne Satzzeichen), damit der
 * Satz-Splitter an „z.B.“ oder „e.g.“ nicht fälschlich trennt. Liefert die
 * Restore-Funktion für den Originaltext zurück.
 */
function maskAbbreviations(text: string): { masked: string; restore: (s: string) => string } {
  const originals: string[] = [];
  let masked = text;
  for (const abbr of ABBREVIATIONS) {
    // Wortgrenze über Unicode-Lookarounds (kein ASCII-`\b`, damit „List.“ das
    // „st.“ in „St.“ nicht maskiert).
    const pattern = `(?<![\\p{L}\\p{N}])${escapeRegExp(abbr)}(?![\\p{L}])`;
    let re: RegExp;
    try {
      re = new RegExp(pattern, "giu");
    } catch {
      continue;
    }
    masked = masked.replace(re, (match) => {
      const token = `\uE000${originals.length}\uE001`;
      originals.push(match);
      return token;
    });
  }
  const restore = (value: string): string =>
    value.replace(/\uE000(\d+)\uE001/g, (_m, idx: string) => originals[Number(idx)] ?? "");
  return { masked, restore };
}

/**
 * Zerlegt einen Text deterministisch in Sätze. Abkürzungen werden geschützt,
 * Whitespace wird normalisiert. Leerer/ungültiger Text → [].
 */
export function splitSentences(text: string): string[] {
  if (typeof text !== "string") return [];
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];

  const { masked, restore } = maskAbbreviations(trimmed);
  const parts =
    masked.match(/[^.!?…]+[.!?…]+(?:["»“”')\]]+)?|[^.!?…]+$/g) ?? [masked];

  return parts.map((part) => restore(part).trim()).filter((part) => part.length > 0);
}

/** Alle Fundstellen von `term` in `text` (case-insensitiv, wortgrenzenbewusst). */
function findOccurrences(text: string, term: string): number[] {
  const positions: number[] = [];
  if (!term) return positions;

  const escaped = escapeRegExp(term);
  const boundaryPattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
  let re: RegExp;
  try {
    re = new RegExp(boundaryPattern, "giu");
  } catch {
    re = new RegExp(escaped, "gi");
  }

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    positions.push(match.index);
    if (match.index === re.lastIndex) re.lastIndex += 1; // Zero-Length-Schutz
  }
  return positions;
}

// --- 1. alignDualText ----------------------------------------------------------

/**
 * Synchronisiert Original und Übersetzung satz- und absatzweise.
 *
 * Eingabe sind Absatz-Arrays (jedes Element ein Absatz). Jeder Absatz wird in
 * Sätze zerlegt und Satz für Satz gepaart. Fehlt auf einer Seite ein Satz,
 * bleibt das Feld leer (nichts geht verloren); überzählige Absätze einer Seite
 * werden ebenfalls als Segmente erhalten.
 */
export function alignDualText(original: string[], translation: string[]): AlignedSegment[] {
  const origParagraphs = Array.isArray(original) ? original : [];
  const transParagraphs = Array.isArray(translation) ? translation : [];
  const paragraphCount = Math.max(origParagraphs.length, transParagraphs.length);
  const segments: AlignedSegment[] = [];

  for (let p = 0; p < paragraphCount; p++) {
    const origPara = typeof origParagraphs[p] === "string" ? origParagraphs[p] : "";
    const transPara = typeof transParagraphs[p] === "string" ? transParagraphs[p] : "";
    const origSentences = splitSentences(origPara);
    const transSentences = splitSentences(transPara);
    const sentenceCount = Math.max(origSentences.length, transSentences.length, 1);

    for (let s = 0; s < sentenceCount; s++) {
      segments.push({
        id: `p${p + 1}-s${s + 1}`,
        original: origSentences[s] ?? "",
        translation: transSentences[s] ?? "",
        isParagraphBreak: s === 0,
      });
    }
  }
  return segments;
}

// --- 2. checkGlossaryCompliance ------------------------------------------------

/**
 * Prüft, ob die definierten Glossar-Begriffe korrekt übersetzt wurden.
 *
 * `text` ist der Zieltext. Für jeden Eintrag gilt: taucht der Quellbegriff
 * (case-insensitiv, wortgrenzenbewusst) im Zieltext auf, wurde er nicht
 * übersetzt → Verstoß mit erwarteter Übersetzung, gefundenem Text und Position.
 * Einträge ohne Quelle/Ziel sowie Einträge, bei denen Quelle und Ziel gleich
 * sind (Eigennamen), werden übersprungen.
 */
export function checkGlossaryCompliance(
  text: string,
  glossary: GlossaryEntry[],
): GlossaryViolation[] {
  if (typeof text !== "string" || text.length === 0) return [];
  if (!Array.isArray(glossary)) return [];

  const violations: GlossaryViolation[] = [];

  for (const entry of glossary) {
    if (!entry || typeof entry.source !== "string" || typeof entry.target !== "string") continue;
    const source = entry.source.trim();
    const target = entry.target.trim();
    if (!source || !target) continue;
    if (source.toLowerCase() === target.toLowerCase()) continue;

    for (const position of findOccurrences(text, source)) {
      violations.push({
        source,
        expected: target,
        found: text.slice(position, position + source.length),
        position,
      });
    }
  }

  violations.sort((a, b) => a.position - b.position || a.source.localeCompare(b.source));
  return violations;
}

// --- 3. checkVoiceConsistency --------------------------------------------------

interface VoiceMetrics {
  sentenceCount: number;
  wordCount: number;
  avgSentenceLength: number;
  exclamations: number;
  questions: number;
  ellipses: number;
  contractions: number;
  formalMarkers: number;
  informalMarkers: number;
}

/** Zählt Treffer eines Regex im Text (0 statt null). */
function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/** Berechnet deterministische Stil-Metriken eines Texts. */
function analyzeVoice(text: string): VoiceMetrics {
  const sentences = splitSentences(text);
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  const sentenceCount = sentences.length;
  const wordCount = words.length;

  return {
    sentenceCount,
    wordCount,
    avgSentenceLength: sentenceCount > 0 ? wordCount / sentenceCount : wordCount,
    exclamations: countMatches(text, /!/g),
    questions: countMatches(text, /\?/g),
    ellipses: countMatches(text, /…|\.\.\./g),
    contractions: countMatches(text, /\b[a-z]+['’](?:s|t|re|ve|ll|d|m)\b/gi),
    formalMarkers: countMatches(text, /\b(?:Sie|Ihnen|Ihre|Ihrem|Ihren|Ihrer|Ihres|Ihr)\b/g),
    informalMarkers: countMatches(
      text,
      /\b(?:du|dich|dir|dein|deine|deinem|deinen|deiner|deines|gonna|wanna|gotta|yeah|okay|yep|nope|ain't)\b/gi,
    ),
  };
}

/**
 * Prüft, ob der Sprechstil in der Zielsprache dem Original angemessen ist.
 *
 * Rein heuristisch und deterministisch (kein LLM): verglichen werden
 * Intensität (Ausrufe), Fragen, Pausen (Ellipsen), Satzrhythmus,
 * formelles/informelles Register, Kontraktionen sowie der Figurenname.
 */
export function checkVoiceConsistency(
  original: string,
  translation: string,
  character: string,
): VoiceConsistencyResult {
  const issues: string[] = [];
  const name = typeof character === "string" ? character.trim() : "";
  const who = name || "Figur";
  const orig = typeof original === "string" ? original : "";
  const trans = typeof translation === "string" ? translation : "";

  if (!orig.trim() && !trans.trim()) {
    return { consistent: true, issues: [] };
  }
  if (!trans.trim()) {
    return {
      consistent: false,
      issues: [`Übersetzung fehlt — Sprechstil von „${who}“ kann nicht geprüft werden.`],
    };
  }
  if (!orig.trim()) {
    return {
      consistent: false,
      issues: [`Original fehlt — kein Stil-Vergleich für „${who}“ möglich.`],
    };
  }

  const o = analyzeVoice(orig);
  const t = analyzeVoice(trans);

  // Intensität: Ausrufezeichen verloren oder künstlich hinzugefügt.
  if (o.exclamations >= 2 && t.exclamations === 0) {
    issues.push(`Ausrufezeichen gingen verloren — Intensität von „${who}“ wirkt reduziert.`);
  } else if (o.exclamations === 0 && t.exclamations >= 3) {
    issues.push(`Übersetzung wirkt lauter als das Original — Sprechstil von „${who}“ übertrieben.`);
  }

  // Fragende Haltung.
  if (o.questions >= 2 && t.questions === 0) {
    issues.push(`Fragende Haltung von „${who}“ fehlt in der Übersetzung.`);
  }

  // Pausen / Ellipsen.
  if (o.ellipses >= 1 && t.ellipses === 0) {
    issues.push(`Ellipsen/Pausen von „${who}“ fehlen in der Übersetzung.`);
  }

  // Satzrhythmus.
  if (o.avgSentenceLength > 0 && t.avgSentenceLength > 0) {
    const ratio =
      Math.max(o.avgSentenceLength, t.avgSentenceLength) /
      Math.min(o.avgSentenceLength, t.avgSentenceLength);
    if (ratio >= 1.8) {
      issues.push(
        `Satzlänge weicht stark ab (Ø ${o.avgSentenceLength.toFixed(1)} vs. ${t.avgSentenceLength.toFixed(1)} Wörter) — Rhythmus von „${who}“ verändert.`,
      );
    }
  }

  // Registerwechsel (formell ↔ informell).
  const origFormal = o.formalMarkers > o.informalMarkers;
  const origInformal = o.informalMarkers > o.formalMarkers;
  const transFormal = t.formalMarkers > t.informalMarkers;
  const transInformal = t.informalMarkers > t.formalMarkers;
  if (origFormal && transInformal) {
    issues.push(`Anrede wechselt von formell zu informell — Register von „${who}“ inkonsistent.`);
  } else if (origInformal && transFormal) {
    issues.push(`Anrede wechselt von informell zu formell — Register von „${who}“ inkonsistent.`);
  }

  // Kontraktionen bei formellem Original senken das Register.
  if (origFormal && t.contractions >= 2) {
    issues.push(`Kontraktionen senken das Register — passt nicht zum formellen Stil von „${who}“.`);
  }

  // Figurenname darf nicht verloren gehen.
  if (name && orig.includes(name) && !trans.includes(name)) {
    issues.push(`Figurenname „${name}“ fehlt in der Übersetzung.`);
  }

  return { consistent: issues.length === 0, issues };
}
