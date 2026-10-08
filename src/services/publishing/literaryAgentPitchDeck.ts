// LiteraryAgentPitchDeck (WP 103.2)
// Agentur-Pitch-Deck & Query-Letter-Studio.
// Branchen-Query-Letter (250 Wörter), Comp-Title-Finder, 1-Klick-Einreichungs-Dossier.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type GenreId =
  | "literaryFiction"
  | "thriller"
  | "fantasy"
  | "scienceFiction"
  | "historicalFiction"
  | "romance";

export interface GenreProfile {
  id: GenreId;
  label: string;
  /** Erwartete Wortzahl-Bandbreite (Normseite ≈ 1.800 Zeichen). */
  wordRange: [number, number];
  compPool: string[];
}

export const GENRE_PROFILES: GenreProfile[] = [
  {
    id: "literaryFiction",
    label: "Literarische Fiktion",
    wordRange: [70000, 110000],
    compPool: [
      "„Normal People“ von Sally Rooney",
      "„Klara und die Sonne“ von Kazuo Ishiguro",
      "„Ein wenig Leben“ von Hanya Yanagihara",
      "„Der Leuchtturm“ von Virginia Woolf",
    ],
  },
  {
    id: "thriller",
    label: "Thriller",
    wordRange: [80000, 120000],
    compPool: [
      "„Gone Girl“ von Gillian Flynn",
      "„The Silent Patient“ von Alex Michaelides",
      "„Der Schwarm“ von Frank Schätzing",
      "„Verity“ von Colleen Hoover",
    ],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    wordRange: [90000, 150000],
    compPool: [
      "„Der Name des Windes“ von Patrick Rothfuss",
      "„Das Lied der Krähen“ von Leigh Bardugo",
      "„Die Lügen des Locke Lamora“ von Scott Lynch",
      "„Circe“ von Madeline Miller",
    ],
  },
  {
    id: "scienceFiction",
    label: "Science-Fiction",
    wordRange: [80000, 130000],
    compPool: [
      "„Projekt Hail Mary“ von Andy Weir",
      "„Die drei Sonnen“ von Cixin Liu",
      "„Exhalation“ von Ted Chiang",
      "„Children of Time“ von Adrian Tchaikovsky",
    ],
  },
  {
    id: "historicalFiction",
    label: "Historischer Roman",
    wordRange: [90000, 160000],
    compPool: [
      "„Das Lied der Krähen“ von Bernard Cornwell",
      "„Alles Licht, das wir nicht sehen“ von Anthony Doerr",
      "„Die Kathedrale des Meeres“ von Ildefonso Falcones",
      "„Wolfszeit“ von Harald Jähner",
    ],
  },
  {
    id: "romance",
    label: "Romance",
    wordRange: [65000, 95000],
    compPool: [
      "„Beach Read“ von Emily Henry",
      "„The Hating Game“ von Sally Thorne",
      "„Book Lovers“ von Emily Henry",
      "„Das Beste in uns“ von Colleen Hoover",
    ],
  },
];

export function getGenreProfile(id: GenreId): GenreProfile | undefined {
  return GENRE_PROFILES.find((g) => g.id === id);
}

export interface ManuscriptMeta {
  title: string;
  genre: GenreId;
  wordCount: number;
  protagonist: string;
  antagonist: string;
  setting: string;
  centralConflict: string;
  authorName: string;
  authorBio: string;
  targetAudience: string;
}

export interface CompTitleResult {
  titles: string[];
  rationale: string;
}

export function findCompTitles(genre: GenreId, count: number = 2, seed: number = 42): CompTitleResult {
  const profile = getGenreProfile(genre) || GENRE_PROFILES[0];
  const rng = createSeededRandom(hashString(`comp:${genre}:${seed}`));
  const pool = [...profile.compPool];
  const chosen: string[] = [];
  const total = Math.max(1, Math.min(count, pool.length));
  while (chosen.length < total) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return {
    titles: chosen,
    rationale: `Für Leser von ${chosen.join(" und ")} — vergleichbare Marktposition im Genre ${profile.label}.`,
  };
}

