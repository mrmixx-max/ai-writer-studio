// Conlang- & Kunstsprachen-Generator (WP 59.1)
//
// Erzeugt fremdartige Sprachen, die natürlich in Dialoge einfließen, ohne
// unlesbar zu werden — mit Phonologie-Profilen, narrativer Übersetzung und
// einem Lexikon-Gedächtnis, damit ein Wort im ganzen Roman dieselbe
// Bedeutung behält.
//
// Drei deterministische Werkzeuge:
//
//   1. createConlang     — Phonologie-Profil → vollständige Sprache + Lexikon
//   2. translateToConlang — Satz → fremdsprachige Zeile + wörtliche Übersetzung
//   3. lookupWord        — Wort im Lexikon nachschlagen (Bedeutungstreue)
//
// Design-Regeln (analog proseExpander / loreMythGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Phonologie-Charakter der Sprache. */
export type PhonologyProfile = 'guttural' | 'melodic' | 'mechanical';

/** Ein Lexikon-Eintrag. */
export interface LexiconEntry {
  /** Das fremdsprachige Wort. */
  word: string;
  /** Deutsche Bedeutung. */
  meaning: string;
  /** Wortart (grobe Kategorie). */
  category: 'noun' | 'verb' | 'adjective' | 'interjection';
}

/** Eine erzeugte Kunstsprache. */
export interface Conlang {
  /** Name der Sprache. */
  name: string;
  /** Phonologie-Profil. */
  profile: PhonologyProfile;
  /** Verwendete Konsonanten. */
  consonants: string[];
  /** Verwendete Vokale. */
  vowels: string[];
  /** Das Lexikon (Wort → Bedeutung, deterministisch). */
  lexicon: LexiconEntry[];
}

/** Ergebnis einer Übersetzung. */
export interface ConlangPhrase {
  /** Das fremdsprachige Zitat. */
  foreign: string;
  /** Wörtliche Übersetzung. */
  literal: string;
  /** Eingebetteter Erzählsatz mit narrativer Übersetzung. */
  narrative: string;
  /** Verwendete Wörter. */
  words: string[];
  /** Phonologie-Profil. */
  profile: PhonologyProfile;
}

