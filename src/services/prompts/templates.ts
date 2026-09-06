// Sprint 12, Agent 3: Prompt-Template-Library (NEUE Datei).
//
// Typisierte Template-Registry als duenne Schicht UEBER der bestehenden
// Prompt-Library (src/services/bookwriter/prompts/).
//
// Regeln:
// - KEINE Wortlaut-Aenderung an bestehenden Presets (prompts.json,
//   library.ts, template.ts bleiben unangetastet). Alle Template-Texte
//   hier sind NEU und eigenstaendig.
// - KEINE LLM-Calls: alles hier sind pure Functions. Fuer die Ausfuehrung
//   gibt es hoechstens eine injizierbare Complete-Funktion (Dependency
//   Injection, kein Import eines Providers).
// - Typen und Rendering werden wiederverwendet (TemplateVars,
//   renderTemplate, listGenres aus der bestehenden Library), nicht neu
//   erfunden.

import { renderTemplate } from "../bookwriter/prompts/template";
import type { TemplateVars } from "../bookwriter/prompts/template";
import { listGenres } from "../bookwriter/prompts/library";

/** Aufgaben-Typ eines Templates. "system" = System-Prompt, Rest = User-Tasks. */
export type PromptTaskKind = "system" | "chapter" | "outline" | "revise";

/** Injizierbare Vervollstaendigungs-Funktion (z. B. LLM-Call des Callers). */
export type CompleteFn = (prompt: string) => Promise<string>;

/**
 * Ein einzelnes Prompt-Template.
 * - genre: Genre-Key aus der Prompt-Library oder "*" (= expliziter Fallback).
 * - template: Handlebars-Template mit {{variablen}} (Engine: renderTemplate).
 * - requiredVars: muessen beim Rendern belegt sein (strict wirft sonst).
 * - optionalVars: duerfen zusaetzlich belegt sein (gegen unknown-Check).
 */
export interface PromptTemplate {
  id: string;
  task: PromptTaskKind;
  genre: string;
  description: string;
  template: string;
  requiredVars: string[];
  optionalVars?: string[];
}

/** Ergebnis der Variablen-Validierung. */
export interface TemplateValidation {
  missing: string[];
  unknown: string[];
  valid: boolean;
}

/** Fallback-Marker: dieses Genre-Template gilt fuer alle Genres ohne eigenes. */
export const FALLBACK_GENRE = "*";

/** Alle unterstuetzten Aufgaben-Typen. */
export const PROMPT_TASKS: PromptTaskKind[] = ["system", "chapter", "outline", "revise"];

// ---------------------------------------------------------------------------
// Per-Genre System-Prompts
// ---------------------------------------------------------------------------
//
// GENRE_FOCUS enthaelt je Genre-Key EINE eigenstaendige Fokus-Zeile
// (neue Formulierung, kein Zitat aus prompts.json). Daraus wird pro Genre
// ein eigenes System-Template gebaut; Genres ohne Eintrag nutzen das
// explizite Fallback-System-Template (FALLBACK_GENRE).

