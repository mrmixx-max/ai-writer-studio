// Formatspezifische Prüfungen: DOCX, PDF, EPUB.
//
// Jede Regel meldet nur, wenn das betreffende Format auch geprüft wird.
// Der Sinn: Ein Autor, der nur EPUB exportiert, soll keine DOCX-Warnungen
// sehen — sonst geht der eine relevante Befund im Rauschen unter.

import { finding, excerptAround, type PreflightInput, type RawFinding } from "./rules-base";
import type { ExportFormat } from "@/types/preflight";

/** true, wenn dieses Format geprüft wird. */
function wants(input: PreflightInput, format: ExportFormat): boolean {
  return input.formats.includes(format);
}

/** Zählt Markierungen (bold, italic, …) im TipTap-Dokument. */
function countMarks(raw: string): Map<string, number> {
  const counts = new Map<string, number>();
  try {
    const doc = JSON.parse(raw) as {
      content?: Array<{ content?: Array<{ marks?: Array<{ type?: string }> }> }>;
    };
    for (const block of doc.content ?? []) {
      for (const span of block.content ?? []) {
        for (const mark of span.marks ?? []) {
          const t = mark.type ?? "unbekannt";
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
    }
  } catch {
    /* Ungültiges JSON — andere Regel meldet das. */
  }
  return counts;
}

// ---------------------------------------------------------------------------
//  DOCX
// ---------------------------------------------------------------------------

/**
 * DOCX: Fehlende Überschriften-Struktur.
 *
 * Word erzeugt sein Inhaltsverzeichnis aus Überschriften-Formatvorlagen.
 * Ein Kapitel ohne Überschrift im Dokument erscheint dort nicht.
 */
export function ruleDocxHeadings(input: PreflightInput): RawFinding[] {
  if (!wants(input, "docx")) return [];

  const without = input.chapters.filter((c) => {
    if (!c.text.trim()) return false;
    try {
      const doc = JSON.parse(c.raw) as { content?: Array<{ type?: string }> };
      return !(doc.content ?? []).some((n) => n.type === "heading");
    } catch {
      return false;
    }
  });

  if (without.length === 0) return [];

  return [
    finding({
      ruleId: "format.docx-no-heading",
      category: "format",
      severity: "warning",
      kind: "possible",
      title: `${without.length} Kapitel ohne Überschrift im Text`,
      explanation:
        "Word erzeugt das Inhaltsverzeichnis aus Überschriften-Formatvorlagen. " +
        "Kapitel, deren Text mit einem normalen Absatz beginnt, erscheinen " +
        "dort nicht — der Kapitelname aus der Seitenleiste zählt nicht mit.",
      recommendation:
        "Am Kapitelanfang eine Überschrift setzen (Strg+1 im Editor).",
      structureHint: `Betroffen: ${without.map((c) => c.title).slice(0, 5).join(", ")}`,
      affectedFormats: ["docx"],
      chapterId: without[0].id,
    }),
  ];
}

/**
 * DOCX: Übermäßige manuelle Formatierung.
 *
 * Viele einzelne Fett-/Kursiv-Markierungen deuten auf Formatierung von Hand
 * statt über Formatvorlagen hin. Beim Umformatieren des Buchblocks bricht das.
 */
export function ruleDocxManualFormatting(input: PreflightInput): RawFinding[] {
  if (!wants(input, "docx")) return [];

  const out: RawFinding[] = [];
  for (const c of input.chapters) {
    const marks = countMarks(c.raw);
    const total = [...marks.values()].reduce((a, b) => a + b, 0);
    if (total === 0 || c.wordCount === 0) continue;

    // Mehr als eine Markierung je 40 Wörter ist auffällig viel.
    const ratio = total / (c.wordCount / 40);
    if (ratio < 1) continue;

    const list = [...marks.entries()].map(([t, n]) => `${t} ×${n}`).join(", ");
    out.push(
      finding({
        ruleId: "format.docx-manual-formatting",
        category: "format",
        severity: "hint",
        kind: "possible",
        title: `Viel manuelle Formatierung in „${c.title}“`,
        explanation:
          `${total} Auszeichnungen auf ${c.wordCount} Wörter (${list}). ` +
          "Von Hand gesetzte Formatierung überlebt kein Umformatieren des " +
          "Buchblocks. Für wiederkehrende Auszeichnungen sind Formatvorlagen " +
          "der verlässlichere Weg.",
        recommendation:
          "Prüfen, ob die Auszeichnungen alle nötig sind. Betonung im " +
          "Fließtext wirkt sparsam eingesetzt stärker.",
        structureHint: list,
        affectedFormats: ["docx"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
//  PDF
// ---------------------------------------------------------------------------

/**
 * PDF: Sehr lange Absätze.
 *
 * PDF hat feste Seiten. Ein Absatz, der länger als eine Seite ist, lässt sich
 * nicht sauber umbrechen und erzeugt Hurenkinder oder halbleere Seiten.
 */
export function rulePdfLongParagraphs(input: PreflightInput): RawFinding[] {
  if (!wants(input, "pdf")) return [];

  const LIMIT = 400; // Wörter je Absatz, entspricht etwa 1,5 Seiten
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const paragraphs = c.text.split(/\n\s*\n/);
    const long = paragraphs
      .map((p, i) => ({ i, words: (p.match(/[\p{L}\p{N}]+/gu) ?? []).length, text: p }))
      .filter((p) => p.words > LIMIT);

    if (long.length === 0) continue;

    const idx = c.text.indexOf(long[0].text);
    out.push(
      finding({
        ruleId: "format.pdf-long-paragraph",
        category: "format",
        severity: "hint",
        kind: "possible",
        title: `${long.length} sehr lange Absätze in „${c.title}“`,
        explanation:
          `Der längste hat ${long[0].words} Wörter. PDF hat feste Seiten: ` +
          "Absätze über eine Seitenlänge erzeugen halbleere Seiten oder " +
          "einzelne Restzeilen am Seitenanfang.",
        recommendation: "Lange Absätze an einer inhaltlichen Zäsur teilen.",
        excerpt: idx >= 0 ? excerptAround(c.text, idx, idx + 60) : null,
        charStart: idx >= 0 ? idx : null,
        charEnd: idx >= 0 ? idx + 60 : null,
        affectedFormats: ["pdf"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

/**
 * PDF: Zeichen außerhalb der Standardschriften.
 *
 * Emoji und seltene Symbole fehlen in den Schriften, die PDF-Erzeuger
 * einbetten. Sie erscheinen dann als leeres Rechteck.
 */
export function rulePdfUnsupportedChars(input: PreflightInput): RawFinding[] {
  if (!wants(input, "pdf")) return [];

  // Emoji, Piktogramme, seltene Symbolbereiche.
  //
  // U+FE0F (Variantenselektor) steht bewusst NICHT in der Zeichenklasse:
  // Es ist ein Kombinationszeichen, das nur nach einem Basiszeichen
  // auftritt. In einer Klasse wäre es irreführend, weil es dort als
  // eigenständiges Zeichen behandelt würde.
  const RISKY = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]\u{FE0F}?/gu;
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const found = [...new Set(c.text.match(RISKY) ?? [])];
    if (found.length === 0) continue;

    const idx = c.text.search(RISKY);
    out.push(
      finding({
        ruleId: "format.pdf-unsupported-chars",
        category: "format",
        severity: "warning",
        kind: "possible",
        title: `${found.length} Sonderzeichen in „${c.title}“, die im PDF fehlen können`,
        explanation:
          `Gefunden: ${found.slice(0, 10).join(" ")}. Standardschriften in ` +
          "PDF-Dateien enthalten keine Emoji. Die Zeichen erscheinen dann als " +
          "leeres Rechteck.",
        recommendation:
          "Zeichen durch Text ersetzen, oder für den Druck eine Ausgabe ohne " +
          "diese Stellen erzeugen.",
        excerpt: idx >= 0 ? excerptAround(c.text, idx, idx + 2) : null,
        structureHint: found.slice(0, 20).join(" "),
        charStart: idx >= 0 ? idx : null,
        charEnd: idx >= 0 ? idx + 2 : null,
        affectedFormats: ["pdf"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
//  EPUB
// ---------------------------------------------------------------------------

/**
 * EPUB: Ein einzelnes Kapitel für das ganze Buch.
 *
 * EPUB-Lesegeräte laden ein Kapitel als Einheit und nutzen es für die
 * Navigation. Ein Buch aus einem Kapitel hat keine Navigation.
 */
export function ruleEpubSingleChapter(input: PreflightInput): RawFinding[] {
  if (!wants(input, "epub")) return [];
  if (input.chapters.length !== 1) return [];

  const only = input.chapters[0];
  if (only.wordCount < 5000) return []; // Kurztext ist unproblematisch.

  return [
    finding({
      ruleId: "format.epub-single-chapter",
      category: "format",
      severity: "warning",
      kind: "possible",
      title: "Das ganze Buch steht in einem Kapitel",
      explanation:
        `Ein Kapitel mit ${only.wordCount.toLocaleString("de-DE")} Wörtern. ` +
        "EPUB-Lesegeräte laden ein Kapitel vollständig in den Speicher und " +
        "erzeugen die Navigation daraus. Ohne Kapitelteilung kann der Leser " +
        "nicht springen, und ältere Lesegeräte werden träge.",
      recommendation: "In Kapitel teilen — auch grob nach Abschnitten hilft.",
      structureHint: `1 Kapitel, ${only.wordCount.toLocaleString("de-DE")} Wörter`,
      affectedFormats: ["epub"],
      chapterId: only.id,
    }),
  ];
}

/**
 * EPUB: Bildverweise ohne Alternativtext.
 *
 * EPUB-Prüfprogramme (epubcheck) beanstanden Bilder ohne Alternativtext,
 * und KDP weist Dateien mit solchen Fehlern gelegentlich zurück.
 */
export function ruleEpubImages(input: PreflightInput): RawFinding[] {
  if (!wants(input, "epub")) return [];

  const out: RawFinding[] = [];
  for (const c of input.chapters) {
    let missing = 0;
    let total = 0;
    try {
      const doc = JSON.parse(c.raw) as {
        content?: Array<{ type?: string; attrs?: { alt?: string | null } }>;
      };
      for (const node of doc.content ?? []) {
        if (node.type !== "image") continue;
        total++;
        if (!node.attrs?.alt?.trim()) missing++;
      }
    } catch {
      continue;
    }
    if (missing === 0) continue;

    out.push(
      finding({
        ruleId: "format.epub-image-alt",
        category: "format",
        severity: "warning",
        kind: "possible",
        title: `${missing} von ${total} Bildern ohne Alternativtext in „${c.title}“`,
        explanation:
          "Das Prüfprogramm epubcheck beanstandet Bilder ohne Alternativtext. " +
          "KDP weist Dateien mit solchen Fehlern gelegentlich zurück. " +
          "Bildschirmleser können das Bild ohne Alternativtext nicht wiedergeben.",
        recommendation: "Jedem Bild eine kurze Beschreibung geben.",
        structureHint: `${missing} von ${total} Bildern betroffen`,
        affectedFormats: ["epub"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Markdown
// ---------------------------------------------------------------------------

/**
 * Markdown: Rohe Markdown-Zeichen im Text.
 *
 * Wer im Editor Sternchen oder Unterstriche tippt, erzeugt beim
 * Markdown-Export unbeabsichtigte Auszeichnung: aus *wichtig* wird kursiv,
 * aus einem Sternchen-Trenner eine Liste.
 */
export function ruleMarkdownRawSyntax(input: PreflightInput): RawFinding[] {
  if (!wants(input, "md")) return [];

  // Zeichen, die Markdown deutet. Der Szenentrenner * * * ist ausgenommen,
  // weil er eine bewusste Gestaltungsentscheidung ist.
  const PATTERNS: Array<{ re: RegExp; what: string }> = [
    { re: /(?<!\*)\*(?!\s|\*)[^\n*]{1,60}\*(?!\*)/, what: "*Text* wird kursiv" },
    { re: /_(?!\s)[^\n_]{1,60}_/, what: "_Text_ wird kursiv" },
    { re: /^#{1,6}\s/m, what: "# am Zeilenanfang wird Überschrift" },
    { re: /^\s*[-+]\s+\S/m, what: "- am Zeilenanfang wird Liste" },
    { re: /`[^\n`]{1,60}`/, what: "`Text` wird Code" },
    { re: /^\s*>\s+\S/m, what: "> am Zeilenanfang wird Zitat" },
  ];

  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const hits: string[] = [];
    let firstIdx = -1;

    for (const p of PATTERNS) {
      const m = p.re.exec(c.text);
      if (!m) continue;
      hits.push(p.what);
      if (firstIdx < 0) firstIdx = m.index;
    }
    if (hits.length === 0) continue;

    out.push(
      finding({
        ruleId: "format.md-raw-syntax",
        category: "format",
        severity: "hint",
        kind: "possible",
        title: `Markdown-Zeichen im Text von „${c.title}“`,
        explanation:
          `Gefunden: ${hits.join("; ")}. Beim Markdown-Export deutet der ` +
          "Empfänger diese Zeichen als Auszeichnung. Aus einem gemeinten " +
          "Sternchen wird dann Kursivschrift.",
        recommendation:
          "Zeichen mit einem umgekehrten Schrägstrich schützen, oder die " +
          "Auszeichnung über die Editor-Werkzeuge setzen statt zu tippen.",
        excerpt: firstIdx >= 0 ? excerptAround(c.text, firstIdx, firstIdx + 30) : null,
        structureHint: hits.join("; "),
        charStart: firstIdx >= 0 ? firstIdx : null,
        charEnd: firstIdx >= 0 ? firstIdx + 30 : null,
        affectedFormats: ["md"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

/**
 * Markdown: Auszeichnung, die beim Export verloren geht.
 *
 * Markdown kennt fett und kursiv, aber kein Unterstreichen, keine
 * Textfarbe und keine Durchstreichung im Standardumfang.
 */
export function ruleMarkdownLossyMarks(input: PreflightInput): RawFinding[] {
  if (!wants(input, "md")) return [];

  const LOSSY = new Set(["underline", "highlight", "textStyle", "color", "subscript", "superscript"]);
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const marks = countMarks(c.raw);
    const lossy = [...marks.entries()].filter(([t]) => LOSSY.has(t));
    if (lossy.length === 0) continue;

    const list = lossy.map(([t, n]) => `${t} ×${n}`).join(", ");
    out.push(
      finding({
        ruleId: "format.md-lossy-marks",
        category: "format",
        severity: "hint",
        kind: "possible",
        title: `Auszeichnung in „${c.title}“, die Markdown nicht kennt`,
        explanation:
          `Betroffen: ${list}. Markdown kennt im Standardumfang nur fett und ` +
          "kursiv. Unterstreichen, Farben und Hoch-/Tiefstellung fallen beim " +
          "Export weg — ohne Meldung.",
        recommendation:
          "Für Markdown-Ausgabe auf fett und kursiv beschränken, oder ein " +
          "anderes Format wählen.",
        structureHint: list,
        affectedFormats: ["md"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
//  TXT
// ---------------------------------------------------------------------------

/**
 * TXT: Informationsverlust.
 *
 * Reiner Text kennt keine Formatierung. Das ist keine Warnung im engeren
 * Sinne, sondern eine Feststellung — aber der Autor muss sie kennen, bevor
 * er das Ergebnis für ein fertiges Manuskript hält.
 */
export function ruleTxtInformationLoss(input: PreflightInput): RawFinding[] {
  if (!wants(input, "txt")) return [];

  // Zusammenzählen, was verloren geht.
  let marks = 0;
  let headings = 0;
  let images = 0;

  for (const c of input.chapters) {
    marks += [...countMarks(c.raw).values()].reduce((a, b) => a + b, 0);
    try {
      const doc = JSON.parse(c.raw) as { content?: Array<{ type?: string }> };
      for (const n of doc.content ?? []) {
        if (n.type === "heading") headings++;
        if (n.type === "image") images++;
      }
    } catch {
      /* ignorieren */
    }
  }

  if (marks === 0 && images === 0) {
    // Ohne Formatierung und Bilder gibt es nichts zu verlieren.
    return [];
  }

  const parts: string[] = [];
  if (marks > 0) parts.push(`${marks} Auszeichnungen (fett, kursiv, …)`);
  if (headings > 0) parts.push(`${headings} Überschriften werden zu normalen Zeilen`);
  if (images > 0) parts.push(`${images} Bilder fallen ganz weg`);

  return [
    finding({
      ruleId: "format.txt-information-loss",
      category: "format",
      severity: "hint",
      kind: "possible",
      title: "Reiner Text verliert alle Formatierung",
      explanation:
        `Beim Export als TXT geht verloren: ${parts.join("; ")}. Das ist ` +
        "keine Fehlfunktion, sondern die Eigenart des Formats. Für ein " +
        "abgabefertiges Manuskript ist TXT nur geeignet, wenn der Empfänger " +
        "es ausdrücklich verlangt.",
      recommendation:
        "Für Manuskriptabgabe DOCX wählen, für Veröffentlichung EPUB. TXT " +
        "eignet sich für Sicherungskopien und Textanalyse.",
      structureHint: parts.join("; "),
      affectedFormats: ["txt"],
    }),
  ];
}

/** Alle formatspezifischen Regeln. */
export const FORMAT_RULES = [
  ruleDocxHeadings,
  ruleDocxManualFormatting,
  rulePdfLongParagraphs,
  rulePdfUnsupportedChars,
  ruleEpubSingleChapter,
  ruleEpubImages,
  ruleMarkdownRawSyntax,
  ruleMarkdownLossyMarks,
  ruleTxtInformationLoss,
];