/** Ein Treffer im Lexikon. */
export interface LexiconLookup {
  /** Das gesuchte Wort. */
  word: string;
  /** Gefundene Bedeutung (oder null). */
  meaning: string | null;
  /** true, wenn das Wort im Lexikon steht. */
  known: boolean;
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Phonologie-Profile
// ---------------------------------------------------------------------------

/** Menschenlesbare Profil-Namen. */
export const PROFILE_LABELS: Record<PhonologyProfile, string> = {
  guttural: 'Kehlig / Kriegerisch',
  melodic: 'Fließend / Melodisch',
  mechanical: 'Maschinell / Prägnant',
};

/** Konsonanten je Profil. */
const PROFILE_CONSONANTS: Record<PhonologyProfile, readonly string[]> = {
  guttural: ['k', 'g', 'r', 'kh', 'gr', 'th', 'z', 'v', 'gh', 'dr'],
  melodic: ['l', 'm', 'n', 's', 'th', 'v', 'r', 'y', 'sh', 'n'],
  mechanical: ['k', 't', 'x', 'z', 'p', 'b', 'd', 'q', 'v', 'c'],
};

/** Vokale je Profil. */
const PROFILE_VOWELS: Record<PhonologyProfile, readonly string[]> = {
  guttural: ['a', 'o', 'u', 'ah', 'or'],
  melodic: ['a', 'e', 'i', 'o', 'ae', 'ia', 'ei'],
  mechanical: ['i', 'e', 'o', 'u', 'i'],
};

/** Silbenzahl-Bereich je Profil (min, max). */
const PROFILE_SYLLABLES: Record<PhonologyProfile, [number, number]> = {
  guttural: [1, 3],
  melodic: [2, 4],
  mechanical: [1, 2],
};

// ---------------------------------------------------------------------------
// Grundwortschatz (Bedeutungen, die jede Conlang abdeckt)
// ---------------------------------------------------------------------------

/** Kern-Bedeutungen mit Kategorie — deterministisch zu Wörtern geformt. */
const CORE_VOCABULARY: readonly { meaning: string; category: LexiconEntry['category'] }[] = [
  { meaning: 'Blut', category: 'noun' },
  { meaning: 'Asche', category: 'noun' },
  { meaning: 'Himmel', category: 'noun' },
  { meaning: 'Schwert', category: 'noun' },
  { meaning: 'Nacht', category: 'noun' },
  { meaning: 'Feuer', category: 'noun' },
  { meaning: 'Wasser', category: 'noun' },
  { meaning: 'Stern', category: 'noun' },
  { meaning: 'Tod', category: 'noun' },
  { meaning: 'Leben', category: 'noun' },
  { meaning: 'Ehre', category: 'noun' },
  { meaning: 'Verrat', category: 'noun' },
  { meaning: 'kämpfen', category: 'verb' },
  { meaning: 'sterben', category: 'verb' },
  { meaning: 'fliegen', category: 'verb' },
  { meaning: 'sehen', category: 'verb' },
  { meaning: 'nehmen', category: 'verb' },
  { meaning: 'geben', category: 'verb' },
  { meaning: 'groß', category: 'adjective' },
  { meaning: 'kalt', category: 'adjective' },
  { meaning: 'stark', category: 'adjective' },
  { meaning: 'dunkel', category: 'adjective' },
  { meaning: 'möge', category: 'interjection' },
  { meaning: 'nein', category: 'interjection' },
  { meaning: 'ja', category: 'interjection' },
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Profil defensiv prüfen. */
function normalizeProfile(value: unknown): PhonologyProfile {
  const all: PhonologyProfile[] = ['guttural', 'melodic', 'mechanical'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as PhonologyProfile)
    : 'melodic';
}

/**
 * Baut ein fremdsprachiges Wort aus Silben zusammen.
 * Rein deterministisch über den übergebenen PRNG.
 */
function buildWord(
  profile: PhonologyProfile,
  rand: () => number,
  minSyllables = 1,
): string {
  const consonants = PROFILE_CONSONANTS[profile];
  const vowels = PROFILE_VOWELS[profile];
  const [minS, maxS] = PROFILE_SYLLABLES[profile];
  const syllableCount = Math.max(
    minSyllables,
    minS + Math.floor(rand() * Math.max(1, maxS - minS + 1)),
  );

  let word = '';
  for (let i = 0; i < syllableCount; i++) {
    word += pick(consonants, rand);
    word += pick(vowels, rand);
  }
  // Gelegentlich auf Vokal enden lassen (sprachliche Vielfalt).
  if (rand() < 0.4) word += pick(vowels, rand);
  return word;
}

/** Erste Buchstabe groß. */
function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

// ---------------------------------------------------------------------------
// 1) Conlang-Erzeugung
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine vollständige Kunstsprache mit Lexikon.
 *
 * Das Lexikon wird deterministisch aus dem Sprachnamen abgeleitet — dieselbe
 * Sprache liefert immer dieselben Wörter, wodurch ein erfundenes Wort im
 * gesamten Roman seine Bedeutung behält.
 *
 * Defensiv: ungültige Profile fallen auf `melodic` zurück.
 */
export function createConlang(name?: unknown, profile?: unknown): Conlang {
  const safeName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'Aelith';
  const prof = normalizeProfile(profile);
  const rand = createSeededRandom(hashString(`${safeName}#${prof}`));

  const lexicon: LexiconEntry[] = [];
  const usedWords = new Set<string>();

  for (const entry of CORE_VOCABULARY) {
    let word = buildWord(prof, rand);
    // Kollisionen auflösen, damit jede Bedeutung ein eigenes Wort hat.
    let guard = 0;
    while (usedWords.has(word) && guard < 20) {
      guard++;
      word = buildWord(prof, rand);
    }
    usedWords.add(word);
    lexicon.push({ word, meaning: entry.meaning, category: entry.category });
  }

  return {
    name: safeName,
    profile: prof,
    consonants: [...PROFILE_CONSONANTS[prof]],
    vowels: [...PROFILE_VOWELS[prof]],
    lexicon,
  };
}

// ---------------------------------------------------------------------------
// 2) Übersetzung
// ---------------------------------------------------------------------------

/**
 * Übersetzt einen deutschen Satz in die Kunstsprache.
 *
 * Für jedes erkannte Wort wird das Lexikon herangezogen; unbekannte Wörter
 * erhalten ein neu geformtes, konsistentes Wort. Die narrative Einbettung
 * folgt dem Muster: *„'Khar'ash valok!' zischte sie — Es bedeutete wörtlich: …"*
 *
 * Defensiv: leerer Satz liefert eine leere Phrase.
 */
export function translateToConlang(
  sentence: unknown,
  conlang?: Conlang | null,
  options?: { verb?: string; speaker?: string },
): ConlangPhrase {
  const safeSentence = typeof sentence === 'string' ? sentence.trim() : '';
  const language = conlang && typeof conlang === 'object' && Array.isArray(conlang.lexicon)
    ? conlang
    : createConlang('Aelith', 'melodic');

  if (!safeSentence) {
    return {
      foreign: '',
      literal: '',
      narrative: '',
      words: [],
      profile: language.profile,
    };
  }

  // Wörter des Satzes auf Lexikon-Bedeutungen abbilden.
  const tokens = safeSentence
    .toLowerCase()
    .replace(/[^a-zäöüß\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const words: string[] = [];
  const meanings: string[] = [];

  for (const token of tokens) {
    // Direkte Übereinstimmung im Lexikon (Bedeutung oder Wortstamm).
    const hit = language.lexicon.find(
      (e) => e.meaning.toLowerCase() === token || token.startsWith(e.meaning.toLowerCase().slice(0, 4)),
    );
    if (hit) {
      words.push(hit.word);
      meanings.push(hit.meaning);
    } else {
      // Unbekanntes Wort: konsistent neu formen (gleicher Token → gleiches Wort).
      const localRand = createSeededRandom(hashString(`${token}#${language.name}`));
      const w = buildWord(language.profile, localRand);
      words.push(w);
      meanings.push(token);
    }
  }

  // Fremdsprachige Zeile: Wörter mit Apostroph-Rhythmus gruppieren.
  const foreign = words
    .map((w, i) => (i > 0 && i % 3 === 0 ? `'${w}` : w))
    .join(' ');

  const literal = meanings.join(' ');
  const verb = typeof options?.verb === 'string' && options.verb.trim() ? options.verb.trim() : 'sagte';
  const speaker = typeof options?.speaker === 'string' && options.speaker.trim()
    ? options.speaker.trim()
    : 'sie';

  const narrative = `„${capitalize(foreign)}!" ${verb} ${speaker} — Es bedeutete wörtlich: ${capitalize(literal)}.`;

  return {
    foreign,
    literal,
    narrative,
    words,
    profile: language.profile,
  };
}

// ---------------------------------------------------------------------------
// 3) Lexikon-Gedächtnis
// ---------------------------------------------------------------------------

/**
 * Schlägt ein Wort im Lexikon nach — die Bedeutungsgarantie über den Roman.
 *
 * Akzeptiert sowohl das fremdsprachige Wort als auch die deutsche Bedeutung.
 *
 * Defensiv: ungültige Eingaben liefern `known: false`.
 */
export function lookupWord(conlang: Conlang | null | undefined, query: unknown): LexiconLookup {
  const word = typeof query === 'string' ? query.trim() : '';
  if (!word || !conlang || !Array.isArray(conlang.lexicon)) {
    return { word, meaning: null, known: false };
  }

  const lower = word.toLowerCase();
  const hit = conlang.lexicon.find(
    (e) => e.word.toLowerCase() === lower || e.meaning.toLowerCase() === lower,
  );

  if (!hit) return { word, meaning: null, known: false };

  // Nachschlagen über das fremde Wort → deutsche Bedeutung, und umgekehrt.
  const meaning = hit.word.toLowerCase() === lower ? hit.meaning : hit.word;
  return { word, meaning, known: true };
}

// ---------------------------------------------------------------------------
// 4) Lexikon-Export
// ---------------------------------------------------------------------------

/**
 * Formatiert das Lexikon als Nachschlagetabelle für das Manuskript-Anhang.
 * Defensiv: leere Sprachen liefern einen leeren String.
 */
export function formatLexicon(conlang: Conlang | null | undefined): string {
  if (!conlang || !Array.isArray(conlang.lexicon) || conlang.lexicon.length === 0) return '';

  const header = `${conlang.name} (${PROFILE_LABELS[conlang.profile]})`;
  const rows = conlang.lexicon.map((e) => `${e.word} — ${e.meaning}`);
  return [header, '', ...rows].join('\n');
}

/** Zählt die Wörter eines Lexikons. */
export function lexiconSize(conlang: Conlang | null | undefined): number {
  return conlang && Array.isArray(conlang.lexicon) ? conlang.lexicon.length : 0;
}

/** Wortzahl-Hilfsfunktion für Aufrufer (vermeidet doppelte Importe). */
export function phraseWordCount(phrase: ConlangPhrase | null | undefined): number {
  return phrase && typeof phrase.foreign === 'string' ? countWords(phrase.foreign) : 0;
}
