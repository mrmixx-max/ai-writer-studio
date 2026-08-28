// Blurb-Generator: Verkaufsoptimierte Klappentexte für Buchmarketing.
//
// Erzeugt Blurbs für Fiction und Nonfiction in verschiedenen Formaten:
// Amazon KDP, Back Cover, Ads, Taglines, Short Hooks.

// --- Types ---

export type BlurbType = "fiction" | "nonfiction";

export type BlurbFormat =
  | "amazon-description"
  | "back-cover"
  | "short-hook"
  | "ad-copy"
  | "series-page";

export type BlurbTone =
  | "commercial"
  | "premium"
  | "emotional"
  | "dark"
  | "fast-paced"
  | "elegant"
  | "authoritative";

export type BlurbVariant = "commercial" | "bold" | "minimalist";

export interface BlurbGenInput {
  title: string;
  subtitle?: string;
  authorName?: string;
  language?: string;
  type: BlurbType;
  genre: string;
  subgenre?: string;
  tropes?: string;
  audience: string;
  format: BlurbFormat;
  tone?: BlurbTone;
  protagonist?: string;
  situation?: string;
  conflict?: string;
  stakes?: string;
  setting?: string;
  uniqueSellingPoint?: string;
  comparableTitles?: string;
  keywords?: string;
  includeCta?: boolean;
  maxWords?: number;
}

export interface BlurbWarning {
  code: string;
  message: string;
}

export interface BlurbResult {
  input: BlurbGenInput;
  shortHook: string;
  taglineOptions: string[];
  shortBlurb: string;
  standardBlurb: string;
  amazonDescription: string;
  backCoverBlurb: string;
  adCopies: string[];
  warnings: BlurbWarning[];
  rationale: string;
}

export interface BlurbVariantResult {
  variant: BlurbVariant;
  label: string;
  blurb: string;
}

// --- Quality Rules ---

// Vermeide leere Superlative und Füllwörter
// Referenz: "eine unvergessliche Reise", "atemberaubend", "spannung bis zur letzten Seite", etc.

// --- Analysis ---

export function analyzeBlurbInput(input: BlurbGenInput): BlurbWarning[] {
  const warnings: BlurbWarning[] = [];

  // Too many names
  const nameMatches = input.conflict?.match(/[A-Z][a-z]+/g) ?? [];
  if (nameMatches.length > 4) {
    warnings.push({
      code: "too-many-names",
      message: `Viele Namen (${nameMatches.length}). Für Blurbs besser: max 2–3 Figuren namentlich erwähnen.`,
    });
  }

  // Too many plot details
  if (input.conflict && input.conflict.length > 300) {
    warnings.push({
      code: "too-many-details",
      message: "Konflikt zu lang. Blurb sollte neugierig machen, nicht den Plot nacherzählen.",
    });
  }

  // No clear conflict
  if (!input.conflict?.trim()) {
    warnings.push({
      code: "no-conflict",
      message: "Kein Konflikt angegeben. Ein starker Konflikt macht den Blurb wirksam.",
    });
  }

  // No clear stakes
  if (!input.stakes?.trim()) {
    warnings.push({
      code: "no-stakes",
      message: "Keine Stakes angegeben. Was steht auf dem Spiel?",
    });
  }

  // Genre too invisible
  if (!input.genre.trim()) {
    warnings.push({
      code: "no-genre",
      message: "Genre fehlt. Genre-Signale helfen Lesern, das Buch einzuordnen.",
    });
  }

  // Hook too weak
  if (input.situation && input.situation.length < 20) {
    warnings.push({
      code: "weak-hook",
      message: "Ausgangssituation zu kurz. Ein starker Hook fängt sofort.",
    });
  }

  // Too vague
  if (input.situation && input.situation.match(/^(es war|es gibt|es ist)/i)) {
    warnings.push({
      code: "too-vague",
      message: "Ausgangssituation zu vage. Konkret und bildhaft formulieren.",
    });
  }

  return warnings;
}

// --- Core Generation ---

