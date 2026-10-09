// oulipoConstraintEngine.ts (WP 124.1 / Meilenstein 60.0 / v7.2.0)
//
// Oulipo-Zwangsmethoden & Regel-Poesie für experimentelle Prosa.
// Bietet fünf formale Zwangsmethoden, einen Echtzeit-Regel-Prüfer
// und einen deterministischen Synthesizer.
//
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module, browserkompatibel.

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

/** Wählt ein Element deterministisch aus. Wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) {
    throw new Error("pick: leeres Array kann kein Element liefern.");
  }
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}

/** Begrenzt einen Wert auf 0-100 und rundet. */
function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Zerlegt Text in bereinigte Wörter (Satzzeichen werden entfernt). */
function tokenize(text: string): string[] {
  const raw = text.trim().split(/\s+/);
  const out: string[] = [];
  for (const w of raw) {
    const cleaned = w.replace(/[^A-Za-zÄÖÜäöüß0-9]/g, "");
    if (cleaned.length > 0) out.push(cleaned);
  }
  return out;
}

/** IDs der fünf formalen Zwangsmethoden. */
export type ConstraintId = "lipogram" | "nPlus7" | "snowball" | "univocalism" | "tautogram";

/** Beschreibung einer formalen Zwangsmethode. */
export interface ConstraintMethod {
  id: ConstraintId;
  name: string;
  description: string;
  example: string;
  difficulty: number;
}

/** Optionen für den Regel-Prüfer. */
export interface ConstraintOptions {
  excludedChar?: string;
  vowel?: string;
}

/** Ergebnis einer Zwangs-Prüfung. */
export interface ConstraintCheckResult {
  valid: boolean;
  violations: string[];
  score: number;
  description: string;
}

/** Ergebnis einer Zwangs-Generierung. */
export interface ConstrainedTextResult {
  text: string;
  method: string;
  valid: boolean;
  description: string;
}

/** Die fünf formalen Zwangsmethoden des Oulipo. */
export const CONSTRAINT_METHODS: ConstraintMethod[] = [
  {
    id: "lipogram",
    name: "Lipogramm",
    description: "Ausschluss eines Buchstabens — der Text darf ein bestimmtes Zeichen nicht enthalten.",
    example: "Wind, Sturm, Nacht und dann ganz still.",
    difficulty: 4,
  },
  {
    id: "nPlus7",
    name: "N+7",
    description: "Substantiv durch 7. folgendes ersetzen — jedes Nomen wird im Lexikon um sieben Stellen verschoben.",
    example: "Der Wind streift die Wolke → der Stein streift die Blume.",
    difficulty: 5,
  },
  {
    id: "snowball",
    name: "Schneeball-Satz",
    description: "Jedes Wort einen Buchstaben mehr — jedes folgende Wort ist genau ein Zeichen länger als das vorige.",
    example: "Am Tag wird jeder länger.",
    difficulty: 6,
  },
  {
    id: "univocalism",
    name: "Univokalismus",
    description: "Nur ein Vokal — im gesamten Text darf ausschließlich ein einziger Vokal vorkommen.",
    example: "Oft kommt Not.",
    difficulty: 8,
  },
  {
    id: "tautogram",
    name: "Tautogramm",
    description: "Alle Wörter beginnen mit dem gleichen Buchstaben.",
    example: "Wind weht weiche Wellen.",
    difficulty: 3,
  },
];

// ---------------------------------------------------------------------------
// Wortschätze (deterministische Bausteine für den Synthesizer)
// ---------------------------------------------------------------------------

/** Wörter ohne den Buchstaben "e" (für das Lipogramm). */
const LIPOGRAM_POOL: readonly string[] = [
  "Wind", "Strahl", "Sturm", "Nacht", "Tal", "Wald", "Sand", "Glut", "Rauch", "Luft",
  "Frost", "Blitz", "Hain", "Moos", "Licht", "Gischt", "Firn", "Grat", "Kamm", "Schlucht",
  "Joch", "Dunst", "Hauch", "Schwall", "Riff", "Kluft", "Brandung", "Flut", "Damm", "Wall",
  "Grund", "Halm", "Pfad", "Stich", "Wuchs", "Flug", "Schwung", "Drang", "Zwang", "Klang",
  "Schwarm", "Harm", "Arm", "Born", "Horn", "Zorn", "Dom", "Strom", "rauscht", "braust",
  "zischt", "knallt", "prallt", "wallt", "hallt", "ruht", "sinkt", "stürzt", "wirft", "rast",
  "dröhnt", "schwingt", "klingt", "singt", "tanzt", "wild", "still", "kalt", "hart", "warm",
  "klar", "schmal", "grau", "blank", "starr", "zart", "sanft", "fromm", "groß", "kurz",
];