export interface QueryLetter {
  genre: GenreId;
  hook: string;
  conflictParagraph: string;
  compsParagraph: string;
  bioParagraph: string;
  callToAction: string;
  fullText: string;
  wordCount: number;
}

const HOOK_TEMPLATES = [
  "Als {protagonist} entdeckt, dass {antagonist} die Wahrheit über {setting} verbirgt, bleibt nur eine Nacht, um alles zu verlieren oder alles zu gewinnen.",
  "{protagonist} wollte nur {setting} hinter sich lassen — doch {antagonist} hat andere Pläne, und der Preis ist höher, als {protagonist} je zugeben würde.",
  "In {setting} gilt ein einziges Gesetz: Wer {antagonist} herausfordert, überlebt nur, wenn {protagonist} bereit ist, das Liebste zu opfern.",
];

const CONFLICT_TEMPLATES = [
  "Der Kern des Romans ist {centralConflict}. Was als persönlicher Streit beginnt, wächst zu einer Frage, die {protagonist} nicht mehr allein beantworten kann — und jede Antwort fordert einen neuen Verlust.",
  "Im Zentrum steht {centralConflict}. {protagonist} muss sich zwischen Loyalität und Wahrheit entscheiden, während {antagonist} jeden Schritt vorauszuplanen scheint.",
];

const CTA_TEMPLATES = [
  "Das Manuskript umfasst {words} Wörter und liegt vollständig vor. Ich sende Ihnen gern die ersten fünfzig Seiten sowie ein ausführliches Exposé.",
  "Der Roman ist mit {words} Wörtern abgeschlossen und überarbeitet. Auf Anfrage stelle ich Ihnen die ersten drei Kapitel und eine Kapitelübersicht bereit.",
];

export function generateQueryLetter(meta: ManuscriptMeta, seed: number = 42): QueryLetter {
  const rng = createSeededRandom(hashString(`query:${meta.title}:${meta.authorName}:${seed}`));
  const profile = getGenreProfile(meta.genre) || GENRE_PROFILES[0];
  const comps = findCompTitles(meta.genre, 2, seed);

  const hook = pick(HOOK_TEMPLATES, rng)
    .replace(/\{protagonist\}/g, meta.protagonist)
    .replace(/\{antagonist\}/g, meta.antagonist)
    .replace(/\{setting\}/g, meta.setting);

  const conflictParagraph = pick(CONFLICT_TEMPLATES, rng)
    .replace(/\{centralConflict\}/g, meta.centralConflict)
    .replace(/\{protagonist\}/g, meta.protagonist)
    .replace(/\{antagonist\}/g, meta.antagonist);

  const compsParagraph = `${comps.rationale} Wie dort steht auch hier ${meta.targetAudience} im Zentrum.`;

  const bioParagraph = `${meta.authorName}: ${meta.authorBio}`;

  const callToAction = pick(CTA_TEMPLATES, rng).replace(/\{words\}/g, meta.wordCount.toLocaleString("de-DE"));

  const fullText = [
    `Betreff: Manuskript-Angebot „${meta.title}“ (${profile.label}, ${meta.wordCount.toLocaleString("de-DE")} Wörter)`,
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    hook,
    "",
    conflictParagraph,
    "",
    compsParagraph,
    "",
    bioParagraph,
    "",
    callToAction,
    "",
    "Mit freundlichen Grüßen",
    meta.authorName,
  ].join("\n");

  const wordCount = fullText.split(/\s+/).filter((w) => w.length > 0).length;
  return {
    genre: meta.genre,
    hook,
    conflictParagraph,
    compsParagraph,
    bioParagraph,
    callToAction,
    fullText,
    wordCount,
  };
}

export interface NormPageCheck {
  valid: boolean;
  wordCount: number;
  expectedRange: [number, number];
  deviation: string;
}