export function generateBlurb(input: BlurbGenInput): BlurbResult {
  const warnings = analyzeBlurbInput(input);
  const maxWords = input.maxWords ?? (input.type === "fiction" ? 150 : 180);

  // Build short hook
  const shortHook = buildShortHook(input);

  // Build taglines
  const taglineOptions = buildTaglines(input);

  // Build short blurb
  const shortBlurb = buildShortBlurb(input, maxWords);

  // Build standard blurb
  const standardBlurb = buildStandardBlurb(input, maxWords);

  // Build Amazon description
  const amazonDescription = buildAmazonDescription(input, maxWords);

  // Build back cover blurb
  const backCoverBlurb = buildBackCoverBlurb(input, maxWords);

  // Build ad copies
  const adCopies = buildAdCopies(input);

  // Rationale
  const rationale = `Typ: ${input.type}, Genre: ${input.genre}, Format: ${input.format}, Ton: ${input.tone ?? "commercial"}`;

  return {
    input,
    shortHook,
    taglineOptions,
    shortBlurb,
    standardBlurb,
    amazonDescription,
    backCoverBlurb,
    adCopies,
    warnings,
    rationale,
  };
}

// --- Builders ---

function buildShortHook(input: BlurbGenInput): string {
  const hooks: string[] = [];

  if (input.protagonist && input.conflict) {
    hooks.push(`${input.protagonist} – ${input.conflict}.`);
  }
  if (input.situation && input.stakes) {
    hooks.push(`${input.situation}. Doch ${input.stakes}.`);
  }
  if (input.conflict) {
    hooks.push(input.conflict);
  }

  return hooks[0] ?? `${input.title}: Ein ${input.genre}-Roman, der unter die Haut geht.`;
}

function buildTaglines(input: BlurbGenInput): string[] {
  const taglines: string[] = [];

  if (input.stakes) {
    taglines.push(`${input.title}. ${input.stakes}.`);
  }
  if (input.conflict) {
    taglines.push(`${input.title}. Wo ${input.conflict.toLowerCase()} alles verändert.`);
  }
  taglines.push(`${input.title}. ${input.genre} neu gedacht.`);
  if (input.protagonist) {
    taglines.push(`Für ${input.protagonist} gibt es kein Zurück.`);
  }
  taglines.push(`${input.title}. Nichts ist, wie es scheint.`);

  return taglines.slice(0, 5);
}

function buildShortBlurb(input: BlurbGenInput, maxWords: number): string {
  if (input.type === "fiction") {
    return buildFictionBlurb(input, "short", maxWords);
  }
  return buildNonfictionBlurb(input, "short", maxWords);
}

function buildStandardBlurb(input: BlurbGenInput, maxWords: number): string {
  if (input.type === "fiction") {
    return buildFictionBlurb(input, "standard", maxWords);
  }
  return buildNonfictionBlurb(input, "standard", maxWords);
}

function buildFictionBlurb(
  input: BlurbGenInput,
  length: "short" | "standard",
  maxWords: number,
): string {
  const parts: string[] = [];

  // Hook
  if (input.situation) {
    parts.push(input.situation);
  } else {
    parts.push(`${input.title} – ${input.genre}, die fesselt.`);
  }

  // Protagonist + Conflict
  if (input.protagonist && input.conflict) {
    parts.push(`${input.protagonist} ${input.conflict.toLowerCase()}.`);
  } else if (input.conflict) {
    parts.push(input.conflict);
  }

  // Stakes
  if (input.stakes) {
    parts.push(length === "standard" ? `Doch ${input.stakes}.` : `${input.stakes}.`);
  }

  // Setting
  if (input.setting && length === "standard") {
    parts.push(`In: ${input.setting}.`);
  }

  // Closing line (no resolution!)
  parts.push(buildFictionClosing(input));

  return enforceWordLimit(parts.join(" "), maxWords);
}

function buildNonfictionBlurb(
  input: BlurbGenInput,
  length: "short" | "standard",
  maxWords: number,
): string {
  const parts: string[] = [];

  // Problem / Pain point
  if (input.conflict) {
    parts.push(input.conflict);
  } else {
    parts.push(`${input.title} – ${input.genre}, die verändert.`);
  }

  // Promise / Benefit
  if (input.stakes) {
    parts.push(length === "standard" ? `Dieses Buch zeigt: ${input.stakes}.` : input.stakes);
  }

  // What reader takes away
  if (input.protagonist) {
    parts.push(input.protagonist);
  }

  // USP
  if (input.uniqueSellingPoint && length === "standard") {
    parts.push(input.uniqueSellingPoint);
  }

  // CTA
  if (input.includeCta) {
    parts.push(buildNonfictionClosing(input));
  }

  return enforceWordLimit(parts.join(" "), maxWords);
}

