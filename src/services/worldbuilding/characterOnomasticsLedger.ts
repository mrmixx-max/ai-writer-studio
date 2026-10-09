// CharacterOnomasticsLedger (WP 132.2 / Meilenstein 64.0, v7.6.0)
// Charakter-Onomastik- & Namenskultur-Hauptbuch.
// Vier Namens-Traditionen, phonotaktischer Harmonie-Filter, Bedeutungs-Resonanz.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Privater Auswahl-Helfer. Wirft bei leerem Array. */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick: leeres Array kann kein Element liefern");
  }
  return arr[Math.floor(rng() * arr.length)];
}

/** Bezeichner der vier Namens-Traditionen. */
export type NamingTraditionId = "patronymic" | "clanSept" | "occupational" | "epithet";

/** Eine Namens-Tradition mit Mustern und Beispielen. */
export interface NamingTradition {
  id: NamingTraditionId;
  name: string;
  description: string;
  /** Bildungsmuster (Suffixe mit führendem '-', Präfixe mit nachfolgendem '-'). */
  patterns: string[];
  /** Beispielnamen der Tradition. */
  examples: string[];
}

/** Die vier Namens-Traditionen des Hauptbuchs. */
export const NAMING_TRADITIONS: NamingTradition[] = [
  {
    id: "patronymic",
    name: "Patronymika / Abstammung",
    description:
      "Der Name verweist auf die väterliche (oder mütterliche) Abstammungslinie. " +
      "Ein Stamm wird mit einem Abstammungssuffix oder -präfix verbunden und bindet den Träger an seine Sippe.",
    patterns: ["-son", "-dóttir", "Fitz-", "Mac-", "ibn-"],
    examples: ["Leifsson", "Sigridsdóttir", "Fitzgerald", "MacDonald", "ibn Khaldun"],
  },
  {
    id: "clanSept",
    name: "Klan- & Sept-Namen",
    description:
      "Der Name nennt die Zugehörigkeit zu einem Klan oder einer Septe. Ein Stammeszeichen steht voran " +
      "und markiert Bündnis, Fehde und Erbfolge innerhalb der Großfamilie.",
    patterns: ["Clan-", "Mac-", "O'-", "-Sept"],
    examples: ["Clan MacDuff", "O'Brien", "MacGregor", "Fionn-Sept", "Clan Ranald"],
  },
  {
    id: "occupational",
    name: "Berufs- & Standesnamen",
    description:
      "Der Name beschreibt das Handwerk oder den Stand des Trägers. Ein Gegenstand oder eine Tätigkeit " +
      "wird mit einem Berufssuffix verbunden und überliefert die Zunft über Generationen.",
    patterns: ["-müller", "-schmied", "-macher", "-weber", "-händler"],
    examples: ["Müller", "Schmied", "Pfeilmacher", "Wollweber", "Salzhändler"],
  },
  {
    id: "epithet",
    name: "Taten-Beinamen",
    description:
      "Der Name gerinnt aus einer Tat, einem Merkmal oder einer Wunde. Ein Beiname mit Artikel oder " +
      "Körper-Suffix hängt sich an den Ruf und wird zur unauslöschlichen Signatur.",
    patterns: ["der ...", "die ...", "-gesicht", "-hand", "-herz"],
    examples: ["der Eiserne", "die Flinke", "Narbengesicht", "Bluthand", "Steinherz"],
  },
];

/** Liefert eine Namens-Tradition anhand ihrer Kennung. */
export function getNamingTradition(id: string): NamingTradition | undefined {
  return NAMING_TRADITIONS.find((t) => t.id === id);
}

/** Konsonanten-Vorrat für die phonotaktische Ableitung. */
const CONSONANT_POOL: string[] = [
  "b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z",
  "th", "sk", "st", "br", "gr", "dr", "ll", "nn",
];

/** Vokal-Vorrat für die phonotaktische Ableitung. */
const VOWEL_POOL: string[] = ["a", "e", "i", "o", "u", "ä", "ö", "ü", "au", "ei", "ou"];

