// Sprint 15, Agent 5: Bilingual-Prompt-Templates (NEUE Datei).
//
// Bilinguale Prompt-Templates (DE/EN) als duenne Schicht UEBER der
// bestehenden Prompt-Engine (renderTemplate aus
// src/services/bookwriter/prompts/template).
//
// Regeln:
// - KEINE Aenderung an Sprint-14-Dateien (templates.ts bleibt unangetastet,
//   read-only). Alle Template-Texte hier sind NEU und eigenstaendig.
// - KEINE LLM-Calls: alles hier sind pure Functions (build rendert nur).
// - Jedes Template: { id, description, build(vars): string } mit
//   {{variable}}-Platzhaltern (Handlebars via renderTemplate).

import { renderTemplate } from "../bookwriter/prompts/template";
import type { TemplateVars } from "../bookwriter/prompts/template";

/** Variablen-Belegung fuer build(): Strings/Zahlen, optional unbelegt. */
export type BilingualVars = Record<string, string | number | undefined>;

/**
 * Ein einzelnes bilinguales Prompt-Template.
 * - template: Handlebars-Template mit {{variablen}} (Engine: renderTemplate).
 * - requiredVars: muessen beim build() belegt sein (sonst throw).
 * - optionalVars: duerfen zusaetzlich belegt sein (gegen unknown-Check).
 * - build(vars): validiert requiredVars (strict) und rendert den Prompt.
 */
export interface BilingualTemplate {
  id: string;
  description: string;
  template: string;
  requiredVars: string[];
  optionalVars?: string[];
  build: (vars: BilingualVars) => string;
}

/** Ergebnis der Variablen-Validierung. */
export interface BilingualValidation {
  missing: string[];
  unknown: string[];
  valid: boolean;
}

/**
 * Validiert belegte Variablen gegen ein bilinguales Template.
 * - missing: requiredVars ohne belegten (nicht-leeren) Wert.
 * - unknown: belegte Keys, die weder required noch optional sind.
 */
export function validateBilingualVars(
  tpl: BilingualTemplate,
  vars: BilingualVars,
): BilingualValidation {
  const missing = tpl.requiredVars.filter((name) => {
    const v = vars[name];
    return v === undefined || v === null || v === "";
  });
  const declared = new Set<string>([...tpl.requiredVars, ...(tpl.optionalVars ?? [])]);
  const unknown = Object.keys(vars).filter((k) => !declared.has(k)).sort();
  return { missing, unknown, valid: missing.length === 0 && unknown.length === 0 };
}

/** Baut einen build()-Renderer fuer ein Template (strict: requiredVars). */
function makeBuild(
  id: string,
  template: string,
  requiredVars: string[],
): (vars: BilingualVars) => string {
  return (vars: BilingualVars) => {
    const missing = requiredVars.filter((name) => {
      const v = vars[name];
      return v === undefined || v === null || v === "";
    });
    if (missing.length > 0) {
      throw new Error(`Fehlende Variablen fuer "${id}": ${missing.join(", ")}.`);
    }
    return renderTemplate(template, vars as TemplateVars);
  };
}

// ---------------------------------------------------------------------------
// 1) Uebersetzungs-System-Prompt (DE -> EN)
// ---------------------------------------------------------------------------

const TRANSLATE_DE_EN_TEXT = [
  "You are a professional German-to-English literary translator.",
  "Translate the following German source text into English.",
  "Tone: {{tone}}. Keep the tone consistent throughout the translation.",
  "Preserve all markup exactly (Markdown, HTML tags, emphasis, headings,",
  "lists): do not add, remove, or reorder markup elements.",
  "Do not add explanations, comments, or content not present in the source.",
  "{{#if glossary}}Terminology glossary (DE -> EN, use exactly): {{glossary}}.{{/if}}",
  "{{#if styleHint}}Style note: {{styleHint}}.{{/if}}",
  "Source text (German):",
  "{{sourceText}}",
].join("\n");

export const TRANSLATE_DE_EN_TEMPLATE: BilingualTemplate = {
  id: "bilingual:translate-de-en",
  description:
    "System-Prompt fuer DE→EN-Uebersetzung: Ton konsistent halten, Markup exakt erhalten, nichts hinzufuegen.",
  template: TRANSLATE_DE_EN_TEXT,
  requiredVars: ["sourceText", "tone"],
  optionalVars: ["glossary", "styleHint"],
  build: makeBuild("bilingual:translate-de-en", TRANSLATE_DE_EN_TEXT, [
    "sourceText",
    "tone",
  ]),
};