/** Genre-Fokus je Genre-Key (23 Genres der Prompt-Library). */
export const GENRE_FOCUS: Record<string, string> = {
  sachbuch: "Fokus: verstaendlich erklaerte Sachthemen mit klarer Struktur.",
  ratgeber: "Fokus: umsetzbare Ratschlaege mit konkretem Nutzen im Alltag.",
  technik: "Fokus: praezise Technik-Erklaerungen mit korrekten Begriffen.",
  roman: "Fokus: lebendige Figuren, Spannungsbogen und dichte Szenen.",
  kurzgeschichte: "Fokus: pointierte kurze Form mit starkem Schlussmoment.",
  essaybeuch: "Fokus: reflektierende Essays mit eigener Haltung.",
  krimi: "Fokus: Faelle mit fairen Hinweisen, roten Heringen und Aufloesung.",
  fantasy: "Fokus: konsistente Welt mit eigenen Regeln und Magiesystem.",
  "sachbuch-it": "Fokus: IT-Themen praxisnah mit Beispielen und Code-Bezug.",
  "ratgeber-gesundheit": "Fokus: verstaendliche Gesundheitsinfos ohne Heilversprechen.",
  "fiction-thriller": "Fokus: hohes Tempo, Cliffhanger und Wendepunkte.",
  horror: "Fokus: Atmosphaere und Andeutung statt blosser Effekte.",
  romance: "Fokus: emotionale Entwicklung und glaubwuerdige Beziehung.",
  scifi: "Fokus: spekulative Ideen mit innerer technischer Logik.",
  philosophie: "Fokus: Begriffe klaeren, Argumente pruefen, Gegenpositionen.",
  wirtschaft: "Fokus: Zahlen, Zusammenhaenge und Praxisbeispiele.",
  kinderbuch: "Fokus: einfache Sprache, Warmherzigkeit, altersgerechte Spannung.",
  western: "Fokus: Frontier-Setting mit Ehre, Konflikt und Weite.",
  cyberpunk: "Fokus: High-Tech und soziale Schattenseiten, neon-dichte Welt.",
  maerchen: "Fokus: zeitlose Sprache, Moral und Wunder.",
  doku: "Fokus: belegte Fakten, Quellennaehe, sachlicher Ton.",
  reisebericht: "Fokus: Orte sinnlich schildern, Route und Begegnungen.",
  lyrik: "Fokus: Klang, Bild und Verdichtung in wenigen Zeilen.",
};

/** Skelett des System-Prompts; {{genreFocus}} wird je Genre eingesetzt. */
const SYSTEM_SKELETON = [
  "Du bist ein Schreibassistent.",
  "{{genreFocus}}",
  "Tonalitaet: {{tone}}.",
  "Sprache: {{language}}.",
  "{{#if styleHint}}Stil-Hinweis: {{styleHint}}.{{/if}}",
].join("\n");

/** Explizites Fallback-System-Template (gilt wenn Genre unbekannt/fehlt). */
export const FALLBACK_SYSTEM_TEMPLATE: PromptTemplate = {
  id: "system:fallback",
  task: "system",
  genre: FALLBACK_GENRE,
  description: "Fallback-System-Prompt fuer Genres ohne eigenes Template.",
  template: [
    "Du bist ein Schreibassistent.",
    "Tonalitaet: {{tone}}.",
    "Sprache: {{language}}.",
    "{{#if styleHint}}Stil-Hinweis: {{styleHint}}.{{/if}}",
  ].join("\n"),
  requiredVars: ["tone", "language"],
  optionalVars: ["styleHint"],
};

/** Alle 23 per-Genre System-Templates (aus GENRE_FOCUS gebaut). */
export const SYSTEM_TEMPLATES: PromptTemplate[] = Object.entries(GENRE_FOCUS).map(
  ([genre, genreFocus]) => ({
    id: `system:${genre}`,
    task: "system" as const,
    genre,
    description: `System-Prompt fuer Genre "${genre}".`,
    template: SYSTEM_SKELETON.replace("{{genreFocus}}", genreFocus),
    requiredVars: ["tone", "language"],
    optionalVars: ["styleHint"],
  }),
);

// ---------------------------------------------------------------------------
// Task-Templates (chapter / outline / revise, genre-unabhaengig)
// ---------------------------------------------------------------------------

export const CHAPTER_TEMPLATE: PromptTemplate = {
  id: "chapter:default",
  task: "chapter",
  genre: FALLBACK_GENRE,
  description: "Kapitel-Entwurf aus Kapiteltitel, Ziel und Kontext.",
  template: [
    "Schreibe das Kapitel \"{{chapterTitle}}\" zum Buch \"{{bookTitle}}\".",
    "Ziel des Kapitels: {{chapterGoal}}.",
    "Ton: {{tone}}. Umfang: ca. {{wordCount}} Woerter.",
    "{{#if previousSummary}}Bisherige Handlung: {{previousSummary}}.{{/if}}",
    "{{#if notes}}Notizen: {{notes}}.{{/if}}",
  ].join("\n"),
  requiredVars: ["chapterTitle", "bookTitle", "chapterGoal", "tone", "wordCount"],
  optionalVars: ["previousSummary", "notes"],
};

