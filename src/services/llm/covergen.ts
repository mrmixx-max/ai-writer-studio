// Cover-Generator: Prompt-Optimizer für Buchcover.
//
// Baut aus kurzen User-Eingaben einen professionellen Master-Prompt
// mit allen bewährten Cover-Prompting-Tricks. Optimiert je nach
// Genre, Zielmarkt, Provider und Format.

import type { ImageProviderId } from "@/services/llm/image";

// --- Types ---

export type CoverVariant = "commercial" | "bold" | "minimalist";

export type CoverTarget = "ebook" | "paperback" | "hardcover" | "ad-square" | "promo-wide";

export type CoverStyle =
  | "photo-real"
  | "illustrated"
  | "painted"
  | "minimal"
  | "typographic"
  | "cinematic";

export interface CoverGenInput {
  title: string;
  subtitle?: string;
  authorName?: string;
  genre: string;
  subgenre?: string;
  tropes?: string;
  target: CoverTarget;
  mood?: string;
  motifs?: string;
  setting?: string;
  figureDescription?: string;
  colorPalette?: string;
  typographyStyle?: string;
  negativeMotifs?: string;
  coverStyle?: CoverStyle;
  language?: string;
  provider: ImageProviderId;
}

export interface CoverWarning {
  code: string;
  message: string;
}

export interface OptimizedCoverPrompt {
  fullPrompt: string;
  providerOptimizedPrompt: string;
  negativePrompt: string;
  shortRationale: string;
  warnings: CoverWarning[];
}

// --- Genre Hints ---

const GENRE_HINTS: Record<string, string> = {
  "science fiction":
    "cinematic light, futuristic forms, atmospheric depth, neon accents, vast scale, technological elegance",
  thriller:
    "high contrast, tension, ominous atmosphere, bold title area, sharp shadows, urgent mood",
  crime:
    "urban noir, mystery cues, restrained palette, dramatic lighting, moral ambiguity, tension",
  romance:
    "emotional focal point, soft light, intimate composition, warm tones, tender connection",
  fantasy:
    "epic scale, symbolic object, dramatic environment, magical atmosphere, rich detail, mythic resonance",
  horror:
    "deep shadows, unsettling atmosphere, visceral tension, dark palette, dread, uncanny elements",
  "historical fiction":
    "period authenticity, textured atmosphere, muted elegance, temporal depth, rich historical detail",
  nonfiction:
    "clarity, authority, strong hierarchy, clean focal object, professional composition, confident tone",
  biography:
    "dignified portraiture, legacy atmosphere, timeless quality, warm gravitas, human depth",
  selfhelp:
    "uplifting clarity, aspirational tone, clean modern aesthetic, empowering focal point",
  sachbuch:
    "Sachbuch-Klarheit, Autorität, starke Hierarchie, sauberes Fokusobjekt, professionelle Komposition",
  ratgeber:
    "klare Struktur, handfester Nutzen, vertrauenswürdige Ästhetik, motivierender Fokus",
  roman:
    "literarische Atmosphäre, emotionale Tiefe, charaktergetrieben, stimmungsvoll, erzählerische Dichte",
  krimi:
    "urbanes Noir, Mystery-Cues, zurückhaltene Palette, dramatische Beleuchtung, Spannung",
};

function buildGenreHints(genre: string): string {
  const key = genre.toLowerCase().trim();
  return GENRE_HINTS[key] ?? `${genre} genre aesthetics, genre-appropriate visual language`;
}

// --- Market Hints ---

const MARKET_HINTS: Record<CoverTarget, string> = {
  ebook:
    "thumbnail-readable composition, strong silhouette, clear focal point, Amazon KDP optimized, readable at small size, high contrast title zone",
  paperback:
    "print-ready composition, spine-aware layout, professional barcode area, physical book proportions, tactile quality",
  hardcover:
    "premium hardcover aesthetic, dust jacket worthy, elegant foil-stamp ready, collectible quality, upscale presentation",
  "ad-square":
    "square ad format, social media optimized, scroll-stopping composition, bold visual impact, instant readability",
  "promo-wide":
    "wide promotional format, banner-ready, cinematic aspect ratio, atmospheric depth, brand-forward composition",
};

function buildMarketHints(target: CoverTarget): string {
  return MARKET_HINTS[target] ?? "";
}

// --- Provider Hints ---

