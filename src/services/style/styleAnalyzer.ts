// StyleAnalyzer-Engine (Sprint 22, Agent 6): Stil-Metriken + Autoren-Vergleich.
//
// Rein deterministisch, keine LLM-Abhaengigkeit, keine neuen Dependencies.
// Ergaenzt `styleGuide.ts` (Basis-Stilanalyse) um den Vergleich mit
// bekannten Autoren-Profilen.

export interface StyleProfile {
  author: string;
  period: string;
  avgSentenceLength: number;
  vocabularyRichness: number; // Type-Token-Ratio, 0..1
  dialogueRatio: number; // 0..1
  descriptionRatio: number; // 0..1
  commonWords: string[];
  signaturePhrases: string[];
  pacing: "slow" | "medium" | "fast";
}

export interface AuthorComparison {
  author: string;
  similarity: number; // 0..100 (Prozent)
  profile: StyleProfile;
}

export interface StyleComparison {
  textProfile: StyleProfile;
  comparisons: AuthorComparison[];
  verdict: string;
}

// ---------------------------------------------------------------------------
// Vordefinierte Autoren-Profile (10). Die Kennzahlen sind stilisierte,
// redaktionsseitig festgelegte Referenzwerte (keine Korpus-Messung) und
// dienen als Vergleichsanker, nicht als literaturwissenschaftliche Aussage.
// ---------------------------------------------------------------------------

export const AUTHOR_PROFILES: StyleProfile[] = [
  {
    author: "Ernest Hemingway",
    period: "1920–1960",
    avgSentenceLength: 9,
    vocabularyRichness: 0.42,
    dialogueRatio: 0.35,
    descriptionRatio: 0.25,
    commonWords: ["und", "sagte", "ging", "sah", "gut"],
    signaturePhrases: ["Er sagte nichts", "Es war gut"],
    pacing: "fast",
  },
  {
    author: "Virginia Woolf",
    period: "1915–1941",
    avgSentenceLength: 24,
    vocabularyRichness: 0.62,
    dialogueRatio: 0.08,
    descriptionRatio: 0.75,
    commonWords: ["moment", "light", "time", "life", "mind"],
    signaturePhrases: ["the moment", "life itself"],
    pacing: "slow",
  },
  {
    author: "Franz Kafka",
    period: "1912–1924",
    avgSentenceLength: 18,
    vocabularyRichness: 0.55,
    dialogueRatio: 0.15,
    descriptionRatio: 0.55,
    commonWords: ["tür", "mann", "plötzlich", "angst", "zimmer"],
    signaturePhrases: ["Eines Morgens", "Es war, als ob"],
    pacing: "medium",
  },
  {
    author: "Thomas Mann",
    period: "1901–1955",
    avgSentenceLength: 28,
    vocabularyRichness: 0.58,
    dialogueRatio: 0.12,
    descriptionRatio: 0.7,
    commonWords: ["zeit", "geist", "leben", "bürger", "kunst"],
    signaturePhrases: ["Die Zeit", "Bekanntlich"],
    pacing: "slow",
  },
  {
    author: "Edgar Wallace",
    period: "1905–1932",
    avgSentenceLength: 12,
    vocabularyRichness: 0.48,
    dialogueRatio: 0.4,
    descriptionRatio: 0.4,
    commonWords: ["nacht", "tür", "schrei", "mann", "polizei"],
    signaturePhrases: ["Plötzlich", "In diesem Augenblick"],
    pacing: "fast",
  },
  {
    author: "Stefan Zweig",
    period: "1901–1942",
    avgSentenceLength: 20,
    vocabularyRichness: 0.6,
    dialogueRatio: 0.18,
    descriptionRatio: 0.6,
    commonWords: ["seele", "herz", "leidenschaft", "schicksal", "gefühl"],
    signaturePhrases: ["Zum ersten Mal", "Mit einem Mal"],
    pacing: "medium",
  },
  {
    author: "Bertolt Brecht",
    period: "1922–1956",
    avgSentenceLength: 10,
    vocabularyRichness: 0.45,
    dialogueRatio: 0.3,
    descriptionRatio: 0.3,
    commonWords: ["herr", "sagt", "frage", "antwort", "leute"],
    signaturePhrases: ["Herr K.", "Was sind das"],
    pacing: "fast",
  },
  {
    author: "Ingeborg Bachmann",
    period: "1953–1973",
    avgSentenceLength: 16,
    vocabularyRichness: 0.63,
    dialogueRatio: 0.1,
    descriptionRatio: 0.65,
    commonWords: ["nacht", "wort", "schweigen", "liebe", "tod"],
    signaturePhrases: ["Die Wahrheit", "Kein Wort"],
    pacing: "medium",
  },
  {
    author: "Max Frisch",
    period: "1943–1991",
    avgSentenceLength: 13,
    vocabularyRichness: 0.52,
    dialogueRatio: 0.28,
    descriptionRatio: 0.45,
    commonWords: ["frage", "bildnis", "erfahrung", "zeit", "ich"],
    signaturePhrases: ["Man mache sich", "Ich stelle mir vor"],
    pacing: "medium",
  },
  {
    author: "Friedrich Dürrenmatt",
    period: "1947–1990",
    avgSentenceLength: 15,
    vocabularyRichness: 0.54,
    dialogueRatio: 0.32,
    descriptionRatio: 0.5,
    commonWords: ["welt", "zufall", "spiel", "richter", "mord"],
    signaturePhrases: ["Die Welt", "Was einmal gedacht"],
    pacing: "medium",
  },
];

const clamp01 = (v: number): number =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;