export const OUTLINE_TEMPLATE: PromptTemplate = {
  id: "outline:default",
  task: "outline",
  genre: FALLBACK_GENRE,
  description: "Gliederung aus Idee, Zielgruppe und Kapitelzahl.",
  template: [
    "Entwirf eine Gliederung fuer ein {{genre}}-Buch zum Thema \"{{idea}}\".",
    "Zielgruppe: {{targetAudience}}. Ton: {{tone}}.",
    "Kapitelanzahl: {{chapterCount}}. Woerter pro Kapitel: {{wordsPerChapter}}.",
    "{{#if corePromise}}Kernversprechen: {{corePromise}}.{{/if}}",
  ].join("\n"),
  requiredVars: ["genre", "idea", "targetAudience", "tone", "chapterCount", "wordsPerChapter"],
  optionalVars: ["corePromise"],
};

export const REVISE_TEMPLATE: PromptTemplate = {
  id: "revise:default",
  task: "revise",
  genre: FALLBACK_GENRE,
  description: "Ueberarbeitung eines Entwurfs anhand von Anweisungen.",
  template: [
    "Ueberarbeite folgenden Entwurf:",
    "{{draftText}}",
    "Anweisungen: {{instructions}}.",
    "Ton: {{tone}}.",
    "{{#if keepPassages}}Unveraendert lassen: {{keepPassages}}.{{/if}}",
  ].join("\n"),
  requiredVars: ["draftText", "instructions", "tone"],
  optionalVars: ["keepPassages"],
};

/** Vollstaendige Registry: Fallback-System + 23 Genre-Systeme + 3 Tasks. */
export const TEMPLATE_REGISTRY: PromptTemplate[] = [
  FALLBACK_SYSTEM_TEMPLATE,
  ...SYSTEM_TEMPLATES,
  CHAPTER_TEMPLATE,
  OUTLINE_TEMPLATE,
  REVISE_TEMPLATE,
];

// ---------------------------------------------------------------------------
// Variable-Analyse + Validierung (pure)
// ---------------------------------------------------------------------------

const BLOCK_KEYWORDS = new Set(["else"]);
const BLOCK_PREFIXES = ["#if ", "#unless ", "#each ", "/"];

/** true wenn der Klammer-Inhalt ein Block-Helper/Spezialausdruck ist. */
function isHelperExpression(content: string): boolean {
  if (content === "this" || content.startsWith("this.")) return true;
  if (content.startsWith("@")) return true;
  if (BLOCK_KEYWORDS.has(content)) return true;
  return BLOCK_PREFIXES.some((p) => content.startsWith(p));
}

/**
 * Extrahiert alle Variablennamen eines Handlebars-Templates.
 * Block-Helper (#if/#unless/#each/else//...), {{this}} und {{@...}}
 * werden ignoriert; von Pfaden (a.b.c) wird der Kopf (a) genommen.
 */
export function extractVariables(tpl: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\{([\s\S]+?)\}\}\}|\{\{([\s\S]+?)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl)) !== null) {
    const content = (m[1] !== undefined ? m[1] : m[2]).trim();
    if (content === "" || isHelperExpression(content)) continue;
    // Bedingung von #if/#unless ohne Prefix-Schreibweise abfangen:
    const head = content.split(/[.\s|]/)[0].trim();
    if (head === "" || head.startsWith("@") || head === "this") continue;
    found.add(head);
  }
  return [...found].sort();
}

/**
 * Validiert belegte Variablen gegen ein Template.
 * - missing: requiredVars ohne belegten (nicht-leeren) Wert.
 * - unknown: belegte Keys, die weder required noch optional noch im
 *   Template-Text referenziert sind.
 */
export function validateVars(
  tpl: PromptTemplate,
  vars: Record<string, unknown>,
): TemplateValidation {
  const missing = tpl.requiredVars.filter((name) => {
    const v = vars[name];
    return v === undefined || v === null || v === "";
  });
  const declared = new Set<string>([
    ...tpl.requiredVars,
    ...(tpl.optionalVars ?? []),
    ...extractVariables(tpl.template),
  ]);
  const unknown = Object.keys(vars).filter((k) => !declared.has(k)).sort();
  return { missing, unknown, valid: missing.length === 0 && unknown.length === 0 };
}