/** Silbenmuster, denen eine Namenskultur folgt. */
const SYLLABLE_STYLES: string[] = ["CV", "CVC", "CVCC", "VCV", "CVVC"];

/** Eingabe für den Aufbau einer Namenskultur. */
export interface NameCultureInput {
  cultureName: string;
  traditionId: string;
  preferredConsonants?: string[];
  preferredVowels?: string[];
}

/** Ergebnis des Aufbaus einer Namenskultur. */
export interface NameCulture {
  cultureName: string;
  tradition: string;
  consonants: string[];
  vowels: string[];
  syllableStyle: string;
  description: string;
}

/** Baut eine Namenskultur mit phonotaktischem Inventar. Deterministisch. */
export function buildNameCulture(input: NameCultureInput, seed: number): NameCulture {
  const tradition = getNamingTradition(input.traditionId) ?? NAMING_TRADITIONS[0];
  const rng = createSeededRandom(hashString(`culture:${input.cultureName}:${seed}`));

  const consonants =
    input.preferredConsonants && input.preferredConsonants.length > 0
      ? [...input.preferredConsonants]
      : drawInventory(CONSONANT_POOL, 6, 9, rng);
  const vowels =
    input.preferredVowels && input.preferredVowels.length > 0
      ? [...input.preferredVowels]
      : drawInventory(VOWEL_POOL, 4, 6, rng);
  const syllableStyle = pick(SYLLABLE_STYLES, rng);

  const description =
    `Namenskultur „${input.cultureName}“ folgt der Tradition „${tradition.name}“. ` +
    `Das phonotaktische Inventar umfasst die Konsonanten ${consonants.join(", ")} ` +
    `und die Vokale ${vowels.join(", ")}; das bevorzugte Silbenmuster ist ${syllableStyle}. ` +
    `Zulässige Bildungsmuster: ${tradition.patterns.join(", ")}.`;

  return {
    cultureName: input.cultureName,
    tradition: tradition.id,
    consonants,
    vowels,
    syllableStyle,
    description,
  };
}