/** Prüft die Wortzahl gegen die Genre-Bandbreite (Normseiten-Konvention). */
export function checkNormPageConformity(meta: ManuscriptMeta): NormPageCheck {
  const profile = getGenreProfile(meta.genre) || GENRE_PROFILES[0];
  const [min, max] = profile.wordRange;
  const valid = meta.wordCount >= min && meta.wordCount <= max;
  let deviation = "innerhalb der Genre-Bandbreite";
  if (meta.wordCount < min) deviation = `${min - meta.wordCount} Wörter unter der Mindestlänge`;
  else if (meta.wordCount > max) deviation = `${meta.wordCount - max} Wörter über der Höchstlänge`;
  return { valid, wordCount: meta.wordCount, expectedRange: profile.wordRange, deviation };
}

export interface SubmissionDossier {
  id: string;
  title: string;
  genreLabel: string;
  queryLetter: QueryLetter;
  comps: CompTitleResult;
  normPage: NormPageCheck;
  attachments: string[];
  emailTemplate: string;
  pdfOutline: string[];
}

export function buildSubmissionDossier(meta: ManuscriptMeta, seed: number = 42): SubmissionDossier {
  const profile = getGenreProfile(meta.genre) || GENRE_PROFILES[0];
  const queryLetter = generateQueryLetter(meta, seed);
  const comps = findCompTitles(meta.genre, 2, seed);
  const normPage = checkNormPageConformity(meta);

  const attachments = [
    `Normseite — erste 3 Kapitel (${Math.round(meta.wordCount * 0.15).toLocaleString("de-DE")} Wörter)`,
    "Exposé (2 Seiten, Kapitelübersicht)",
    "Autoren-Biografie (Kurzform, 120 Wörter)",
    "Synopse mit Auflösung (vertraulich)",
  ];

  const emailTemplate = [
    `An: agentur@example-verlag.de`,
    `Betreff: Manuskript-Angebot „${meta.title}“ — ${profile.label}`,
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    "anbei erhalten Sie mein Manuskript-Angebot mit den folgenden Anlagen:",
    ...attachments.map((a, i) => `  ${i + 1}. ${a}`),
    "",
    "Über eine Rückmeldung innerhalb der üblichen acht Wochen freue ich mich sehr.",
    "",
    "Mit freundlichen Grüßen",
    meta.authorName,
  ].join("\n");

  const pdfOutline = [
    "Deckblatt: Titel, Genre, Wortzahl, Kontaktdaten",
    "Query Letter (250-Wörter-Pitch)",
    "Comp-Title-Positionierung",
    "Autoren-Biografie",
    "Exposé mit Kapitelübersicht",
    "Leseprobe (Normseite, 1,5-zeilig, 12 pt)",
  ];

  return {
    id: `DOSS-${hashString(`${meta.title}:${meta.authorName}:${meta.genre}`).toString(16).padStart(8, "0").toUpperCase()}`,
    title: meta.title,
    genreLabel: profile.label,
    queryLetter,
    comps,
    normPage,
    attachments,
    emailTemplate,
    pdfOutline,
  };
}

export function createSampleManuscriptMeta(): ManuscriptMeta {
  return {
    title: "Das Zwölfgestirn",
    genre: "fantasy",
    wordCount: 118000,
    protagonist: "Lyra Falkenstein",
    antagonist: "Der Verwalter Kress",
    setting: "den Nebelmarschen",
    centralConflict: "Loyalität gegen Wahrheit",
    authorName: "Erik Gieske",
    authorBio: "schreibt seit fünfzehn Jahren fantastische Romane und lebt in Norddeutschland.",
    targetAudience: "erwachsene Fantasy-Leserinnen und -Leser",
  };
}

export function createSampleSubmissionDossier(): SubmissionDossier {
  return buildSubmissionDossier(createSampleManuscriptMeta(), 42);
}