function buildProviderHints(provider: ImageProviderId): string {
  switch (provider) {
    case "openai-dalle":
      return "natural language art direction, precise descriptive flow, nuanced style references, cinematic composition";
    case "openrouter-flux":
      return "visually dense prompt structure, style-heavy descriptors, layered atmospheric cues, strong artistic direction";
    case "sd-webui":
      return "compact weighted descriptors, clear subject priority, sharp focus emphasis, clean style markers";
  }
}

// --- Quality Safeguards ---

const BASE_NEGATIVE =
  "blurry, unreadable text, cluttered composition, low contrast, extra fingers, duplicate objects, watermark, logo, frame, ugly, deformed";

// --- Analysis ---

export function analyzeCoverInput(input: CoverGenInput): CoverWarning[] {
  const warnings: CoverWarning[] = [];

  // Title too long
  if (input.title.length > 40) {
    warnings.push({
      code: "title-too-long",
      message: `Titel hat ${input.title.length} Zeichen. Ideal: unter 40 für gute Lesbarkeit.`,
    });
  }

  // Too many motifs
  if (input.motifs && input.motifs.split(/[,;]/).length > 4) {
    warnings.push({
      code: "too-many-motives",
      message: "Zu viele Motive. Reduzieren auf 1–2 zentrale für mehr Wirkung.",
    });
  }

  // No clear focus
  if (!input.motifs && !input.figureDescription && !input.setting) {
    warnings.push({
      code: "no-clear-focus",
      message: "Kein klares Motiv/Figur/Setting. Ein starker Fokus verbessert das Cover.",
    });
  }

  // Weak genre signal
  if (!input.genre.trim()) {
    warnings.push({
      code: "no-genre",
      message: "Genre fehlt. Genre-Signale machen das Cover erkennbarer.",
    });
  }

  // Thumbnail concerns
  if (input.target === "ebook" && input.subtitle && input.subtitle.length > 30) {
    warnings.push({
      code: "subtitle-too-long-thumbnail",
      message: "Untertitel zu lang fürThumbnail-Lesbarkeit. Kurz und prägnant.",
    });
  }

  return warnings;
}

// --- Core Optimization ---

export function optimizeCoverPrompt(input: CoverGenInput): OptimizedCoverPrompt {
  const warnings = analyzeCoverInput(input);
  const genreHints = buildGenreHints(input.genre);
  const marketHints = buildMarketHints(input.target);
  const providerHints = buildProviderHints(input.provider);

  // Subject prompt
  const subjectParts: string[] = [];
  if (input.figureDescription) subjectParts.push(input.figureDescription);
  if (input.motifs) subjectParts.push(input.motifs);
  if (input.setting) subjectParts.push(input.setting);
  const subjectPrompt =
    subjectParts.length > 0
      ? subjectParts.join(", ")
      : `${input.genre} themed focal element`;

  // Composition prompt
  const compositionPrompt =
    "single focal point, foreground-midground-background depth, rule of thirds, safe title area, edge clarity for thumbnail visibility";

  // Typography prompt
  const typographyParts: string[] = ["large readable title zone", "high contrast title placement"];
  if (input.subtitle) typographyParts.push("subtitle smaller");
  if (input.authorName) typographyParts.push("author name balanced");
  if (input.typographyStyle) typographyParts.push(input.typographyStyle);
  const typographyPrompt = typographyParts.join(", ");

  // Lighting prompt
  const lightingParts: string[] = [];
  if (input.mood) lightingParts.push(`${input.mood} mood`);
  if (input.colorPalette) lightingParts.push(input.colorPalette);
  if (input.coverStyle) lightingParts.push(`${input.coverStyle} aesthetic`);
  const lightingPrompt =
    lightingParts.length > 0 ? lightingParts.join(", ") : "professional cover lighting";

  // Market prompt
  const marketPrompt = `${marketHints}, ${genreHints}`;

  // Full prompt assembly
  const languagePrefix =
    input.language === "en" || input.language === "english"
      ? ""
      : input.language === "de"
      ? "Buchcover auf Deutsch. "
      : "Buchcover. ";

  const fullPrompt = `${languagePrefix}A ${input.coverStyle ?? "cinematic"} ${
    input.genre
  } book cover${input.subtitle ? ` – subtitle: "${input.subtitle}"` : ""}.

SUBJECT: ${subjectPrompt}
COMPOSITION: ${compositionPrompt}
TYPOGRAPHY: ${typographyPrompt}
LIGHTING: ${lightingPrompt}
MARKET: ${marketPrompt}
STYLE: ${providerHints}

Title: "${input.title}"${input.authorName ? ` | Author: ${input.authorName}` : ""}`;

  // Provider-optimized prompt
  const providerOptimizedPrompt = buildProviderSpecificPrompt(
    fullPrompt,
    input.provider,
  );

  // Negative prompt
  const negativeParts: string[] = [BASE_NEGATIVE];
  if (input.negativeMotifs) negativeParts.push(input.negativeMotifs);
  const negativePrompt = negativeParts.join(", ");

  // Short rationale
  const shortRationale = `Genre: ${input.genre}, Target: ${input.target}, Style: ${
    input.coverStyle ?? "cinematic"
  }, Provider: ${input.provider}`;

  return {
    fullPrompt,
    providerOptimizedPrompt,
    negativePrompt,
    shortRationale,
    warnings,
  };
}

