// Cover-Prompt-Generator (Sprint 3, Agent 4).
//
// Erzeugt aus der finalen Buch-Zusammenfassung 3-5 hochdetaillierte
// Prompts für Midjourney / Stable Diffusion. Rein deterministisch
// (kein LLM-Call, kein API-Budget): Theme-Extraktion + Genre-Stimmung +
// 5 Kompositions-/Stil-Spuren.
//
// Baut konzeptionell auf llm/covergen.ts auf (Prompt-Optimizer für
// interaktive Eingaben), verdichtet hier aber AUTOMATISCH aus der
// Zusammenfassung.

// --- Types ---

export type CoverPromptEngine = "midjourney" | "stable-diffusion";

export interface CoverPromptInput {
  title: string;
  subtitle?: string;
  /** Finale Buch-Zusammenfassung (aus dem Summarizer). */
  summary: string;
  genre: string;
  targetAudience?: string;
  /** "de" | "en" | ... — steuert Prompt-Sprache (Englisch für beste MJ/SD-Ergebnisse). */
  language?: string;
  /** Zusätzliche Motive, die zwingend in die Prompts sollen. */
  extraMotifs?: string[];
}

export interface CoverPrompt {
  /** Nummer der Variante (1..n). */
  variant: number;
  /** Stil-Spur dieser Variante. */
  style: string;
  /** Der vollständige, detailreiche Prompt. */
  fullPrompt: string;
  negativePrompt: string;
  /** Kurze Begründung, warum diese Variante passt. */
  rationale: string;
}

export interface CoverPromptOptions {
  /** 3-5, wird geclampt (Default 5). */
  count?: number;
  engine?: CoverPromptEngine;
}

// --- Theme-Extraktion ---------------------------------------------------------

/** Deutsche + englische Stoppwörter für die Theme-Extraktion. */
const STOPWORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
  "einem", "einen", "und", "oder", "aber", "als", "wie", "bei", "mit", "von",
  "vom", "zum", "zur", "im", "in", "an", "am", "auf", "für", "aus", "bei",
  "nach", "vor", "über", "unter", "durch", "um", "ist", "sind", "war", "waren",
  "hat", "haben", "wird", "werden", "wurde", "wurden", "kann", "könnte",
  "muss", "sich", "ihre", "ihren", "ihrer", "sein", "ihre", "dass", "auch",
  "noch", "nur", "schon", "wieder", "dann", "wenn", "weil", "doch", "nun",
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "with", "from", "by", "as", "is", "are", "was", "were", "be", "been",
  "has", "have", "had", "will", "would", "could", "should", "it", "its",
  "this", "that", "these", "those", "their", "there", "then", "than",
]);

/**
 * Extrahiert die inhaltstragenden Schlüsselwörter der Zusammenfassung.
 * Sortiert nach Häufigkeit (dann Erstvorkommen), dedupliziert case-insensitive.
 */