// ---------------------------------------------------------------------------
// 2) Bilinguale Kapitel-Zusammenfassung (DE + EN)
// ---------------------------------------------------------------------------

const CHAPTER_SUMMARY_BILINGUAL_TEXT = [
  "Fasse das Kapitel \"{{chapterTitle}}\" zweisprachig zusammen (Deutsch + Englisch).",
  "Summarize the chapter \"{{chapterTitle}}\" bilingually (German + English).",
  "{{#if maxSentences}}Umfang: max. {{maxSentences}} Saetze pro Sprache. / Length: max. {{maxSentences}} sentences per language.{{/if}}",
  "{{#if focusPoints}}Schwerpunkte / Focus: {{focusPoints}}.{{/if}}",
  "Format: erst die deutsche Zusammenfassung unter \"DE:\", dann die englische unter \"EN:\".",
  "Kapiteltext / Chapter text:",
  "{{chapterText}}",
].join("\n");

export const CHAPTER_SUMMARY_BILINGUAL_TEMPLATE: BilingualTemplate = {
  id: "bilingual:chapter-summary",
  description:
    "Bilinguale Kapitelzusammenfassung: erst DE, dann EN, gleiche Inhalte in beiden Sprachen.",
  template: CHAPTER_SUMMARY_BILINGUAL_TEXT,
  requiredVars: ["chapterTitle", "chapterText"],
  optionalVars: ["maxSentences", "focusPoints"],
  build: makeBuild("bilingual:chapter-summary", CHAPTER_SUMMARY_BILINGUAL_TEXT, [
    "chapterTitle",
    "chapterText",
  ]),
};

// ---------------------------------------------------------------------------
// 3) Sprachuebergreifende Konsistenzpruefung (DE vs. EN)
// ---------------------------------------------------------------------------

const CONSISTENCY_CHECK_TEXT = [
  "Pruefe die sprachuebergreifende Konsistenz zwischen deutschem Ausgangstext und englischer Uebersetzung.",
  "Check cross-language consistency between the German source and the English translation.",
  "Pruefe / Check: (1) inhaltliche Vollstaendigkeit (nichts fehlt, nichts hinzugefuegt),",
  "(2) einheitliche Terminologie, (3) erhaltenes Markup, (4) konsistenter Ton.",
  "{{#if glossary}}Terminologie-Vorgabe / Terminology reference: {{glossary}}.{{/if}}",
  "Antworte strukturiert: Liste jede Abweichung mit Kategorie, DE-Stelle und EN-Stelle auf.",
  "Deutscher Text / German text:",
  "{{germanText}}",
  "Englischer Text / English text:",
  "{{englishText}}",
].join("\n");

export const CONSISTENCY_CHECK_TEMPLATE: BilingualTemplate = {
  id: "bilingual:consistency-check",
  description:
    "Konsistenzpruefung DE vs. EN: Vollstaendigkeit, Terminologie, Markup-Erhalt und Ton-Abgleich.",
  template: CONSISTENCY_CHECK_TEXT,
  requiredVars: ["germanText", "englishText"],
  optionalVars: ["glossary"],
  build: makeBuild("bilingual:consistency-check", CONSISTENCY_CHECK_TEXT, [
    "germanText",
    "englishText",
  ]),
};

/** Vollstaendige Registry aller bilingualen Templates. */
export const BILINGUAL_REGISTRY: BilingualTemplate[] = [
  TRANSLATE_DE_EN_TEMPLATE,
  CHAPTER_SUMMARY_BILINGUAL_TEMPLATE,
  CONSISTENCY_CHECK_TEMPLATE,
];

/** Alle Template-IDs der bilingualen Registry. */
export function listBilingualTemplateIds(): string[] {
  return BILINGUAL_REGISTRY.map((t) => t.id);
}

/** Holt ein bilinguales Template per ID (unbekannte ID -> throw). */
export function getBilingualTemplate(id: string): BilingualTemplate {
  const tpl = BILINGUAL_REGISTRY.find((t) => t.id === id);
  if (!tpl) throw new Error(`Unbekanntes bilinguales Template: "${id}".`);
  return tpl;
}