/** Wörter je Anfangsbuchstabe (für das Tautogramm). */
const TAUTOGRAM_WORDS: Record<string, readonly string[]> = {
  b: ["Brot", "Berg", "Blatt", "Bach", "Ball", "Bild", "Buch", "Blume", "Balken", "Birne"],
  d: ["Dorf", "Dach", "Dunst", "Dorn", "Drache", "Decke", "Dattel", "Damm", "Diele", "Dolch"],
  f: ["Fels", "Flamme", "Frost", "Feder", "Fisch", "Fahne", "Frucht", "Fuchs", "Furche", "Faden"],
  g: ["Gras", "Glut", "Garten", "Gold", "Glocke", "Gipfel", "Gans", "Grab", "Gitter", "Glas"],
  h: ["Haus", "Herz", "Hain", "Hand", "Himmel", "Hut", "Hof", "Höhle", "Horn", "Hauch"],
  k: ["Kamm", "Klang", "Kreis", "Klippe", "Krone", "Kraft", "Kugel", "Küste", "Kern", "Knall"],
  l: ["Licht", "Laub", "Lied", "Luft", "Lampe", "Linie", "Löwe", "Lanze", "Leuchte", "Lauf"],
  m: ["Mond", "Moos", "Meer", "Mauer", "Markt", "Mütze", "Mantel", "Mast", "Milch", "Mund"],
  n: ["Nacht", "Nebel", "Nest", "Nadel", "Nuss", "Nase", "Nord", "Narr", "Neige", "Nachen"],
  r: ["Rauch", "Regen", "Ring", "Rose", "Ruder", "Rinde", "Rabe", "Riff", "Ruhe", "Rasen"],
  s: ["Sonne", "Sand", "Stern", "Sturm", "Stein", "Schnee", "Seele", "Salz", "Seide", "Säbel"],
  t: ["Tal", "Traum", "Turm", "Tuch", "Tanne", "Tau", "Tinte", "Tor", "Tanz", "Tropfen"],
  w: ["Wind", "Welle", "Wald", "Wolke", "Wasser", "Wurzel", "Wiese", "Wort", "Wand", "Wein"],
  z: ["Zeit", "Zaun", "Zweig", "Zelt", "Zunge", "Zeder", "Zirkel", "Zorn", "Zug", "Zinn"],
};

/** Wörter mit genau einem Vokaltyp (für den Univokalismus). */
const UNIVOCAL_WORDS: Record<string, readonly string[]> = {
  a: ["Aal", "Saal", "Stahl", "Kanal", "Basar", "Salat", "Gras", "Sand", "Wald", "Tal",
      "Spalt", "Kamm", "Markt", "Bart", "Strand", "Hand", "Salz", "Falz", "Halm", "Pfad"],
  e: ["Weg", "Heer", "Meer", "Seele", "Feld", "Welt", "Berg", "Herz", "Fels", "Eber",
      "Beet", "Leer", "Wesen", "Segel", "Nebel", "Wetter", "Gebet", "Kette", "Leber", "Feder"],
  i: ["Wind", "Witz", "Ring", "Kinn", "Bild", "Kind", "Licht", "Fisch", "Zinn", "Riff",
      "Gips", "Spitz", "Hirn", "Wirt", "Mist", "Tisch", "Stift", "Zwilling", "Stirn", "Gift"],
  o: ["Mond", "Moos", "Brot", "Dorf", "Wolf", "Gold", "Kopf", "Topf", "Hof", "Ohr",
      "Boot", "Tor", "Frost", "Most", "Rock", "Stock", "Knopf", "Zoll", "Horn", "Bord"],
  u: ["Fluss", "Buch", "Kuss", "Dunst", "Luft", "Kunst", "Burg", "Gurt", "Sturm", "Wurm",
      "Nuss", "Pult", "Rumpf", "Zug", "Turm", "Mund", "Bund", "Schuld", "Furcht", "Wurst"],
};