function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-zäöüß]+(?:['’][a-zäöüß]+)?/g) ?? []
  );
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?…]+["»”)]?/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function topWords(tokens: string[], count: number): string[] {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 4) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([w]) => w);
}

function topBigrams(tokens: string[], count: number): string[] {
  const freq = new Map<string, number>();
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a.length < 3 || b.length < 3) continue;
    const key = `${a} ${b}`;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([w]) => w);
}

// ---------------------------------------------------------------------------
// analyzeStyle: berechnet das Stil-Profil eines beliebigen Textes.
// Leerer Text ergibt ein neutrales Null-Profil (keine Division durch Null).
// ---------------------------------------------------------------------------

export function analyzeStyle(text: string): StyleProfile {
  const tokens = tokenize(text);
  const sentences = splitSentences(text);

  if (tokens.length === 0) {
    return {
      author: "Eigener Text",
      period: "Gegenwart",
      avgSentenceLength: 0,
      vocabularyRichness: 0,
      dialogueRatio: 0,
      descriptionRatio: 0,
      commonWords: [],
      signaturePhrases: [],
      pacing: "medium",
    };
  }

  const avgSentenceLength =
    sentences.length > 0 ? tokens.length / sentences.length : tokens.length;

  const unique = new Set(tokens).size;
  const vocabularyRichness = clamp01(unique / tokens.length);

  // Dialog-Anteil: Zeichen in Anführungszeichen + Dialogstrich-Zeilen.
  let dialogueChars = 0;
  const quoted = text.match(/[„“"»«'‘’]([^„“"»«'‘’]{1,500})[„“"»«'‘’]/g) ?? [];
  for (const q of quoted) dialogueChars += q.length;
  const dashLines = text
    .split(/\n/)
    .filter((l) => /^\s*[–—-]/.test(l))
    .join("").length;
  dialogueChars += dashLines;
  const dialogueRatio = clamp01(dialogueChars / Math.max(1, text.length));

  // Beschreibungs-Anteil: lange Wörter + Komma-Dichte als Heuristik.
  const longWords = tokens.filter((t) => t.length > 6).length;
  const commas = (text.match(/,/g) ?? []).length;
  const commaPerSentence = sentences.length > 0 ? commas / sentences.length : 0;
  const descriptionRatio = clamp01(
    (longWords / tokens.length) * 1.4 + commaPerSentence * 0.08,
  );

  const pacing: StyleProfile["pacing"] =
    avgSentenceLength < 11 ? "fast" : avgSentenceLength < 21 ? "medium" : "slow";

  return {
    author: "Eigener Text",
    period: "Gegenwart",
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    vocabularyRichness: Math.round(vocabularyRichness * 1000) / 1000,
    dialogueRatio: Math.round(dialogueRatio * 1000) / 1000,
    descriptionRatio: Math.round(descriptionRatio * 1000) / 1000,
    commonWords: topWords(tokens, 5),
    signaturePhrases: topBigrams(tokens, 3),
    pacing,
  };
}

// ---------------------------------------------------------------------------
// Ähnlichkeit: gewichtete Merkmalsdistanz, normiert auf 0..100 Prozent.
// ---------------------------------------------------------------------------

function similarityScore(a: StyleProfile, b: StyleProfile): number {
  const sentence = 1 - Math.min(1, Math.abs(a.avgSentenceLength - b.avgSentenceLength) / 25);
  const vocab = 1 - Math.abs(a.vocabularyRichness - b.vocabularyRichness);
  const dialogue = 1 - Math.abs(a.dialogueRatio - b.dialogueRatio);
  const description = 1 - Math.abs(a.descriptionRatio - b.descriptionRatio);
  const pace = a.pacing === b.pacing ? 1 : 0.5;
  const score =
    sentence * 0.3 + vocab * 0.25 + dialogue * 0.15 + description * 0.15 + pace * 0.15;
  return Math.round(clamp01(score) * 1000) / 10;
}

function findProfile(author: string): StyleProfile {
  const norm = author.trim().toLowerCase();
  const found = AUTHOR_PROFILES.find((p) => p.author.toLowerCase() === norm);
  if (!found) {
    throw new Error(
      `Unbekannter Autor: "${author}". Verfügbar: ${getAvailableAuthors().join(", ")}`,
    );
  }
  return found;
}

export function getAvailableAuthors(): string[] {
  return AUTHOR_PROFILES.map((p) => p.author);
}

export function compareToAuthor(text: string, author: string): StyleComparison {
  const textProfile = analyzeStyle(text);
  const profile = findProfile(author);
  const similarity = similarityScore(textProfile, profile);
  return {
    textProfile,
    comparisons: [{ author: profile.author, similarity, profile }],
    verdict: `Am ähnlichsten: ${profile.author} (${similarity} % Ähnlichkeit).`,
  };
}

export function compareToManyAuthors(
  text: string,
  authors: string[],
): StyleComparison[] {
  return authors.map((a) => compareToAuthor(text, a));
}

/** Vergleicht gegen alle Profile, absteigend nach Ähnlichkeit sortiert. */
export function compareToAllAuthors(text: string): StyleComparison {
  const textProfile = analyzeStyle(text);
  const comparisons: AuthorComparison[] = AUTHOR_PROFILES.map((profile) => ({
    author: profile.author,
    similarity: similarityScore(textProfile, profile),
    profile,
  })).sort((a, b) => b.similarity - a.similarity);
  const best = comparisons[0];
  return {
    textProfile,
    comparisons,
    verdict: best
      ? `Am ähnlichsten: ${best.author} (${best.similarity} % Ähnlichkeit).`
      : "Kein Vergleich möglich.",
  };
}
