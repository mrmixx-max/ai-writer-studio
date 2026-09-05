// Prompt-Library (Sprint 6, Agent 2): externe Prompt-Templates + Genre-Profile.
//
// Architektur:
// - prompts.json: ALLE System-Prompts und User-Prompt-Templates (Handlebars),
//   inkl. Genre-Profilen (systemRole + systemRules je Genre). Neue Genres
//   sind damit reine Datenänderung — kein Code-Touch.
// - prompts.ts bleibt als Fassade mit unveränderten Funktionssignaturen
//   erhalten (keine Breaking Changes): Die Funktionen rendern jetzt aus der
//   Library statt aus String-Konkatenation.
// - template.ts: minimale Handlebars-Engine (ohne Dependency, siehe dort).
//
// Handlebars-Variablen (Sprint-6-Akzeptanzkriterium): targetAudience,
// tone (Tone-of-Voice) und Buchlänge (chapterCount/wordsPerChapter bzw.
// chapterWords) sind Template-Variablen und je Genre frei konfigurierbar.

import promptsData from "./prompts.json";
import { renderTemplate } from "./template";

/** Ein Genre-Profil aus prompts.json. */
export interface GenreProfile {
  label: string;
  systemRole: string;
  systemRules: string[];
  prompts: Record<string, string>;
}

/** Ein Stil/Ton-Preset aus prompts.json (Sprint 7, Agent 3). */
export interface StylePreset {
  id: string;
  label: string;
  description: string;
  systemHint: string;
  rules: string[];
}

/** Wurzel-Schema von prompts.json. */
export interface PromptLibrary {
  version: string;
  defaultGenre: string;
  /** Vordefinierte Stil/Ton-Presets (Sprint 7). Optional für Abwärtskompatibilität. */
  styles?: StylePreset[];
  genres: Record<string, GenreProfile>;
}

/** Die geladene Prompt-Library (Import zur Build-Zeit, kein Runtime-IO). */
export const PROMPT_LIBRARY: PromptLibrary = promptsData as unknown as PromptLibrary;

/** Version der Prompt-Library. */
export const PROMPT_LIBRARY_VERSION = PROMPT_LIBRARY.version;

/** Verfügbare Genre-Profile (Keys aus prompts.json). */
export function listGenres(): string[] {
  return Object.keys(PROMPT_LIBRARY.genres);
}

/**
 * Löst einen Genre-Key (CLI-Wert oder Briefing-Genre) auf ein Profil auf.
 * Bekannte Aliase ("Sachbuch", "Roman", …) werden on-the-fly gemappt;
 * Unbekanntes fällt auf den Legacy-Fallback "sachbuch" zurück — identisch
 * zum bisherigen Verhalten von systemForGenre.
 */
export function resolveGenre(genre: string | null | undefined): GenreProfile {
  if (!genre || genre.trim() === "") {
    return PROMPT_LIBRARY.genres[PROMPT_LIBRARY.defaultGenre];
  }
  const key = normalizeGenreKey(genre);
  return PROMPT_LIBRARY.genres[key] ?? PROMPT_LIBRARY.genres[PROMPT_LIBRARY.defaultGenre];
}

/** Normalisiert einen Genre-String auf den Library-Key. */
export function normalizeGenreKey(genre: string): string {
  const raw = genre.trim().toLowerCase();
  if (raw in PROMPT_LIBRARY.genres) return raw;
  // Legacy-Aliase: deutsche Nomen statt Keys ("Sachbuch" → sachbuch etc.)
  const alias: Record<string, string> = {
    "sachbuch": "sachbuch",
    "ratgeber": "ratgeber",
    "technik": "technik",
    "roman": "roman",
    "kurzgeschichte": "kurzgeschichte",
    "essaybeuch": "essaybeuch",
    "krimi": "krimi",
    "fantasy": "fantasy",
    "sachbuch-it": "sachbuch-it",
    "ratgeber-gesundheit": "ratgeber-gesundheit",
    "fiction-thriller": "fiction-thriller",
  };
  return alias[raw] ?? raw;
}

/**
 * Stil/Ton-Presets (Sprint 7, Agent 3): alle Presets aus prompts.json
 * in definierter Reihenfolge.
 */
export function listStyles(): StylePreset[] {
  return PROMPT_LIBRARY.styles ?? [];
}

/**
 * Löst ein Stil-Preset per ID auf (case-insensitive, getrimmt).
 * Unbekanntes oder leeres Stil-ID → null (kein Overlay).
 */
export function getStyle(styleId: string | null | undefined): StylePreset | null {
  if (!styleId) return null;
  const needle = styleId.trim().toLowerCase();
  if (needle === "") return null;
  return listStyles().find((s) => s.id === needle) ?? null;
}

/**
 * Rendert den Stil-Overlay-Block (Sprint 7): Rollen-Hinweis + Stil-Regeln.
 * Wird NUR bei gesetztem, bekanntem Stil an den System-Prompt angehängt —
 * ohne Stil bleibt der Prompt byte-identisch zum Sprint-6-Stand.
 */
export function styleOverlay(styleId: string | null | undefined): string {
  const style = getStyle(styleId);
  if (!style) return "";
  const rules = style.rules.map((r) => `- ${r}`).join("\n");
  return `\n\nStil-Overlay: ${style.id}\n${style.systemHint}\n\nStil-Regeln:\n${rules}`;
}

/**
 * System-Prompt je Genre (Ersetzung für die bisherige systemForGenre) —
 * rollen- und regelbasiert aus dem Profil gerendert.
 *
 * Sprint 7, Agent 3: optionaler Parameter `style` (Stil-Preset-ID aus
 * prompts.json). Bekanntes Preset → Stil-Overlay (systemHint + Regeln)
 * wird ANGENÄHLT (nicht ersetzt) — der Genre-Prompt bleibt unverändert
 * am Anfang. Unbekanntes/leeres Stil-ID → Verhalten wie ohne Stil
 * (keine Breaking Changes).
 */
export function systemFromProfile(
  genre: string,
  tone: string,
  language: string,
  style?: string | null,
): string {
  const profile = resolveGenre(genre);
  const langNote = language === "en"
    ? "Write all output in English."
    : "Schreibe alle Ausgaben auf Deutsch.";
  const rules = profile.systemRules.map((r) => `- ${r}`).join("\n");
  return `${profile.systemRole}

Tonalität: ${tone}
${langNote}

Regeln:
${rules}${styleOverlay(style)}`;
}

/** Verfügbare Prompt-Templates eines Genres (oder des Default-Genres). */
export function listTemplates(genre?: string): string[] {
  const profile = genre ? resolveGenre(genre) : PROMPT_LIBRARY.genres[PROMPT_LIBRARY.defaultGenre];
  return Object.keys(profile.prompts);
}

/**
 * Rendert ein benanntes Template aus dem Genre-Profil.
 * Fehlende Variablen bleiben leer (Handlebars-Verhalten).
 */
export function renderPrompt(
  name: string,
  vars: Record<string, unknown>,
  genre?: string,
): string {
  const profile = genre ? resolveGenre(genre) : PROMPT_LIBRARY.genres[PROMPT_LIBRARY.defaultGenre];
  const tpl = profile.prompts[name];
  if (!tpl) {
    throw new Error(`Unbekanntes Prompt-Template: "${name}" (Genre: ${profile.label}).`);
  }
  return renderTemplate(tpl, vars);
}