/** Wörter je exakter Länge (für den Schneeball-Satz). */
const SNOWBALL_WORDS: Record<number, readonly string[]> = {
  2: ["am", "an", "in", "um", "so", "du", "es", "ja", "ob", "wo"],
  3: ["Tag", "Rad", "Arm", "Tor", "Hof", "Bus", "See", "Ohr", "gut", "rot", "alt", "Mut", "Kur"],
  4: ["Wind", "Haus", "Berg", "Meer", "Zeit", "Wort", "Sand", "Fels", "Glut", "Gold", "Brot", "Wein", "Reim", "Bild", "Kind"],
  5: ["Licht", "Sturm", "Stein", "Wolke", "Kraft", "Traum", "Kreis", "Nacht", "Blume", "Vogel", "Fisch", "Regen", "Feuer", "Welle", "Tanne"],
  6: ["Blumen", "Wolken", "Lieder", "Trauer", "Freude", "Garten", "Himmel", "Schnee", "Wunder", "Zweige", "Herzen", "Kinder", "Bruder"],
  7: ["Gebirge", "Gestade", "Gewölbe", "Freunde", "Himmels", "Gartens", "Flusses", "Wunders", "Sternen"],
  8: ["Gewitter", "Wanderer", "Meerenge", "Abendrot", "Fernrohr", "Tagebuch", "Windrose", "Gebirges", "Schatten"],
  9: ["Sternbild", "Lebewesen", "Flussufer", "Wintertag", "Lebensweg", "Morgenrot", "Sonnenbad", "Wanderung", "Abenteuer"],
  10: ["Regenbogen", "Waldstille", "Wasserfall", "Blumenmeer", "Meereswoge"],
  11: ["Sonnenlicht", "Wintersturm", "Morgenlicht", "Abendstunde", "Sternenbild", "Silberregen", "Blätterdach"],
  12: ["Mondenschein", "Waldlichtung", "Blumengarten", "Sternenlicht", "Wintermorgen"],
  13: ["Sternenhimmel", "Meeresspiegel", "Wandergeselle", "Wintermärchen"],
  14: ["Frühlingsblume", "Abenddämmerung", "Sommergewitter"],
};

/** Substantiv-Lexikon für N+7 (Verschiebung um sieben Stellen). */
const NOUN_LEXICON: readonly string[] = [
  "Haus", "Baum", "Fluss", "Berg", "Stern", "Wind", "Stein", "Blume", "Vogel", "Fisch",
  "Wolke", "Regen", "Feuer", "Wasser", "Erde", "Himmel", "Weg", "Brücke", "Turm", "Garten",
  "Fenster", "Tür", "Tisch", "Stuhl", "Lampe", "Buch", "Feder", "Tinte", "Papier", "Uhr",
  "Schlüssel", "Spiegel", "Kerze", "Glas", "Messer", "Schwert", "Schild", "Helm", "Rüstung", "Pfeil",
  "Bogen", "Fahne", "Krone", "Ring", "Perle", "Gold", "Silber", "Eisen", "Holz", "Sand",
];

/** Satzschablonen für N+7 (Platzhalter {0}..{3} sind Nomen). */
const NPLUS7_TEMPLATES: readonly (readonly string[])[] = [
  ["Der", "{0}", "trifft", "die", "{1}", "und", "der", "{2}", "ruht", "am", "{3}"],
  ["Die", "{0}", "folgt", "dem", "{1}", "während", "der", "{2}", "im", "{3}", "steht"],
  ["Ein", "{0}", "sieht", "die", "{1}", "und", "der", "{2}", "liegt", "neben", "dem", "{3}"],
];

/** Basisalphabet zum Verlängern von Schneeball-Wörtern. */
const EXTEND_LETTERS: readonly string[] = "abcdefghijklmnopqrstuvwxyz".split("");

// ---------------------------------------------------------------------------
// Echtzeit-Regel-Prüfer
// ---------------------------------------------------------------------------

/**
 * Prüft, ob ein Text die angegebene Zwangsmethode einhält.
 * Liefert Gültigkeit, Verstöße, einen Score (0-100) und eine Beschreibung.
 */