/** Zieht eine deterministische Teilmenge (min..max Elemente) aus einem Vorrat. */
function drawInventory(pool: string[], min: number, max: number, rng: () => number): string[] {
  const target = min + Math.floor(rng() * (max - min + 1));
  const copy = [...pool];
  const out: string[] = [];
  const count = Math.min(target, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

/** Baut eine Silbe nach einem Muster aus C (Konsonant) und V (Vokal). */
function buildSyllable(style: string, consonants: string[], vowels: string[], rng: () => number): string {
  let out = "";
  for (const ch of style) {
    if (ch === "C") out += pick(consonants, rng);
    else if (ch === "V") out += pick(vowels, rng);
  }
  return out;
}

/** Eingabe für die Erzeugung eines Charakternamens. */
export interface CharacterNameInput {
  cultureName: string;
  traditionId: string;
  gender?: "male" | "female" | "neutral";
  role?: string;
}

/** Ergebnis der Erzeugung eines Charakternamens. */
export interface CharacterName {
  name: string;
  tradition: string;
  cultureName: string;
  syllables: string[];
  gender: string;
  meaning: string;
  etymology: string;
}

/** Namenswurzeln mit Grundbedeutung (Deutsch). */
const NAME_ROOTS: { part: string; meaning: string }[] = [
  { part: "wald", meaning: "Wald" },
  { part: "stein", meaning: "Stein / Fels" },
  { part: "wolf", meaning: "Wolf" },
  { part: "licht", meaning: "Licht" },
  { part: "berg", meaning: "Berg" },
  { part: "fluss", meaning: "Fluss" },
  { part: "eisen", meaning: "Eisen" },
  { part: "nacht", meaning: "Nacht" },
  { part: "sonne", meaning: "Sonne" },
  { part: "klinge", meaning: "Klinge / Schwert" },
  { part: "sturm", meaning: "Sturm" },
  { part: "rose", meaning: "Rose" },
  { part: "herz", meaning: "Herz" },
  { part: "krone", meaning: "Krone" },
  { part: "schatten", meaning: "Schatten" },
  { part: "feuer", meaning: "Feuer" },
  { part: "see", meaning: "See / Meer" },
  { part: "vogel", meaning: "Vogel" },
];

/** Erzeugt einen Charakternamen innerhalb einer Namenskultur. Deterministisch. */
export function generateCharacterName(input: CharacterNameInput, seed: number): CharacterName {
  const tradition = getNamingTradition(input.traditionId) ?? NAMING_TRADITIONS[0];
  const gender = input.gender ?? "neutral";
  const culture = buildNameCulture(
    { cultureName: input.cultureName, traditionId: tradition.id },
    seed
  );

  const rng = createSeededRandom(
    hashString(`name:${input.cultureName}:${tradition.id}:${gender}:${input.role ?? ""}:${seed}`)
  );

  const syllableCount = 2 + Math.floor(rng() * 2); // 2 bis 3 Silben
  const syllables: string[] = [];
  for (let i = 0; i < syllableCount; i++) {
    syllables.push(buildSyllable(culture.syllableStyle, culture.consonants, culture.vowels, rng));
  }

  let core = syllables.join("");
  core = applyGenderEnding(core, gender, culture.vowels, culture.consonants, rng);

  const pattern = pick(tradition.patterns, rng);
  const applied = applyTradition(core, tradition.id, pattern, gender);
  const root = pick(NAME_ROOTS, rng);

  const meaning =
    `${tradition.name}: „${applied.name}“ — ${applied.framing} ` +
    `Der Stamm „${capitalize(core)}“ trägt die Wurzelbedeutung „${root.meaning}“.`;

  const etymology =
    `Der Name entsteht in der Namenskultur „${input.cultureName}“ nach dem Muster „${pattern}“. ` +
    `Zugrunde liegt die Wurzel „${root.part}“ (${root.meaning})` +
    (input.role ? ` und die Rolle „${input.role}“` : "") +
    `; die Silben ${syllables.join("·")} folgen dem Muster ${culture.syllableStyle}.`;

  return {
    name: applied.name,
    tradition: tradition.id,
    cultureName: input.cultureName,
    syllables,
    gender,
    meaning,
    etymology,
  };
}

/** Passt die Wortendung an das Geschlecht an. */
function applyGenderEnding(
  core: string,
  gender: string,
  vowels: string[],
  consonants: string[],
  rng: () => number
): string {
  if (core.length === 0) return core;
  const last = core[core.length - 1];
  const vowelEnding = isVowelChar(last);
  if (gender === "female" && !vowelEnding) {
    return core + pick(["a", "e", "i"], rng);
  }
  if (gender === "male" && vowelEnding) {
    return core + pick(consonants, rng);
  }
  return core;
}

/** Wendet ein Traditionsmuster auf einen Stamm an. */
function applyTradition(
  core: string,
  traditionId: NamingTraditionId,
  pattern: string,
  gender: string
): { name: string; framing: string } {
  const cap = capitalize(core);

  if (pattern === "der ..." || pattern === "die ...") {
    const chosen = gender === "female" ? "die" : gender === "male" ? "der" : pattern.startsWith("die") ? "die" : "der";
    return { name: `${chosen} ${cap}`, framing: `Taten-Beiname mit dem Artikel „${chosen}“.` };
  }

  if (pattern.startsWith("-")) {
    const suffix = pattern.slice(1);
    return { name: `${cap}${suffix}`, framing: `Suffix „-${suffix}“ hängt am Stamm „${cap}“.` };
  }

  if (pattern.endsWith("-")) {
    const prefix = pattern.slice(0, -1);
    const spaced = prefix.toLowerCase() === "clan" || prefix.toLowerCase() === "ibn";
    const name = spaced ? `${prefix} ${cap}` : `${prefix}${cap}`;
    return { name, framing: `Präfix „${prefix}-“ steht vor dem Stamm „${cap}“.` };
  }

  return { name: `${pattern} ${cap}`, framing: `Muster „${pattern}“ um den Stamm „${cap}“.` };
}

/** Bedeutung ganzer Beinamen-Wörter. */
const WHOLE_MEANINGS: Record<string, string> = {
  eiserne: "Beiname: der Eiserne — unnachgiebig und hart wie Erz.",
  flinke: "Beiname: die Flinke — behende und schnell.",
  narbengesicht: "Beiname: Narbengesicht — gezeichnet von alten Wunden.",
  bluthand: "Beiname: Bluthand — die Hand, die Blut vergoss.",
  steinherz: "Beiname: Steinherz — ein Herz ohne Mitleid.",
  dieflinke: "Beiname: die Flinke — behende und schnell.",
};

/** Affixe mit Bedeutung für die Zerlegung. */
const AFFIX_MEANINGS: { affix: string; position: "prefix" | "suffix"; meaning: string }[] = [
  { affix: "dóttir", position: "suffix", meaning: "Tochter des … (altnordisch)" },
  { affix: "son", position: "suffix", meaning: "Sohn des … (Abstammungssuffix)" },
  { affix: "sen", position: "suffix", meaning: "Sohn des … (nordisch)" },
  { affix: "fitz", position: "prefix", meaning: "Sohn des … (normannisch)" },
  { affix: "mac", position: "prefix", meaning: "Sohn des … (gälisch)" },
  { affix: "mc", position: "prefix", meaning: "Sohn des … (gälisch)" },
  { affix: "ibn", position: "prefix", meaning: "Sohn des … (arabisch)" },
  { affix: "bint", position: "prefix", meaning: "Tochter des … (arabisch)" },
  { affix: "o'", position: "prefix", meaning: "Abkömmling des … (irisch)" },
  { affix: "clan", position: "prefix", meaning: "Zugehörigkeit zu einem Klan." },
  { affix: "sept", position: "suffix", meaning: "Zugehörigkeit zu einer Septe." },
  { affix: "müller", position: "suffix", meaning: "Müller — Betreiber einer Mühle." },
  { affix: "schmied", position: "suffix", meaning: "Schmied — Bearbeiter von Metall." },
  { affix: "macher", position: "suffix", meaning: "Macher — Verfertiger einer Ware." },
  { affix: "weber", position: "suffix", meaning: "Weber — Hersteller von Geweben." },
  { affix: "händler", position: "suffix", meaning: "Händler — Kaufmann." },
  { affix: "meier", position: "suffix", meaning: "Meier — Verwalter eines Hofes." },
  { affix: "gesicht", position: "suffix", meaning: "Gesicht / Antlitz." },
  { affix: "hand", position: "suffix", meaning: "Hand." },
  { affix: "herz", position: "suffix", meaning: "Herz." },
];

/** Ergebnis der Bedeutungs-Erklärung. */
export interface NameMeaning {
  name: string;
  meaning: string;
  etymology: string;
  resonance: string;
  components: { part: string; meaning: string }[];
}

/** Zerlegt einen Namen in bedeutungstragende Bestandteile. */
function decomposeName(name: string): { part: string; meaning: string }[] {
  const cleaned = name.trim();
  if (cleaned.length === 0) {
    return [{ part: name, meaning: "leerer Name — keine Bestandteile." }];
  }

  const chunks = cleaned.split(/[\s-]+/).filter((c) => c.length > 0);
  const comps: { part: string; meaning: string }[] = [];

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();

    if (lower === "der" || lower === "die") {
      comps.push({ part: chunk, meaning: "Beinamen-Artikel — kennzeichnet den Taten-Beinamen." });
      continue;
    }

    if (WHOLE_MEANINGS[lower]) {
      comps.push({ part: chunk, meaning: WHOLE_MEANINGS[lower] });
      continue;
    }

    let matched = false;
    for (const a of AFFIX_MEANINGS) {
      if (a.position === "suffix" && lower.endsWith(a.affix) && lower.length > a.affix.length) {
        const stem = chunk.slice(0, chunk.length - a.affix.length);
        comps.push({ part: stem, meaning: "Namensstamm — Träger der Grundbedeutung." });
        comps.push({ part: chunk.slice(chunk.length - a.affix.length), meaning: a.meaning });
        matched = true;
        break;
      }
      if (a.position === "prefix" && lower.startsWith(a.affix) && lower.length > a.affix.length) {
        comps.push({ part: chunk.slice(0, a.affix.length), meaning: a.meaning });
        comps.push({ part: chunk.slice(a.affix.length), meaning: "Namensstamm — Träger der Grundbedeutung." });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const root = NAME_ROOTS.find((r) => lower.includes(r.part));
    if (root) {
      comps.push({ part: chunk, meaning: `Wurzel „${root.part}“ — ${root.meaning}.` });
      continue;
    }

    comps.push({ part: chunk, meaning: "Namensstamm — Träger der Grundbedeutung." });
  }

  return comps;
}

/** Erklärt Bedeutung, Etymologie und Resonanz eines Namens. Deterministisch. */
export function explainNameMeaning(name: string, seed: number): NameMeaning {
  const components = decomposeName(name);
  const rng = createSeededRandom(hashString(`meaning:${name}:${seed}`));

  const meaning =
    components.length > 0
      ? components.map((c) => `„${c.part}“ → ${c.meaning}`).join(" ")
      : "Keine Bestandteile erkannt.";

  const etymology =
    `Der Name „${name}“ zerfällt in ${components.length} Bestandteil(e): ` +
    components.map((c) => `${c.part} (${c.meaning})`).join(", ") +
    ".";

  const resonance = buildResonance(name, components, rng);

  return { name, meaning, etymology, resonance, components };
}

/** Baut eine poetische Resonanz-Phrase. */
function buildResonance(
  name: string,
  components: { part: string; meaning: string }[],
  rng: () => number
): string {
  const anchor = components.length > 0 ? components[0].part : name;
  const templates: ((a: string) => string)[] = [
    (a) => `Der Klang von „${a}“ trägt den Namen wie ein fernes Echo über die Generationen.`,
    (a) => `Wer „${a}“ ausspricht, ruft das ganze Geschlecht derer herauf, die ihn zuvor trugen.`,
    (a) => `In „${a}“ schwingt die Wärme eines Herdfeuers und der Staub einer alten Straße.`,
    (a) => `„${a}“ liegt schwer auf der Zunge wie eine Schuld, die niemand benennen kann.`,
    (a) => `Der Name „${a}“ klingt hell und fremd, als stamme er aus einer Sprache vor der Zeit.`,
  ];
  return pick(templates, rng)(anchor);
}

/** Ergebnis der Harmonie-Prüfung. */
export interface NameHarmony {
  harmonious: boolean;
  score: number;
  violations: string[];
  suggestions: string[];
  description: string;
}

/** Prüft eine Namensliste gegen die Phonotaktik einer Kultur. Deterministisch. */
export function checkNameHarmony(names: string[], cultureName: string, seed: number): NameHarmony {
  // Inventar wird allein aus Kulturname und Seed abgeleitet — Tradition ist hier beliebig.
  const culture = buildNameCulture({ cultureName, traditionId: NAMING_TRADITIONS[0].id }, seed);

  const allowedChars = new Set<string>();
  for (const c of culture.consonants) for (const ch of c.toLowerCase()) allowedChars.add(ch);
  for (const v of culture.vowels) for (const ch of v.toLowerCase()) allowedChars.add(ch);

  const violations: string[] = [];
  const suggestions: string[] = [];

  if (names.length === 0) {
    return {
      harmonious: false,
      score: 0,
      violations: ["Keine Namen übergeben."],
      suggestions: [generateCharacterName({ cultureName, traditionId: NAMING_TRADITIONS[0].id }, seed).name],
      description: `Ohne Namen lässt sich keine Harmonie für die Kultur „${cultureName}“ bestimmen.`,
    };
  }

  let ratioSum = 0;

  for (const raw of names) {
    const name = raw.trim();
    const letters = name.toLowerCase().replace(/[^a-zäöüß]/g, "");
    if (letters.length === 0) {
      violations.push(`Name „${raw}“ enthält keine auswertbaren Buchstaben.`);
      continue;
    }

    let allowed = 0;
    const offending = new Set<string>();
    for (const ch of letters) {
      if (allowedChars.has(ch)) allowed += 1;
      else offending.add(ch);
    }
    const ratio = allowed / letters.length;
    ratioSum += ratio;

    if (ratio < 0.8) {
      violations.push(
        `Name „${raw}“ nutzt fremde Laute (${[...offending].join(", ")}) — nur ${Math.round(ratio * 100)}% passen zum Inventar.`
      );
    }

    const maxRun = longestConsonantRun(letters, allowedChars, culture.vowels);
    if (maxRun > 3) {
      violations.push(`Name „${raw}“ hat ${maxRun} Konsonanten in Folge und bricht die Silbenstruktur ${culture.syllableStyle}.`);
    }
  }

  const avgRatio = ratioSum / names.length;
  const rawScore = Math.round(avgRatio * 100) - violations.length * 5;
  const score = Math.max(0, Math.min(100, rawScore));
  const harmonious = score >= 75 && violations.length === 0;

  if (!harmonious) {
    for (let i = 0; i < Math.min(3, names.length); i++) {
      const alt = generateCharacterName(
        { cultureName, traditionId: NAMING_TRADITIONS[0].id },
        seed + i + 1
      );
      suggestions.push(`Erwäge „${alt.name}“ statt „${names[i]}“ — passt zum Inventar der Kultur.`);
    }
    if (suggestions.length === 0) {
      const alt = generateCharacterName({ cultureName, traditionId: NAMING_TRADITIONS[0].id }, seed + 1);
      suggestions.push(`Erwäge „${alt.name}“ als kulturkonforme Alternative.`);
    }
  }

  const description = harmonious
    ? `Alle ${names.length} Namen klingen harmonisch in der Kultur „${cultureName}“ ` +
      `(Inventar: ${culture.consonants.join(", ")} / ${culture.vowels.join(", ")}).`
    : `Die Namensliste für „${cultureName}“ weist ${violations.length} Verstoß/Verstöße gegen die Phonotaktik auf; ` +
      `das Inventar verlangt die Konsonanten ${culture.consonants.join(", ")} und die Vokale ${culture.vowels.join(", ")}.`;

  return { harmonious, score, violations, suggestions, description };
}

/** Längste Folge aufeinanderfolgender Konsonanten in einem Buchstaben-String. */
function longestConsonantRun(letters: string, allowedChars: Set<string>, vowels: string[]): number {
  const vowelChars = new Set<string>();
  for (const v of vowels) for (const ch of v.toLowerCase()) vowelChars.add(ch);
  for (const v of ["a", "e", "i", "o", "u", "ä", "ö", "ü"]) vowelChars.add(v);

  let run = 0;
  let max = 0;
  for (const ch of letters) {
    if (vowelChars.has(ch)) {
      run = 0;
    } else {
      run += 1;
      if (run > max) max = run;
    }
  }
  return max;
}

/** Ist das Zeichen ein Vokalbuchstabe? */
function isVowelChar(ch: string): boolean {
  return "aeiouäöü".indexOf(ch.toLowerCase()) >= 0;
}

/** Großschreibung des ersten Zeichens. */
function capitalize(input: string): string {
  if (input.length === 0) return input;
  return input[0].toUpperCase() + input.slice(1);
}

/** Erstellt eine Beispiel-Namenskultur. */
export function createSampleNameCulture(): NameCulture {
  return buildNameCulture(
    { cultureName: "Nordmark", traditionId: "patronymic" },
    42
  );
}

/** Erstellt einen Beispiel-Charakternamen. */
export function createSampleCharacterName(): CharacterName {
  return generateCharacterName(
    { cultureName: "Nordmark", traditionId: "patronymic", gender: "male", role: "Krieger" },
    42
  );
}
