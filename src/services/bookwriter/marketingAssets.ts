// Marketing-Assets (Sprint 3, Agent 4): Klappentext, 7 Amazon-Keywords,
// Kategorien-Vorschläge — automatisch aus der finalen Buch-Zusammenfassung.
//
// Wird parallel zum KDP-Preflight ausgeführt. Deterministischer Kern
// (kein LLM-Call, offline prüfbar); buildMarketingLlmPrompt liefert den
// Prompt für eine optionale LLM-Nachschärfung über den Standard-Provider.

import { generateBlurb, type BlurbResult } from "@/services/marketing/blurbgen";
import { extractThemes } from "./coverPrompts";

// --- Types ---

export interface MarketingInput {
  title: string;
  subtitle?: string;
  /** Finale Buch-Zusammenfassung (Summarizer-Output). */
  summary: string;
  genre: string;
  targetAudience?: string;
  language?: string;
}

export interface CategorySuggestion {
  /** Amazon-KDP-Kategorie-Pfad, z.B. "Fiction > Fantasy > Urban". */
  path: string;
  store: "amazon-kdp";
  /** Begründung, warum die Kategorie passt. */
  reason: string;
}

export interface MarketingAssets {
  blurb: BlurbResult;
  /** Genau 7 Keywords, je max. 50 Zeichen (KDP-Limit). */
  keywords: string[];
  categories: CategorySuggestion[];
  /** "deterministic" | "llm" (nach optionalem LLM-Call). */
  source: "deterministic" | "llm";
}

// --- Keywords -----------------------------------------------------------------

/**
 * Baut genau 7 Amazon-Keywords (KDP-Limit: 7 Slots, je max. 50 Zeichen).
 * Zusammensetzung: Genre + Subgenre-Signale, Zielgruppe, 3 stärkste Themes,
 * Format-Typen (Long-Tail-Suchphrasen).
 */
export function buildKeywords(input: MarketingInput): string[] {
  const themes = extractThemes(input.summary, 6);
  const genre = input.genre.trim().toLowerCase();
  const audience = (input.targetAudience ?? "").trim().toLowerCase();

  const candidates: string[] = [];
  const push = (k: string): void => {
    const key = k.toLowerCase().trim();
    if (key.length === 0 || key.length > 50) return;
    if (candidates.some((c) => c.toLowerCase() === key)) return;
    candidates.push(key);
  };

  // 1) Genre-Kern-Keywords + Long-Tail-Varianten.
  push(`${genre} buch`);
  push(`${genre} roman`);
  push(`bücher ${genre}`);

  // 2) Zielgruppe.
  if (audience) push(`${genre} für ${audience.replace(/^für\s+/i, "")}`);

  // 3) Inhaltliche Themes (aus der Zusammenfassung) als Long-Tail.
  for (const t of themes) push(t);
  for (const t of themes) push(`${genre} ${t}`);

  return candidates.slice(0, 7);
}

// --- Kategorien ----------------------------------------------------------------

interface GenreCategory {
  keys: RegExp;
  paths: string[];
}

const GENRE_CATEGORIES: GenreCategory[] = [
  {
    keys: /urban fantasy|fantasy/i,
    paths: [
      "Fiction > Fantasy > Urban",
      "Fiction > Fantasy > Contemporary Fantasy",
      "Fiction > Action & Adventure",
      "Fiction > Fantasy > Epic",
      "Teen & Young Adult > Science Fiction & Fantasy",
    ],
  },
  {
    keys: /krimi|crime|mord/i,
    paths: [
      "Fiction > Mystery & Detective > General",
      "Fiction > Mystery & Detective > Police Procedural",
      "Fiction > Thrillers > Crime",
      "Fiction > Crime",
      "Fiction > Mystery & Detective > Cozy",
    ],
  },
  {
    keys: /thriller/i,
    paths: [
      "Fiction > Thrillers > Suspense",
      "Fiction > Thrillers > Psychological",
      "Fiction > Action & Adventure",
      "Fiction > Thrillers > Crime",
      "Fiction > Mystery & Detective > General",
    ],
  },
  {
    keys: /romance|liebe/i,
    paths: [
      "Fiction > Romance > Contemporary",
      "Fiction > Romance > New Adult",
      "Fiction > Women's Fiction",
      "Fiction > Romance > Romantic Comedy",
      "Fiction > Family Life",
    ],
  },
  {
    keys: /horror|grusel/i,
    paths: [
      "Fiction > Horror",
      "Fiction > Gothic",
      "Fiction > Occult & Supernatural",
      "Fiction > Thrillers > Suspense",
      "Fiction > Short Stories",
    ],
  },
  {
    keys: /science[- ]?fiction|sci-?fi/i,
    paths: [
      "Fiction > Science Fiction > Space Exploration",
      "Fiction > Science Fiction > Hard Science Fiction",
      "Fiction > Science Fiction > Alien Contact",
      "Fiction > Action & Adventure",
      "Fiction > Dystopian",
    ],
  },
  {
    keys: /sachbuch|ratgeber|non-?fiction|selbsthilfe|self-?help/i,
    paths: [
      "Self-Help > Personal Transformation",
      "Business & Money > Personal Finance",
      "Health, Fitness & Dieting > Mental Health",
      "Education & Teaching",
      "Reference > How-to Guides",
    ],
  },
];