export function checkConstraint(
  text: string,
  methodId: string,
  options: ConstraintOptions = {}
): ConstraintCheckResult {
  const words = tokenize(text);

  switch (methodId) {
    case "lipogram": {
      const excluded = (options.excludedChar || "e").toLowerCase();
      if (words.length === 0) {
        return {
          valid: false,
          violations: ["Der Text enthält keine Wörter."],
          score: 0,
          description: "Lipogramm kann nicht geprüft werden — leerer Text.",
        };
      }
      const bad = words.filter((w) => w.toLowerCase().includes(excluded));
      const violations = bad.map(
        (w) => `Wort "${w}" enthält den verbotenen Buchstaben "${excluded}".`
      );
      const valid = violations.length === 0;
      const score = clampScore(((words.length - bad.length) / words.length) * 100);
      return {
        valid,
        violations,
        score,
        description: valid
          ? `Lipogramm erfüllt: kein "${excluded}" im Text.`
          : `Lipogramm verletzt: "${excluded}" kommt in ${bad.length} von ${words.length} Wörtern vor.`,
      };
    }

    case "nPlus7": {
      const violations: string[] = [];
      if (words.length === 0) violations.push("Der Text enthält keine Wörter.");
      else if (words.length < 2) violations.push("N+7 benötigt mindestens zwei Wörter.");
      if (/[0-9]/.test(text)) violations.push("N+7-Text sollte keine Ziffern enthalten.");
      const valid = violations.length === 0;
      const score = valid ? clampScore(60 + words.length * 5) : clampScore(40 - violations.length * 10);
      return {
        valid,
        violations,
        score,
        description: valid
          ? `N+7-Text akzeptiert: ${words.length} Wörter, keine Ziffern.`
          : `N+7-Text abgelehnt: ${violations.length} Verstoß/Verstöße.`,
      };
    }

    case "snowball": {
      if (words.length === 0) {
        return {
          valid: false,
          violations: ["Der Schneeball-Satz benötigt mindestens ein Wort."],
          score: 0,
          description: "Schneeball-Satz kann nicht geprüft werden — leerer Text.",
        };
      }
      const violations: string[] = [];
      for (let i = 1; i < words.length; i++) {
        const expected = words[i - 1].length + 1;
        if (words[i].length !== expected) {
          violations.push(
            `Wort "${words[i]}" hat ${words[i].length} Buchstaben, erwartet ${expected} nach "${words[i - 1]}".`
          );
        }
      }
      const pairs = words.length - 1;
      const valid = violations.length === 0;
      const score = pairs === 0 ? 100 : clampScore(((pairs - violations.length) / pairs) * 100);
      return {
        valid,
        violations,
        score,
        description: valid
          ? `Schneeball-Satz erfüllt: ${words.length} Wörter wachsen jeweils um einen Buchstaben.`
          : `Schneeball-Satz verletzt: ${violations.length} von ${pairs} Übergängen stimmen nicht.`,
      };
    }

    case "univocalism": {
      const vowel = (options.vowel || "e").toLowerCase();
      const allVowels = ["a", "e", "i", "o", "u", "ä", "ö", "ü"];
      if (words.length === 0) {
        return {
          valid: false,
          violations: ["Der Text enthält keine Wörter."],
          score: 0,
          description: "Univokalismus kann nicht geprüft werden — leerer Text.",
        };
      }
      const bad = words.filter((w) => {
        const lower = w.toLowerCase();
        return allVowels.some((v) => v !== vowel && lower.includes(v));
      });
      const violations = bad.map(
        (w) => `Wort "${w}" enthält einen fremden Vokal (erlaubt: "${vowel}").`
      );
      const valid = violations.length === 0;
      const score = clampScore(((words.length - bad.length) / words.length) * 100);
      return {
        valid,
        violations,
        score,
        description: valid
          ? `Univokalismus erfüllt: nur der Vokal "${vowel}" kommt vor.`
          : `Univokalismus verletzt: ${bad.length} von ${words.length} Wörtern nutzen fremde Vokale.`,
      };
    }

    case "tautogram": {
      if (words.length < 2) {
        return {
          valid: false,
          violations: ["Das Tautogramm benötigt mindestens zwei Wörter."],
          score: 0,
          description: "Tautogramm kann nicht geprüft werden — zu wenige Wörter.",
        };
      }
      const initial = words[0][0].toLowerCase();
      const bad = words.filter((w) => w[0].toLowerCase() !== initial);
      const violations = bad.map((w) => `Wort "${w}" beginnt nicht mit "${initial}".`);
      const valid = violations.length === 0;
      const score = clampScore(((words.length - bad.length) / words.length) * 100);
      return {
        valid,
        violations,
        score,
        description: valid
          ? `Tautogramm erfüllt: alle Wörter beginnen mit "${initial}".`
          : `Tautogramm verletzt: ${bad.length} von ${words.length} Wörtern weichen vom Anlaut "${initial}" ab.`,
      };
    }

    default:
      return {
        valid: false,
        violations: [`Unbekannte Zwangsmethode: "${methodId}".`],
        score: 0,
        description: `Unbekannte Zwangsmethode: "${methodId}".`,
      };
  }
}

