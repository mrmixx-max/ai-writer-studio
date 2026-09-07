// Bilingual-Book-Engine (Sprint 15, Agent 1): DE→EN-Übersetzung von
// Kapitel-Inhalten und Gliederungen.
//
// Baut auf bestehender Infrastruktur auf (keine Duplikate):
//  - markupGuard.ts: maskMarkup / restoreMarkup (⟦M##⟧-Platzhalter) —
//    Markdown/HTML-Markup überlebt die Übersetzung unverändert.
//  - translatorService.ts: TranslationChapter-Typ (wiederverwendet).
//  - @/types/bookwriter: BookOutline / OutlineChapter.
//
// Der LLM-Call ist über eine injizierbare `CompleteFn` abstrahiert
// (Ollama-Pattern: ein Prompt rein, ein String raus — in Produktion an
// OllamaProvider.chat verdrahtet, in Tests durch Fake-Funktionen ersetzt):
//
//   const complete: CompleteFn = async (prompt) => {
//     let out = "";
//     for await (const chunk of ollama.chat([{ role: "user", content: prompt }], { model }))
//       out += chunk;
//     return out;
//   };
//
// WICHTIG: Dieses Modul exportiert bewusst ein eigenes `translateChapter`
// mit schlanker Signatur (Kapitel, Zielsprache, CompleteFn) → String.
// Es wird NICHT über bookwriter/index.ts re-exportiert, weil dort bereits
// ein `translateChapter` aus translatorService.ts (andere Signatur) liegt.

import { maskMarkup, restoreMarkup } from "./markupGuard";
import type { TranslationChapter } from "./translatorService";
import type { BookOutline, OutlineChapter } from "@/types/bookwriter";

/** Unterstützte Zielsprachen der Engine. */
export type BilingualTargetLang = "de" | "en";

/** Ergebnis der Spracherkennung. */
export type DetectedLang = "de" | "en" | "other";

/**
 * Injizierbare Completion-Funktion (Ollama-Pattern): nimmt einen Prompt,
 * liefert die vollständige Antwort. In Tests gemockt.
 */
export type CompleteFn = (prompt: string) => Promise<string>;

const LANG_LABEL: Record<BilingualTargetLang, string> = {
  de: "Deutsch",
  en: "Englisch",
};

// --- Spracherkennung -----------------------------------------------------------

/** Deutsche Stoppwörter für die Heuristik (ohne Umlaute/ß). */
const DE_STOP = new Set(
  "der die das und ist ein eine einer einem einen nicht mit den dem von zu zum zur auf fuer sich auch als im des dass es er sie wir ihr ich du wird wurden haben hat war waren sind oder aber noch schon nur man aus bei nach ueber durch kann dieser diese dieses denn doch wenn dann da hier alle einem".split(
    " ",
  ),
);

/** Englische Stoppwörter für die Heuristik. */
const EN_STOP = new Set(
  "the and is of to in that it with for you he she we they this not as on are was were be have has had will would can from by at or but an his her their our your which who what when there been more than were".split(
    " ",
  ),
);

/**
 * Erkennt grob die Sprache eines Texts.
 *
 * Heuristik (deutsch zuerst, per Spezifikation):
 *  1. Leerer Text → "other".
 *  2. Sehr kurze Texte (< 3 Wörter): nur ein starkes Signal (ß/ä/ö/ü/Ä/Ö/Ü)
 *     zählt → "de", sonst "other" (kein Raten).
 *  3. ß/ä/ö/ü-Dichte ≥ 0,5 % → "de" (für Englisch praktisch unerreichbar).
 *  4. Sonst Stoppwort-Vergleich: strikte Mehrheit gewinnt, Gleichstand oder
 *     keine Treffer → "other".
 */
export function detectLanguage(text: string): DetectedLang {
  const trimmed = text.trim();
  if (!trimmed) return "other";

  // Starkes deutsches Signal: ß oder Umlaute.
  const umlautHits = (trimmed.match(/[ßäöüÄÖÜ]/g) ?? []).length;

  const words = trimmed.toLowerCase().match(/[a-zäöüß]+/gu) ?? [];
  if (words.length < 3) {
    return umlautHits > 0 ? "de" : "other";
  }

  if (umlautHits / trimmed.length >= 0.005) return "de";

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  let de = 0;
  let en = 0;
  for (const [w, n] of freq) {
    if (DE_STOP.has(w)) de += n;
    if (EN_STOP.has(w)) en += n;
  }
  if (de === 0 && en === 0) return "other";
  if (de === en) return "other";
  return de > en ? "de" : "en";
}

