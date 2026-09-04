// Testbuch-Fixture (C4): 8 Kapitel mit TipTap-JSON-Inhalten, gemischten
// Status (draft/completed/needs_revision) und typografischen Fallstricken
// (gerade Anführungszeichen, " - ", doppelte Leerzeichen) für die
// Normalisierungs-Assertions.
//
// Wird von BookWriterPanel-Export-Tests und export/*.test.ts konsumiert.

import type { BookChapterInput } from "./export/types";

function tipTapDoc(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((t) => ({
      type: "paragraph",
      content: [{ type: "text", text: t }],
    })),
  });
}

/** Ein Kapitel-Paragraph mit etwas Inhalt. */
function para(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

const CHAPTER_TITLES = [
  "Grundlagen der KI",
  "Maschinelles Lernen",
  "Neuronale Netze",
  "Sprachmodelle",
  "Bilderkennung",
  "Robotik und Automatisierung",
  "Ethik und Gesellschaft",
  "Ausblick und Praxis",
];

/** Kapiteltext mit typografischen Fallstricken (bewusst "falsch" gesetzt). */
function chapterText(n: number): string[] {
  return [
    `Kapitel ${n} eroeffnet das Thema mit einem "praxisnahen" Beispiel - und zeigt,  wie es weitergeht.`,
    `Der zweite Absatz vertieft die Grundlagen von Kapitel ${n} mit Zahlen und Fakten.`,
  ];
}

/**
 * 8-Kapitel-Testbuch. Status-Verteilung: 3 completed, 3 draft, 2 needs_revision
 * (Kapitel 4 und 7) — deckt Export-Gate und Warnung ab.
 */
export function makeTestBook(): {
  title: string;
  author: string;
  language: string;
  chapters: BookChapterInput[];
} {
  const chapters: BookChapterInput[] = CHAPTER_TITLES.map((title, i) => {
    const num = i + 1;
    const status =
      num === 4 || num === 7 ? "needs_revision" : num <= 3 ? "completed" : "draft";
    return {
      number: num,
      title,
      content: tipTapDoc(chapterText(num)),
      status,
    };
  });
  return {
    title: "Testbuch: KI verstehen",
    author: "Testautor",
    language: "de",
    chapters,
  };
}

/** Roher (untypografisierter) Kapiteltext, für Assertions. */
export { para, CHAPTER_TITLES };