export function extractThemes(summary: string, max = 8): string[] {
  const words = summary.toLowerCase().match(/[\p{L}][\p{L}'-]{2,}/gu) ?? [];
  const counts = new Map<string, { count: number; first: number }>();
  words.forEach((w, i) => {
    if (STOPWORDS.has(w) || w.length < 4) return;
    const key = w;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { count: 1, first: i });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
    .slice(0, max)
    .map(([w]) => w);
}

// --- Genre-Stimmung -----------------------------------------------------------

interface Mood {
  mood: string;
  palette: string;
  lighting: string;
}

const GENRE_MOODS: Array<{ keys: RegExp; mood: Mood }> = [
  {
    keys: /fantasy|märchen|saga/i,
    mood: {
      mood: "epic, mythic wonder",
      palette: "deep indigo and gold with ember accents",
      lighting: "dramatic rim light, misty volumetric glow",
    },
  },
  {
    keys: /thriller|spannung/i,
    mood: {
      mood: "tense, urgent suspense",
      palette: "charcoal black with blood-red accent",
      lighting: "hard side light, deep shadows, single sharp highlight",
    },
  },
  {
    keys: /krimi|crime|mord/i,
    mood: {
      mood: "noir mystery, moral ambiguity",
      palette: "desaturated slate blue with sodium-lamp amber",
      lighting: "low-key chiaroscuro, venetian blind shadows",
    },
  },
  {
    keys: /romance|liebe/i,
    mood: {
      mood: "tender, emotional warmth",
      palette: "dusty rose, cream and muted teal",
      lighting: "soft golden hour backlight, gentle bokeh",
    },
  },
  {
    keys: /horror|grusel/i,
    mood: {
      mood: "creeping dread, uncanny stillness",
      palette: "near-black with sickly green undertone",
      lighting: "single flickering source, heavy negative space",
    },
  },
  {
    keys: /science[- ]?fiction|sci-?fi|space/i,
    mood: {
      mood: "vast, awe-struck technological sublime",
      palette: "cold cyan and steel with violet nebula accents",
      lighting: "cold key light, holographic glow, deep space ambience",
    },
  },
  {
    keys: /historisch|historical|antike/i,
    mood: {
      mood: "period-authentic gravitas",
      palette: "sepia, aged parchment and faded burgundy",
      lighting: "window light, painterly old-master falloff",
    },
  },
  {
    keys: /sachbuch|ratgeber|non-?fiction|selbsthilfe|self-?help/i,
    mood: {
      mood: "clear, authoritative, aspirational",
      palette: "clean white, bold single accent color",
      lighting: "bright even studio light, minimal shadows",
    },
  },
];

const DARK_WORDS = /tod|tot|verlust|schatten|angst|krieg|grab|dunkel|verschwinde/i;
const LIGHT_WORDS = /freude|hoffnung|frühling|garten|licht|glück|liebe|mut/i;

/**
 * Bestimmt Stimmung/Palette/Licht aus Genre + Themes.
 * Unbekanntes Genre: Heuristik über dunkle/helle Theme-Wörter.
 */
export function inferMood(genre: string, themes: string[] = []): Mood {
  for (const g of GENRE_MOODS) {
    if (g.keys.test(genre)) return g.mood;
  }
  const joined = themes.join(" ");
  if (DARK_WORDS.test(joined)) {
    return {
      mood: "somber, melancholic depth",
      palette: "muted charcoal with cold blue undertone",
      lighting: "dim ambient light, long shadows",
    };
  }
  if (LIGHT_WORDS.test(joined)) {
    return {
      mood: "warm, hopeful, uplifting",
      palette: "sunlit cream with warm coral accent",
      lighting: "soft natural light, airy openness",
    };
  }
  return {
    mood: "atmospheric, inviting depth",
    palette: "rich complementary tones with single accent",
    lighting: "cinematic key light with soft falloff",
  };
}

// --- Stil-Spuren --------------------------------------------------------------

interface StyleTrack {
  style: string;
  visual: string;
  rationale: string;
}

const STYLE_TRACKS: StyleTrack[] = [
  {
    style: "cinematic photographic",
    visual:
      "cinematic photographic key art, shallow depth of field, 85mm lens, movie-poster composition",
    rationale: "Hauptvariante: filmische Marktbildsprache, hoher Wiedererkennungswert im Shop.",
  },
  {
    style: "symbolic object",
    visual:
      "single symbolic hero object centered on negative space, sculptural studio lighting, macro detail",
    rationale: "Iconisches Einzelobjekt — bleibt bis in kleinste Thumbnail-Größe lesbar.",
  },
  {
    style: "silhouette figure",
    visual:
      "lone figure in silhouette against a vast atmospheric backdrop, scale contrast, backlit haze",
    rationale: "Menschlicher Fokus + Landschaft: Genre-Signal durch Stimmung statt Details.",
  },
  {
    style: "illustrated",
    visual:
      "richly detailed digital illustration, painterly textures, layered foreground-midground-background, art-station quality",
    rationale: "Illustrative Variante für Genre-Publikum, differenziert vom Fotomarkt.",
  },
  {
    style: "minimalist",
    visual:
      "minimalist graphic design, flat two-tone composition, single elegant motif, generous negative space",
    rationale: "Reduzierte Premium-Variante — hebt sich im Genre-Raster ab.",
  },
];

const BASE_NEGATIVE =
  "text, letters, words, typography, watermark, logo, signature, blurry, low contrast, cluttered, deformed anatomy, extra limbs, frame, border";

// --- Prompt-Bau ---------------------------------------------------------------

const COMPOSITION_BASE =
  "professional book cover composition, single focal point, clear title area in upper third, rule of thirds, readable at thumbnail size";

function engineSuffix(engine: CoverPromptEngine): string {
  if (engine === "midjourney") {
    return " --ar 2:3 --style raw --v 6";
  }
  return ""; // SD: Aspect Ratio wird im UI/Renderer gesetzt, Negative separat.
}

/**
 * Erzeugt 3-5 detaillierte Cover-Prompts aus der Buch-Zusammenfassung.
 *
 * @param input  Titel, finale Zusammenfassung (Summarizer-Output), Genre
 * @param options count (3-5, geclampt), engine (midjourney|stable-diffusion)
 */
export function generateCoverPrompts(
  input: CoverPromptInput,
  options: CoverPromptOptions = {},
): CoverPrompt[] {
  const count = Math.min(5, Math.max(3, options.count ?? 5));
  const engine = options.engine ?? "midjourney";

  const themes = extractThemes(input.summary, 8);
  const mood = inferMood(input.genre, themes);
  const motifCore =
    themes.length > 0
      ? themes.slice(0, 3).join(", ")
      : `${input.genre} themed focal element`;

  const genreLine = `${input.genre}`;
  const audienceLine = input.targetAudience
    ? `target audience: ${input.targetAudience}, genre-correct visual language`
    : "genre-correct visual language";

  const languagePrefix =
    input.language === "de"
      ? `Buchcover für "${input.title}". `
      : `Book cover for "${input.title}". `;

  const tracks = STYLE_TRACKS.slice(0, count);

  return tracks.map((track, i) => {
    const body = [
      `${languagePrefix}A ${track.style} ${genreLine} book cover.`,
      `SUBJECT: ${motifCore}${input.extraMotifs?.length ? `, ${input.extraMotifs.join(", ")}` : ""}`,
      `COMPOSITION: ${track.visual}, ${COMPOSITION_BASE}`,
      `LIGHTING: ${mood.lighting}`,
      `MOOD: ${mood.mood}`,
      `PALETTE: ${mood.palette}`,
      `MARKET: ${audienceLine}, Amazon-KDP thumbnail optimization`,
      `TITLE AREA: reserved clean space for the title, no rendered text`,
      input.subtitle ? `SUBTITLE: "${input.subtitle}" as smaller secondary line` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const fullPrompt =
      engine === "midjourney"
        ? `${body}\nTitle: "${input.title}"${engineSuffix(engine)}`
        : `${body}\nTitle: "${input.title}"`;

    return {
      variant: i + 1,
      style: track.style,
      fullPrompt,
      negativePrompt:
        engine === "stable-diffusion"
          ? `${BASE_NEGATIVE}, ${mood.palette.split(" ").slice(0, 2).join(" ")} oversaturation`
          : BASE_NEGATIVE,
      rationale: `${track.rationale} Stimmung: ${mood.mood}.`,
    };
  });
}

