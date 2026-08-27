// Grundlage des Preflight-Regelwerks.
//
// Jede Regel hat eine stabile Kennung, damit Nutzerentscheidungen und
// Abschaltungen über App-Versionen hinweg gelten. Regelkennungen dürfen
// nie umbenannt werden — sonst verlieren Autoren ihre Entscheidungen.

import type {
  ExportFormat,
  PreflightCategory,
  PreflightSeverity,
  PreflightKind,
} from "@/types/preflight";
import { contentHash } from "@/services/knowledge/util";

/** Ein von einer Regel erzeugter Befund, vor der Speicherung. */
export interface RawFinding {
  ruleId: string;
  category: PreflightCategory;
  severity: PreflightSeverity;
  kind: PreflightKind;
  title: string;
  explanation: string;
  /** Konkreter Handlungsvorschlag. */
  recommendation: string | null;
  /** Textausschnitt, wenn der Befund eine Textstelle hat. */
  excerpt: string | null;
  /** Strukturhinweis, wenn kein Textausschnitt möglich ist. */
  structureHint: string | null;
  /** Formate, für die der Befund gilt. Leer = alle. */
  affectedFormats: ExportFormat[];
  chapterId: string | null;
  charStart: number | null;
  charEnd: number | null;
}

/** Ein Kapitel in der Form, die die Regeln brauchen. */
export interface ChapterInput {
  id: string;
  title: string;
  /** Reiner Text, aus TipTap extrahiert. */
  text: string;
  /** Rohes TipTap-JSON, für Prüfungen auf Formatierung. */
  raw: string;
  orderIndex: number;
  wordCount: number;
}

/** Eingabe für einen Prüflauf. */
export interface PreflightInput {
  projectId: string;
  projectName: string;
  chapters: ChapterInput[];
  /** Auf welche Formate geprüft wird. */
  formats: ExportFormat[];
  checkFrontmatter: boolean;
  checkBackmatter: boolean;
}

/** Signatur einer Prüfregel. */
export type RuleFn = (input: PreflightInput) => RawFinding[];

/**
 * Fingerabdruck eines Befunds.
 *
 * Bewusst OHNE Position und ohne Textausschnitt-Details: Verschiebt sich der
 * Text, bleibt der Befund derselbe, und die Entscheidung des Autors gilt
 * weiter. Regelkennung, Kapitel und Titel genügen zur Unterscheidung.
 */
export function fingerprint(f: RawFinding): string {
  return contentHash(
    [f.ruleId, f.chapterId ?? "project", f.title].join("\u0001"),
  );
}

/** Baut einen Befund mit Vorgabewerten. */
export function finding(partial: Partial<RawFinding> & Pick<RawFinding, "ruleId" | "category" | "severity" | "title" | "explanation">): RawFinding {
  return {
    kind: "possible",
    recommendation: null,
    excerpt: null,
    structureHint: null,
    affectedFormats: [],
    chapterId: null,
    charStart: null,
    charEnd: null,
    ...partial,
  };
}

/** Kurzer Ausschnitt um eine Position. */
export function excerptAround(text: string, start: number, end: number, pad = 45): string {
  const from = Math.max(0, start - pad);
  const to = Math.min(text.length, end + pad);
  return (
    (from > 0 ? "…" : "") +
    text.slice(from, to).replace(/\s+/g, " ").trim() +
    (to < text.length ? "…" : "")
  );
}

/** Sichtbare Darstellung eines Steuerzeichens. */
export function describeChar(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0;
  const hex = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  const names: Record<number, string> = {
    0x00a0: "geschütztes Leerzeichen",
    0x200a: "Haarspatium",
    0x200b: "Nullbreiten-Leerzeichen",
    0x200c: "Nullbreiten-Nichtverbinder",
    0x200d: "Nullbreiten-Verbinder",
    0x200e: "Links-nach-rechts-Markierung",
    0x200f: "Rechts-nach-links-Markierung",
    0x202f: "schmales geschütztes Leerzeichen",
    0x2060: "Wortverbinder",
    0xfeff: "Byte-Order-Markierung",
    0x00ad: "bedingter Trennstrich",
    0x2028: "Zeilentrenner",
    0x2029: "Absatztrenner",
    0x0009: "Tabulator",
    0x000b: "Vertikaltabulator",
    0x000c: "Seitenumbruch",
  };
  return names[cp] ? `${names[cp]} (${hex})` : hex;
}