/**
 * Liefert 3-5 Kategorien-Vorschläge. Bekannte Genres bekommen gemappte
 * Amazon-Kategorien; unbekannte Genres einen generischen Fallback.
 */
export function suggestCategories(input: MarketingInput): CategorySuggestion[] {
  const matched = GENRE_CATEGORIES.find((g) => g.keys.test(input.genre));
  const paths = matched
    ? matched.paths
    : [
        "Fiction > Literary",
        "Fiction > General",
        `${capitalized(input.genre)} > General`,
        "Fiction > Contemporary",
        "Fiction > Action & Adventure",
      ];
  return paths.slice(0, 5).map((path, i) => ({
    path,
    store: "amazon-kdp" as const,
    reason:
      i === 0
        ? `Primäre Kategorie: stärkste Genre-Zuordnung zu "${input.genre}".`
        : i < 3
          ? `Sekundäre Kategorie: erreicht angrenzende Lesergruppen des Genres "${input.genre}".`
          : "Breite Zusatzkategorie für zusätzliche Sichtbarkeit im KDP-Store.",
  }));
}

function capitalized(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Blurb (über blurbgen) ------------------------------------------------------

function blurbFromSummary(input: MarketingInput): BlurbResultLocal {
  const firstSentence = (input.summary.match(/[^.!?]+[.!?]/)?.[0] ?? input.summary).trim();
  const result = generateBlurb({
    title: input.title,
    subtitle: input.subtitle,
    language: input.language ?? "de",
    type: /sachbuch|ratgeber|non-?fiction|self-?help/i.test(input.genre) ? "nonfiction" : "fiction",
    genre: input.genre,
    audience: input.targetAudience ?? "allgemeines Publikum",
    format: "amazon-description",
    situation: firstSentence,
    conflict: secondSentence(input.summary) ?? firstSentence,
    stakes: lastSentence(input.summary) ?? firstSentence,
  });
  return result;
}

function secondSentence(s: string): string | undefined {
  const m = s.match(/[^.!?]+[.!?]/g) ?? [];
  return m[1]?.trim();
}

function lastSentence(s: string): string | undefined {
  const m = s.match(/[^.!?]+[.!?]/g) ?? [];
  return m.length > 1 ? m[m.length - 1].trim() : undefined;
}

type BlurbResultLocal = ReturnType<typeof generateBlurb>;

// --- Public API -----------------------------------------------------------------

/**
 * Erzeugt alle Marketing-Assets in einem Aufruf:
 * Klappentext (via blurbgen), genau 7 Keywords, 3-5 Kategorien.
 * Rein deterministisch — parallel zum KDP-Preflight lauffähig.
 */
export function generateMarketingAssets(input: MarketingInput): MarketingAssets {
  return {
    blurb: blurbFromSummary(input),
    keywords: buildKeywords(input),
    categories: suggestCategories(input),
    source: "deterministic",
  };
}

/**
 * Baut den LLM-Prompt für die optionale Nachschärfung der Assets
 * (Klappentext + 7 Keywords + Kategorien in einem Call, JSON-Antwort).
 */
export function buildMarketingLlmPrompt(input: MarketingInput): string {
  return [
    "Du bist ein erfahrener Amazon-KDP-Marketing-Experte.",
    "Erzeuge aus den Buchdaten: einen verkaufsstarken Klappentext (150-250 Wörter, keine Spoiler),",
    "genau 7 Amazon-Keywords (Long-Tail, je max. 50 Zeichen) und 3-5 passende Amazon-KDP-Kategorien.",
    "Antworte NUR mit JSON im Format:",
    '{"description": "...", "shortDescription": "...", "keywords": ["...", ...7], "categories": ["Fiction > ...", ...]}',
    "",
    `Titel: ${input.title}`,
    input.subtitle ? `Untertitel: ${input.subtitle}` : "",
    `Genre: ${input.genre}`,
    input.targetAudience ? `Zielgruppe: ${input.targetAudience}` : "",
    `Inhalt: ${truncate(input.summary, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max).trimEnd() + "…" : s;
}
