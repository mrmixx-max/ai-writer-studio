// Markup-Guard: Schutz von Markdown/HTML-Markup während der LLM-Übersetzung.
//
// Strategie (übersetzungssicher):
//  1. maskMarkup: Markup-Elemente werden in reine Text-Platzhalter der Form
//     ⟦M01⟧ ersetzt — Modelle behandeln sie wie unveränderliche Tokens und
//     geben sie meist unverändert zurück.
//  2. restoreMarkup: Zwei-Ebenen-Restaurierung:
//     (a) Platzhalter in der Modell-Antwort → Original-Markup
//     (b) Für verlorene Platzhalter: Markup-Konstrukte werden am passenden
//         Ort erneut eingefügt, wo es deterministisch sicher ist (Headings
//         als Zeilen-Präfix; Inline-Paare nur, wenn beide Seiten fehlen —
//         sonst riskiert man korrupte Verschachtelung).
//  3. markupIntact(): Differenz-Score zwischen Original- und Ziel-Markup.

/** Platzhalter-Token-Bausteine: ⟦M12⟧ — Klammern + ASCII-Ziffern. */
const PH_OPEN = "⟦M";
const PH_CLOSE = "⟧";

export interface MaskResult {
  /** Text mit Platzhaltern statt Markup (für den LLM-Prompt). */
  masked: string;
  /** Alle vergebenen Platzhalter (in Reihenfolge). */
  placeholders: string[];
  /** Platzhalter-Index → Original-Markup-Span. */
  spans: MaskedSpan[];
}

export interface MaskedSpan {
  index: number;
  placeholder: string;
  /** Original-Textausschnitt inkl. Markup. */
  original: string;
  /** Wie der Platzhalter im maskierten Text eingebettet war. */
  kind: "block" | "inline";
  /** Zeilen-/Blockstruktur-Information zur sicheren Wiederherstellung. */
  linePrefix?: string;
}

// --- Markdown/HTML-Erkennung --------------------------------------------------

