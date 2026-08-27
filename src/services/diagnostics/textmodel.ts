// Textzerlegung für die Manuskriptprüfung.
//
// Grundlage aller regelbasierten Prüfungen: Ein Manuskript wird in Sätze,
// Absätze und Dialogzeilen zerlegt, mit Positionsangaben, damit jeder Befund
// zur Textstelle zurückführt.
//
// Bewusst ohne Bibliothek: Deutsche Satzgrenzen sind der schwierige Teil, und
// den löst chunking.ts schon. Diese Datei baut darauf auf.

import { splitSentences } from "@/services/knowledge/chunking";

/** Ein Satz mit seiner Position im Gesamttext. */
export interface Sentence {
  text: string;
  /** Zeichenoffset im Gesamttext. */
  start: number;
  end: number;
  /** Index des Absatzes, zu dem der Satz gehört. */
  paragraphIndex: number;
  /** Wortanzahl. */
  words: number;
  /** true, wenn der Satz überwiegend wörtliche Rede ist. */
  isDialogue: boolean;
}

/** Ein Absatz mit Position. */
export interface Paragraph {
  text: string;
  start: number;
  end: number;
  index: number;
  /** Überschrift, unter der dieser Absatz steht. */
  heading: string | null;
  isHeading: boolean;
}

/** Vollständig zerlegter Text. */
export interface AnalyzedText {
  raw: string;
  paragraphs: Paragraph[];
  sentences: Sentence[];
  wordCount: number;
}

/**
 * Erkennt wörtliche Rede.
 * Deutsche Anführungszeichen („…"), typografische („…") und geradlinige ("…")
 * werden gleich behandelt. Auch der Gedankenstrich-Dialog wird erfasst.
 */
export function looksLikeDialogue(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // Anführungszeichen am Anfang oder mehr als ein Paar im Satz.
  if (/^[„"»«]/.test(t)) return true;
  if (/^[-–—]\s+\p{Lu}/u.test(t)) return true;
  const quotes = (t.match(/[„""»«"]/g) ?? []).length;
  return quotes >= 2;
}

/** Zählt Wörter. Bindestrich-Komposita gelten als ein Wort. */
export function countWords(s: string): number {
  const m = s.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

/**
 * Zerlegt einen Plaintext in Absätze und Sätze mit Positionsangaben.
 *
 * Die Positionen sind Offsets im übergebenen Text. Sie erlauben der
 * Oberfläche, zur Fundstelle zu springen.
 */
export function analyzeText(raw: string): AnalyzedText {
  const paragraphs: Paragraph[] = [];
  const sentences: Sentence[] = [];

  // Absätze an Leerzeilen oder einfachen Zeilenumbrüchen trennen.
  const parts = raw.split(/\n{2,}|\r\n{2,}/);
  let cursor = 0;
  let currentHeading: string | null = null;

  for (const part of parts) {
    // Position im Originaltext finden — nicht raten, sondern suchen.
    const idx = raw.indexOf(part, cursor);
    const start = idx >= 0 ? idx : cursor;
    const end = start + part.length;
    cursor = end;

    const text = part.trim();
    if (!text) continue;

    // Heuristik für Überschriften: kurz, kein Satzende, keine Rede.
    const isHeading =
      text.length <= 80 &&
      !/[.!?…]$/.test(text) &&
      !looksLikeDialogue(text) &&
      countWords(text) <= 12;

    if (isHeading) currentHeading = text;

    const pIndex = paragraphs.length;
    paragraphs.push({
      text,
      start,
      end,
      index: pIndex,
      heading: isHeading ? null : currentHeading,
      isHeading,
    });

    if (isHeading) continue;

    // Sätze innerhalb des Absatzes.
    let sCursor = start;
    for (const sent of splitSentences(text)) {
      const sIdx = raw.indexOf(sent, sCursor);
      const sStart = sIdx >= 0 ? sIdx : sCursor;
      const sEnd = sStart + sent.length;
      sCursor = sEnd;

      sentences.push({
        text: sent,
        start: sStart,
        end: sEnd,
        paragraphIndex: pIndex,
        words: countWords(sent),
        isDialogue: looksLikeDialogue(sent),
      });
    }
  }

  return {
    raw,
    paragraphs,
    sentences,
    wordCount: countWords(raw),
  };
}

/** Kurzer Ausschnitt um eine Position, für die Befundanzeige. */
export function excerptAt(raw: string, start: number, end: number, pad = 40): string {
  const from = Math.max(0, start - pad);
  const to = Math.min(raw.length, end + pad);
  const prefix = from > 0 ? "…" : "";
  const suffix = to < raw.length ? "…" : "";
  return prefix + raw.slice(from, to).replace(/\s+/g, " ").trim() + suffix;
}