// ---------------------------------------------------------------------------
// Synthesizer
// ---------------------------------------------------------------------------

/** Baut aus generiertem Text und Methode ein geprüftes Ergebnis. */
function buildResult(
  text: string,
  methodId: string,
  options?: ConstraintOptions
): ConstrainedTextResult {
  const check = checkConstraint(text, methodId, options);
  const meta = CONSTRAINT_METHODS.find((m) => m.id === methodId);
  const name = meta ? meta.name : methodId;
  const description = check.valid
    ? `${name}: Zwang eingehalten. ${check.description}`
    : `${name}: Zwang verletzt. ${check.description}`;
  return { text, method: methodId, valid: check.valid, description };
}

/** Verlängert ein Wort deterministisch um genau einen Buchstaben. */
function extendWord(base: string, rng: () => number): string {
  return base + pick(EXTEND_LETTERS, rng);
}

/**
 * Erzeugt einen Text, der die angegebene Zwangsmethode einhält.
 * Deterministisch für gleichen Seed. `length` steuert die Wortanzahl.
 */
export function generateConstrainedText(
  methodId: string,
  seed: number,
  length: number = 8
): ConstrainedTextResult {
  const rng = createSeededRandom(hashString(`${methodId}#${seed}`));
  const count = Math.max(1, Math.floor(length));

  switch (methodId) {
    case "lipogram": {
      const words: string[] = [];
      for (let i = 0; i < count; i++) words.push(pick(LIPOGRAM_POOL, rng));
      return buildResult(words.join(" "), "lipogram", { excludedChar: "e" });
    }

    case "tautogram": {
      const letters = Object.keys(TAUTOGRAM_WORDS);
      const letter = pick(letters, rng);
      const pool = TAUTOGRAM_WORDS[letter];
      const words: string[] = [];
      for (let i = 0; i < count; i++) words.push(pick(pool, rng));
      return buildResult(words.join(" "), "tautogram");
    }

    case "univocalism": {
      const vowels = Object.keys(UNIVOCAL_WORDS);
      const vowel = pick(vowels, rng);
      const pool = UNIVOCAL_WORDS[vowel];
      const words: string[] = [];
      for (let i = 0; i < count; i++) words.push(pick(pool, rng));
      return buildResult(words.join(" "), "univocalism", { vowel });
    }

    case "snowball": {
      const startLen = 2 + Math.floor(rng() * 3); // 2..4
      const words: string[] = [];
      for (let i = 0; i < count; i++) {
        const len = startLen + i;
        const bucket = SNOWBALL_WORDS[len];
        if (bucket && bucket.length > 0) {
          words.push(pick(bucket, rng));
        } else {
          const prev = words.length > 0 ? words[words.length - 1] : "ab";
          words.push(extendWord(prev, rng));
        }
      }
      return buildResult(words.join(" "), "snowball");
    }

    case "nPlus7": {
      const start = Math.floor(rng() * NOUN_LEXICON.length);
      const nouns: string[] = [];
      for (let i = 0; i < 4; i++) {
        // jedes Substantiv um sieben Stellen im Lexikon verschoben
        nouns.push(NOUN_LEXICON[(start + i * 3 + 7) % NOUN_LEXICON.length]);
      }
      const template = pick(NPLUS7_TEMPLATES, rng);
      const text = template
        .map((tok) => (/^\{\d\}$/.test(tok) ? nouns[Number(tok.slice(1, 2))] : tok))
        .join(" ");
      return buildResult(text, "nPlus7");
    }

    default:
      return {
        text: "",
        method: methodId,
        valid: false,
        description: `Unbekannte Zwangsmethode: "${methodId}".`,
      };
  }
}

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

/** Liefert eine Beispiel-Zwangsmethode (Lipogramm). */
export function createSampleConstraint(): ConstraintMethod {
  return { ...CONSTRAINT_METHODS[0] };
}

/** Liefert einen Beispiel-Text unter Zwang (deterministisch, Seed 42). */
export function createSampleConstrainedText(): ConstrainedTextResult {
  return generateConstrainedText("snowball", 42, 8);
}