// ---------------------------------------------------------------------------
// Aufloesung + Rendering (pure)
// ---------------------------------------------------------------------------

/** Alle Template-IDs der Registry. */
export function listTemplateIds(): string[] {
  return TEMPLATE_REGISTRY.map((t) => t.id);
}

/** Holt ein Template per ID (unbekannte ID -> throw). */
export function getTemplate(id: string): PromptTemplate {
  const tpl = TEMPLATE_REGISTRY.find((t) => t.id === id);
  if (!tpl) throw new Error(`Unbekanntes Prompt-Template: "${id}".`);
  return tpl;
}

/**
 * Loest ein Template fuer (task, genre) auf.
 * - task "system" + bekanntes Genre -> per-Genre System-Template.
 * - alles andere / unbekanntes Genre -> explizites Fallback-Template
 *   der Aufgabe (kein Throw, kein null).
 */
export function resolveTemplate(
  task: PromptTaskKind,
  genre?: string | null,
): PromptTemplate {
  if (task === "system" && genre) {
    const key = genre.trim().toLowerCase();
    const hit = SYSTEM_TEMPLATES.find((t) => t.genre === key);
    if (hit) return hit;
  }
  const fallback = TEMPLATE_REGISTRY.find(
    (t) => t.task === task && t.genre === FALLBACK_GENRE,
  );
  if (!fallback) throw new Error(`Kein Fallback-Template fuer Task "${task}".`);
  return fallback;
}

/** true wenn das Genre ein eigenes System-Template (kein Fallback) hat. */
export function hasGenreTemplate(genre: string): boolean {
  return SYSTEM_TEMPLATES.some((t) => t.genre === genre.trim().toLowerCase());
}

/**
 * Rendert ein Template mit Variablen (pure, keine LLM-Calls).
 * - strict=false (Default): fehlende Vars rendern als "" (Handlebars).
 * - strict=true: fehlende requiredVars -> throw.
 */
export function renderPromptTemplate(
  tpl: PromptTemplate,
  vars: Record<string, unknown> = {},
  opts: { strict?: boolean } = {},
): string {
  if (opts.strict) {
    const check = validateVars(tpl, vars);
    if (check.missing.length > 0) {
      throw new Error(
        `Fehlende Variablen fuer "${tpl.id}": ${check.missing.join(", ")}.`,
      );
    }
  }
  return renderTemplate(tpl.template, vars as TemplateVars);
}

/**
 * Rendert per (task, genre)-Aufloesung. Duenne Convenience-Huelle um
 * resolveTemplate + renderPromptTemplate (weiterhin pure).
 */
export function renderTask(
  task: PromptTaskKind,
  vars: Record<string, unknown> = {},
  genre?: string | null,
  opts: { strict?: boolean } = {},
): string {
  return renderPromptTemplate(resolveTemplate(task, genre), vars, opts);
}

/**
 * Fuehrt eine Template-Aufgabe ueber eine injizierte Complete-Funktion aus.
 * Einzige Stelle mit Aussenwirkung; die Funktion selbst macht KEINEN
 * Netzwerk-/LLM-Call, sondern ruft nur `complete` mit dem gerenderten
 * Prompt auf (Dependency Injection, gut testbar).
 */
export async function runTemplateTask(
  task: PromptTaskKind,
  vars: Record<string, unknown>,
  complete: CompleteFn,
  genre?: string | null,
): Promise<string> {
  const prompt = renderTask(task, vars, genre, { strict: true });
  return complete(prompt);
}

/**
 * Selbstauskunft: Jedes Genre der bestehenden Prompt-Library hat entweder
 * ein eigenes System-Template oder das explizite Fallback.
 * (Nutzt listGenres wieder — keine zweite Genre-Liste zum Driften.)
 */
export function genreCoverage(): Array<{ genre: string; covered: boolean; via: string }> {
  return listGenres().map((genre) => {
    if (hasGenreTemplate(genre)) {
      return { genre, covered: true, via: `system:${genre}` };
    }
    return { genre, covered: true, via: FALLBACK_SYSTEM_TEMPLATE.id };
  });
}