/** Maskierbare Markdown-/HTML-Bausteine, zeilenweise zuerst (Block-Ebene). */
const BLOCK_RULES: Array<{ re: RegExp; kind: "block" }> = [
  // HTML-Kommentare
  { re: /<!--[\s\S]*?-->/g, kind: "block" },
  // HTML-Block-Tags inkl. Inhalt (nicht-gierig, mehrzeilig für pre/div)
  { re: /<(p|div|pre|blockquote|table|ul|ol|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi, kind: "block" },
];

/** Inline-Markup: einzelne Tags, Formatierungen, Links, Entities. */
const INLINE_RULES: RegExp[] = [
  /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\/?>/g, // einzelne HTML-Tags
  /&[a-zA-Z#0-9]+;/g, // HTML-Entities
  /!\[[^\]]*\]\([^)]*\)/g, // Bilder
  /\[[^\]]*\]\([^)]*\)/g, // Links
  /\*\*[^*\n]+\*\*/g, // Bold
  /__[^_\n]+__/g, // Bold alt
  /(?<![\w*])\*[^*\n]+\*(?![\w*])/g, // Italic
  /(?<![\w_])_[^_\n]+_(?![\w_])/g, // Italic alt
  /`[^`\n]+`/g, // Inline-Code
  /^#{1,6}\s.*$/gm, // ATX-Headings (ganze Zeile)
];

/**
 * Maskiert Markup im Quelltext. Headings werden als Ganzes (inkl. #-Präfix)
 * ersetzt; der Zeilenumbruch-Text bleibt als Übersetzungsgrundlage erhalten —
 * nur das Präfix wandert in den Platzhalter.
 */
export function maskMarkup(source: string): MaskResult {
  const spans: MaskedSpan[] = [];
  let counter = 0;
  const nextPlaceholder = (): string => {
    counter += 1;
    return `${PH_OPEN}${String(counter).padStart(2, "0")}${PH_CLOSE}`;
  };

  let text = source;

  const applyRule = (re: RegExp, wholeLine: boolean): void => {
    text = text.replace(re, (match) => {
      // Bereits maskierte Bereiche nicht doppelt behandeln.
      if (match.includes(PH_OPEN)) return match;
      const ph = nextPlaceholder();
      spans.push({
        index: counter,
        placeholder: ph,
        original: match,
        kind: wholeLine ? "block" : "inline",
      });
      return ph;
    });
  };

  // 1) Block-Konstrukte zuerst (größte Spannen).
  for (const rule of BLOCK_RULES) applyRule(rule.re, true);

  // 2) Headings: NUR das "# "-Präfix maskieren (original-getreu, ohne
  //    angehängten Whitespace) — der Heading-Text bleibt übersetzbar.
  text = text.replace(/^(\s*)(#{1,6})(\s+)/gm, (_m, indent: string, hashes: string) => {
    const ph = nextPlaceholder();
    spans.push({
      index: counter,
      placeholder: ph,
      original: `${indent}${hashes} `,
      kind: "block",
      linePrefix: indent,
    });
    return `${indent}${ph}`;
  });

  // 3) Inline-Markup.
  for (const re of INLINE_RULES) {
    if (re.source.startsWith("^")) continue; // Headings bereits behandelt
    applyRule(new RegExp(re.source, re.flags), false);
  }

  // 4) List-Marker & Zitat-Präfixe („- ", „1. ", „> ").
  text = text.replace(/^(\s*)([-*+]|\d+\.)\s/gm, (_m, indent: string, marker: string) => {
    const ph = nextPlaceholder();
    spans.push({
      index: counter,
      placeholder: ph,
      original: `${indent}${marker} `,
      kind: "block",
      linePrefix: indent,
    });
    return `${indent}${ph}`;
  });
  text = text.replace(/^(\s*)>\s?/gm, (_m, indent: string) => {
    const ph = nextPlaceholder();
    spans.push({
      index: counter,
      placeholder: ph,
      original: `${indent}> `,
      kind: "block",
      linePrefix: indent,
    });
    return `${indent}${ph}`;
  });

  return { masked: text, placeholders: spans.map((s) => s.placeholder), spans };
}

/**
 * Restauriert Markup: Platzhalter aus der Modell-Antwort werden ersetzt;
 * verlorene Block-Marker (Heading/List/Quote-Präfixe) werden deterministisch
 * aus dem Original zurückgesetzt.
 *
 * @param original    ursprünglicher Kapiteltext (mit Markup)
 * @param translated  übersetzter Text (Platzhalter evtl. teils verloren)
 * @param masked      maskierter Quelltext (aus maskMarkup)
 */
export function restoreMarkup(original: string, translated: string, masked: string): string {
  const { spans } = maskMarkup(original);
  void masked;
  let out = translated;

  // (a) Überlebende Platzhalter → Original-Markup.
  for (const span of spans) {
    if (out.includes(span.placeholder)) {
      out = out.split(span.placeholder).join(span.original);
    }
  }

  // (b) Verlorene Block-Präfixe (Headings/Listmarker/Quotes) ergänzen.
  out = restoreBlockPrefixes(original, masked, out);

  return out;
}

/**
 * Ergänzt verlorene Block-Präfixe (#, -, >): Zeilen des übersetzten Texts,
 * die im maskierten Original mit einem Block-Platzhalter begannen, erhalten
 * ihr Präfix aus dem Original zurück.
 */
function restoreBlockPrefixes(original: string, masked: string, translated: string): string {
  const maskedLines = masked.split("\n");
  const translatedLines = translated.split("\n");
  if (maskedLines.length !== translatedLines.length) {
    // Zeilenzahl weicht ab (Modell hat Umbrüche geändert) — kein sicherer
    // Zeilen-Match möglich. Inline-Restaurierung reicht hier.
    return translated;
  }
  const origLines = original.split("\n");
  return translatedLines
    .map((line, i) => {
      const mLine = maskedLines[i];
      const m = mLine.match(/^(\s*)(⟦M\d+⟧)/);
      if (!m) return line;
      // Bereits restauriert (Platzhalter hat überlebt und trägt sein Markup)?
      if (/^\s*(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s?)/.test(line)) return line;
      // Original-Präfix der gleichen Zeile ermitteln.
      const orig = origLines[i] ?? "";
      const prefixMatch = orig.match(/^(\s*)(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s?)/);
      if (!prefixMatch) return line;
      // Präfix ergänzen — Whitespace des übersetzten Texts respektieren.
      return line.replace(/^(\s*)/, (_s, ws: string) =>
        prefixMatch[0].replace(/^(\s*)/, ws || ""),
      );
    })
    .join("\n");
}

/**
 * Prüft, ob das Markup des übersetzten Texts dem Original entspricht
 * (Headings/Bold/Links/Tags-Anzahl als grobe Struktur-Statistik).
 */
export function markupIntact(original: string, translated: string): boolean {
  const profile = (s: string): Record<string, number> => ({
    headings: (s.match(/^#{1,6}\s/gm) ?? []).length,
    bold: (s.match(/\*\*[^*\n]+\*\*/g) ?? []).length,
    links: (s.match(/\[[^\]]*\]\([^)]*\)/g) ?? []).length,
    tags: (s.match(/<\/?[a-zA-Z][^>]*>/g) ?? []).length,
    listItems: (s.match(/^\s*([-*+]|\d+\.)\s/gm) ?? []).length,
  });
  const a = profile(original);
  const b = profile(translated);
  return (
    a.headings === b.headings &&
    a.bold === b.bold &&
    a.links === b.links &&
    a.tags === b.tags &&
    a.listItems === b.listItems
  );
}