function buildProviderSpecificPrompt(
  basePrompt: string,
  provider: ImageProviderId,
): string {
  switch (provider) {
    case "openai-dalle":
      // DALL-E prefers natural language, descriptive flow
      return basePrompt
        .replace(/SUBJECT:/g, "The subject shows")
        .replace(/COMPOSITION:/g, "Composition:")
        .replace(/TYPOGRAPHY:/g, "Typography:")
        .replace(/LIGHTING:/g, "Lighting:")
        .replace(/MARKET:/g, "Market positioning:")
        .replace(/STYLE:/g, "Style direction:");

    case "openrouter-flux":
      // Flux prefers dense, style-heavy descriptors
      return basePrompt
        .replace(/SUBJECT:/g, "SUBJECT –")
        .replace(/COMPOSITION:/g, "COMP –")
        .replace(/TYPOGRAPHY:/g, "TYPE –")
        .replace(/LIGHTING:/g, "LIGHT –")
        .replace(/MARKET:/g, "MARKET –")
        .replace(/STYLE:/g, "STYLE –");

    case "sd-webui":
      // SD WebUI prefers compact, weighted format
      return basePrompt
        .replace(/SUBJECT:/g, "(Subject:1.3)")
        .replace(/COMPOSITION:/g, "(Composition:1.2)")
        .replace(/TYPOGRAPHY:/g, "Typography:")
        .replace(/LIGHTING:/g, "(Lighting:1.1)")
        .replace(/MARKET:/g, "Market:")
        .replace(/STYLE:/g, "(Style:1.2)");
  }
}

// --- Variant Generator ---

export interface CoverVariantResult {
  variant: CoverVariant;
  label: string;
  prompt: string;
}

export function generateVariants(
  input: CoverGenInput,
): CoverVariantResult[] {
  const base = optimizeCoverPrompt(input);

  const variantModifiers: Record<CoverVariant, { label: string; suffix: string }> = {
    commercial: {
      label: "Kommerziell",
      suffix:
        ", mainstream appeal, proven market formula, broad audience, polished commercial aesthetic, bestseller quality",
    },
    bold: {
      label: "Bold",
      suffix:
        ", bold graphic impact, high contrast, oversized focal element, poster-like confidence, aggressive visual punch, attention-grabbing",
    },
    minimalist: {
      label: "Minimal",
      suffix:
        ", minimalist composition, generous whitespace, single refined element, elegant restraint, premium simplicity, sophisticated reduction",
    },
  };

  return (["commercial", "bold", "minimalist"] as CoverVariant[]).map((v) => {
    const mod = variantModifiers[v];
    return {
      variant: v,
      label: mod.label,
      prompt: base.providerOptimizedPrompt + mod.suffix,
    };
  });
}

// --- Quick Adjustments ---

export function sharpenPrompt(prompt: string): string {
  return (
    prompt +
    ", razor sharp focus, hyper-detailed, professional photography quality, studio lighting"
  );
}

export function makeMainstream(prompt: string): string {
  return (
    prompt +
    ", mainstream commercial appeal, proven bestseller aesthetic, broad audience polish"
  );
}

export function makePremium(prompt: string): string {
  return (
    prompt +
    ", premium quality, luxury aesthetic, foil-stamp ready, collectible hardcover worthy"
  );
}

export function makeMoreGenre(prompt: string, genre: string): string {
  const hints = buildGenreHints(genre);
  return prompt + ", " + hints;
}