function buildFictionClosing(input: BlurbGenInput): string {
  const closings = [
    `Ein ${input.genre}, das nicht loslässt.`,
    `Wo Spannung auf Sinn trifft.`,
    `Für Leser, die mehr wollen.`,
    `${input.title}. Nichts wird mehr sein, wie es war.`,
  ];
  return closings[Math.floor(Math.random() * closings.length)];
}

function buildNonfictionClosing(input: BlurbGenInput): string {
  const closings = [
    `Jetzt entdecken.`,
    `Das Buch, das verändert.`,
    `Für alle, die bereit sind.`,
    `${input.title}. Ihr nächster Schritt.`,
  ];
  return closings[Math.floor(Math.random() * closings.length)];
}

function buildAmazonDescription(input: BlurbGenInput, _maxWords: number): string {
  const parts: string[] = [];

  // Above-the-fold: Hook + core conflict
  if (input.situation) {
    parts.push(`<p>${input.situation}</p>`);
  }
  if (input.conflict) {
    parts.push(`<p><b>${input.conflict}</b></p>`);
  }
  if (input.stakes) {
    parts.push(`<p>${input.stakes}</p>`);
  }
  if (input.protagonist) {
    parts.push(`<p>${input.protagonist}</p>`);
  }

  // Closing
  parts.push(`<p>${buildFictionClosing(input)}</p>`);

  return parts.join("\n");
}

function buildBackCoverBlurb(input: BlurbGenInput, maxWords: number): string {
  const parts: string[] = [];

  if (input.situation) {
    parts.push(input.situation);
  }
  if (input.conflict) {
    parts.push(input.conflict);
  }
  if (input.stakes) {
    parts.push(input.stakes);
  }
  parts.push(buildFictionClosing(input));

  return enforceWordLimit(parts.join(" "), maxWords);
}

function buildAdCopies(input: BlurbGenInput): string[] {
  return [
    `${input.title}. ${input.genre} neu gedacht. Jetzt entdecken.`,
    `${input.title}. Für Leser, die ${input.genre} lieben.`,
    `${input.title}. ${input.stakes ?? "Nicht loslassend."}`,
  ];
}

// --- Utilities ---

function enforceWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

// --- Variants ---

export function generateBlurbVariants(
  input: BlurbGenInput,
): BlurbVariantResult[] {
  const base = generateBlurb(input);

  const variantModifiers: Record<BlurbVariant, { label: string; suffix: string }> = {
    commercial: {
      label: "Kommerziell",
      suffix: " Mainstream-appeal, bewährte Formel, breite Zielgruppe.",
    },
    bold: {
      label: "Bold",
      suffix: " Zugespitzt, provokant, ungewöhnlich, Aufmerksamkeit sofort.",
    },
    minimalist: {
      label: "Minimal",
      suffix: " Kurz, prägnant, viel Whitespace, elegant reduziert.",
    },
  };

  return (["commercial", "bold", "minimalist"] as BlurbVariant[]).map((v) => {
    const mod = variantModifiers[v];
    return {
      variant: v,
      label: mod.label,
      blurb: base.standardBlurb + mod.suffix,
    };
  });
}

// --- Quick Adjustments ---

export function sharpenBlurb(blurb: string): string {
  return blurb + " Schärfer, prägnanter, zugespitzter.";
}

export function makeBlurbMainstream(blurb: string): string {
  return blurb + " Mainstream-appeal, bewährte Bestseller-Formel.";
}

export function makeBlurbPremium(blurb: string): string {
  return blurb + " Premium-Qualität, anspruchsvoll, literarisch.";
}

export function makeBlurbEmotional(blurb: string): string {
  return blurb + " Emotional, berührend, tiefgründig.";
}

export function makeBlurbMoreGenre(blurb: string, genre: string): string {
  return blurb + ` Starke ${genre}-Signale, genretypische Sprache.`;
}

export function makeBlurbShorter(blurb: string): string {
  const words = blurb.split(/\s+/);
  return words.slice(0, Math.max(5, Math.floor(words.length * 0.6))).join(" ") + ".";
}

// --- KDP Format ---

export function formatKdpDescription(result: BlurbResult): string {
  return result.amazonDescription;
}