// --- Übersetzung -----------------------------------------------------------------

/**
 * Baut den Übersetzungs-Prompt (maskierter Text, Markup-Schutzregeln).
 * Exponiert für Tests.
 */
export function buildBilingualPrompt(
  maskedText: string,
  targetLang: BilingualTargetLang,
  sourceLang: string = "Deutsch",
): string {
  return (
    `Übersetze den folgenden Buchtext von ${sourceLang} nach ${LANG_LABEL[targetLang]}.\n` +
    `\nREGELN:\n` +
    `1. Übersetze NUR den freien Text.\n` +
    `2. Token der Form ⟦M##⟧ (z.B. ⟦M01⟧) sind geschützte Markup-Platzhalter — kopiere sie ZEICHENGENAU an ihre Position, füge nichts ein, lösche nichts.\n` +
    `3. Behalte Absatz- und Zeilenstruktur exakt bei.\n` +
    `4. Keine Erklärungen, keine Anmerkungen — nur der übersetzte Text.\n` +
    `\nTEXT:\n${maskedText}`
  );
}

/**
 * Übersetzt einen freien Textabschnitt mit Markup-Erhaltung:
 * maskieren → complete → restaurieren. Leere Abschnitte geben "" zurück,
 * ohne den Provider zu rufen.
 */
async function translateText(
  text: string,
  targetLang: BilingualTargetLang,
  complete: CompleteFn,
): Promise<string> {
  if (!text.trim()) return text;
  const { masked } = maskMarkup(text);
  const sourceLabel = LANG_LABEL[detectLanguage(text) === "en" ? "en" : "de"];
  const raw = (await complete(buildBilingualPrompt(masked, targetLang, sourceLabel))).trim();
  if (!raw) return text;
  return restoreMarkup(text, raw, masked);
}

/**
 * Übersetzt den Inhalt eines Kapitels (DE→EN bzw. in `targetLang`).
 * Markup (Markdown/HTML) bleibt durch Maskierung erhalten.
 *
 * @returns Übersetzter Kapitel-Inhalt (Titel unverändert — siehe translateOutline
 *   für Gliederungs-Titel, bzw. translatorService für Titel+Inhalt-Paare).
 */
export async function translateChapter(
  chapter: TranslationChapter,
  targetLang: BilingualTargetLang,
  complete: CompleteFn,
): Promise<string> {
  if (!chapter.content.trim()) return chapter.content;
  // Bereits in der Zielsprache → No-op ohne Provider-Call.
  const detected = detectLanguage(chapter.content);
  if (detected === targetLang) return chapter.content;
  return translateText(chapter.content, targetLang, complete);
}

/**
 * Übersetzt eine Gliederung in `targetLang`: pro Kapitel werden die
 * Freitext-Felder (title, goal, conflict, outcome, pov, subchapters)
 * übersetzt. Strukturdaten (estimatedWords, research-Suchbegriffe,
 * totalWords) bleiben unverändert. Gibt ein NEUES Objekt zurück —
 * die Eingabe wird nicht mutiert. Leere Felder lösen keinen
 * Provider-Call aus.
 */
export async function translateOutline(
  outline: BookOutline,
  targetLang: BilingualTargetLang,
  complete: CompleteFn,
): Promise<BookOutline> {
  const chapters: OutlineChapter[] = [];
  for (const ch of outline.chapters) {
    const [title, goal, conflict, outcome, pov] = await Promise.all([
      translateText(ch.title, targetLang, complete),
      translateText(ch.goal, targetLang, complete),
      translateText(ch.conflict, targetLang, complete),
      translateText(ch.outcome, targetLang, complete),
      translateText(ch.pov, targetLang, complete),
    ]);
    const subchapters: string[] = [];
    for (const sub of ch.subchapters) {
      subchapters.push(await translateText(sub, targetLang, complete));
    }
    chapters.push({
      ...ch,
      title,
      goal,
      conflict,
      outcome,
      pov,
      subchapters,
    });
  }
  return { ...outline, chapters };
}
