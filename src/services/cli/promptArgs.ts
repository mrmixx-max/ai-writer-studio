// CLI-Flags für die Prompt-Library (Sprint 6, Agent 2).
//
// Muster identisch zu parseHitlArg (Sprint 5): reine Logik in diesem Modul,
// dünner Terminal-Adapter in cli.ts. Unterstützte Flags:
//
//   --genre=sachbuch-it          Genre-Profil aus prompts.json
//   --audience="IT-Berufe"       Zielgruppe (Handlebars {{targetAudience}})
//   --tone="sachlich-nah"        Tonalität  (Handlebars {{tone}})
//   --length=12x2500             Buchlänge: 12 Kapitel à 2500 Wörter
//   --prompts=/pfad/prompts.json Override des Library-Pfads (validiert)
//
// Alle Flags sind optional; ohne Flags verhält sich die CLI unverändert
// (keine Breaking Changes).

import * as fs from "node:fs";
import { PROMPT_LIBRARY, type PromptLibrary } from "../bookwriter/prompts/library";

/** Aus argv geparste Prompt-Library-Flags. */
export interface PromptFlags {
  genre: string | null;
  audience: string | null;
  tone: string | null;
  chapterCount: number | null;
  wordsPerChapter: number | null;
  promptsPath: string | null;
}

/** Liest --genre=, --audience=, --tone=, --length=, --prompts= aus argv. */
export function parsePromptArgs(argv: string[]): PromptFlags {
  const pick = (prefix: string): string | null => {
    const arg = argv.find((a) => a.startsWith(`${prefix}=`));
    return arg ? arg.slice(prefix.length + 1) : null;
  };
  const flags: PromptFlags = {
    genre: pick("--genre"),
    audience: pick("--audience"),
    tone: pick("--tone"),
    chapterCount: null,
    wordsPerChapter: null,
    promptsPath: pick("--prompts"),
  };
  const length = pick("--length");
  if (length) {
    const m = length.match(/^(\d+)x(\d+)$/);
    if (m) {
      flags.chapterCount = parseInt(m[1], 10);
      flags.wordsPerChapter = parseInt(m[2], 10);
    }
  }
  return flags;
}

/** Kurze Flag-Übersicht für die CLI-Ausgabe. */
export function formatPromptFlags(flags: PromptFlags): string {
  const parts: string[] = [];
  if (flags.genre) parts.push(`Genre-Profil: ${flags.genre}`);
  if (flags.audience) parts.push(`Zielgruppe: ${flags.audience}`);
  if (flags.tone) parts.push(`Tonalität: ${flags.tone}`);
  if (flags.chapterCount && flags.wordsPerChapter) {
    parts.push(`Umfang: ${flags.chapterCount} Kapitel à ${flags.wordsPerChapter} Wörter`);
  }
  if (flags.promptsPath) parts.push(`Prompts: ${flags.promptsPath}`);
  return parts.length > 0 ? `Prompt-Library: ${parts.join(" · ")}` : "";
}

/** Fehler beim Laden/Validieren einer Prompt-Library (mit cause, siehe ProviderError). */
export class PromptLibraryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PromptLibraryError";
  }
}

/**
 * Lädt und validiert eine externe Prompt-Library (--prompts= Override).
 * Ohne Override: die eingebaute prompts.json (Build-Zeit-Import).
 * Wirft sprechende Fehler bei fehlender Datei oder ungültigem Schema,
 * statt still die Defaults zu nutzen.
 */
export function loadPromptLibraryOverride(path: string | null): PromptLibrary {
  if (!path) return PROMPT_LIBRARY;
  if (!fs.existsSync(path)) {
    throw new PromptLibraryError(`Prompt-Library nicht gefunden: ${path}`);
  }
  const raw = fs.readFileSync(path, "utf-8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new PromptLibraryError(
      `Prompt-Library ist kein valides JSON: ${e instanceof Error ? e.message : String(e)}`,
      e,
    );
  }
  const lib = data as Partial<PromptLibrary>;
  if (typeof lib.version !== "string" || lib.version === "") {
    throw new Error("Prompt-Library: Feld 'version' fehlt oder ist leer.");
  }
  if (!lib.genres || typeof lib.genres !== "object" || Object.keys(lib.genres).length === 0) {
    throw new Error("Prompt-Library: Feld 'genres' fehlt oder ist leer.");
  }
  for (const [key, profile] of Object.entries(lib.genres)) {
    if (typeof profile?.systemRole !== "string" || profile.systemRole === "") {
      throw new Error(`Prompt-Library: Genre "${key}" ohne systemRole.`);
    }
    if (!Array.isArray(profile.systemRules) || profile.systemRules.length === 0) {
      throw new Error(`Prompt-Library: Genre "${key}" ohne systemRules.`);
    }
    if (!profile.prompts || Object.keys(profile.prompts).length === 0) {
      throw new Error(`Prompt-Library: Genre "${key}" ohne prompts.`);
    }
  }
  return lib as PromptLibrary;
}
