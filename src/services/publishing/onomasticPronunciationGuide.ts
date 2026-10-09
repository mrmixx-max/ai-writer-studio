// onomasticPronunciationGuide.ts — Lautschrift- & IPA-Leitfaden für Hörbücher.
//
// Meilenstein 64.0 (v7.6.0)
//
// Drei Bausteine:
//   1. Automatischer Eigennamen-Extraktor (Charaktere, Orte, Artefakte)
//   2. Doppelte Lautschrift-Generierung (IPA + einfache Lautschrift)
//   3. 1-Klick-Anhang-Export (druckfertiges Aussprache-Verzeichnis als SVG)
//
// Rein deterministisch: FNV-1a + mulberry32. Keine Node-Module,
// vollständig browser-kompatibel. Alle Bezeichner auf Englisch,
// alle Daten und Kommentare auf Deutsch.

// ---------------------------------------------------------------------------
// Deterministische Zufalls-Helfer
// ---------------------------------------------------------------------------

/** FNV-1a-Hash, unsigned 32-bit. Gleiche Eingabe → gleiche Ausgabe. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32-Pseudozufallsgenerator. Liefert Werte im Intervall [0, 1). */
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

/** Wählt deterministisch ein Element aus einem Array. Wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick: leeres Array");
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Gemeinsame Typen
// ---------------------------------------------------------------------------

/** Kategorie eines Eigennamens. */
export type ProperNameType = "character" | "place" | "artifact";

/** Ergebnis der Eigennamen-Extraktion. */
export interface ProperNamesResult {
  /** Alle erkannten Eigennamen in Reihenfolge des ersten Auftretens. */
  names: string[];
  /** Anzahl erkannter Eigennamen. */
  count: number;
  /** Nach Typ gruppierte Eigennamen. */
  byType: {
    characters: string[];
    places: string[];
    artifacts: string[];
  };
}

// ---------------------------------------------------------------------------
// Feature 1: Automatischer Eigennamen-Extraktor (WP 133.2)
// ---------------------------------------------------------------------------

/**
 * Häufige deutsche Wörter (Funktionswörter, Pronomen, Präpositionen,
 * Konjunktionen, gängige Nomen/Verben/Adjektive). Großgeschriebene
 * Wörter dieser Liste gelten nicht als Eigenname.
 */
const COMMON_WORDS: ReadonlySet<string> = new Set<string>([
  // Artikel & Pronomen
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "eines", "einer", "er", "sie", "es", "ich", "du", "wir", "ihr", "mich",
  "dich", "uns", "euch", "ihm", "ihn", "ihnen", "ihre", "ihren", "ihrem",
  "ihrer", "ihres", "mein", "meine", "meinen", "meinem", "meiner", "meines",
  "dein", "deine", "deinen", "deinem", "deiner", "deines", "sein", "seine",
  "seinen", "seinem", "seiner", "seines", "unser", "unsere", "unseren",
  "unserem", "unserer", "unseres", "man", "wer", "was", "wem", "wen",
  "wessen", "dieser", "diese", "dieses", "diesen", "diesem", "jener", "jene",
  "jenes", "jeder", "jede", "jedes", "jeden", "jedem", "alle", "allen",
  "allem", "aller", "alles", "beide", "beiden", "etwas", "nichts", "manche",
  "mancher", "manches", "jemand", "niemand",
  // Präpositionen
  "in", "im", "an", "am", "auf", "aus", "bei", "mit", "nach", "von", "vor",
  "zu", "zum", "zur", "über", "unter", "durch", "für", "gegen", "ohne", "um",
  "bis", "seit", "zwischen", "hinter", "neben", "entlang", "wegen", "trotz",
  "statt", "während", "innerhalb", "außerhalb",
  // Konjunktionen & Adverbien
  "und", "oder", "aber", "denn", "sondern", "doch", "jedoch", "als", "wenn",
  "weil", "dass", "ob", "falls", "sobald", "damit", "obwohl", "bevor",
  "nachdem", "seitdem", "sowie", "wie", "wo", "wann", "warum", "wieso",
  "weshalb", "deshalb", "deswegen", "darum", "daher", "also", "folglich",
  "trotzdem", "dennoch", "außerdem", "zudem", "ferner", "sonst",
  "gleichwohl", "allerdings", "freilich", "nicht", "kein", "keine", "keinen",
  "keinem", "keiner", "keines", "nur", "auch", "schon", "noch", "immer",
  "nie", "niemals", "oft", "manchmal", "selten", "bald", "gleich", "jetzt",
  "nun", "dann", "danach", "vorher", "zuerst", "zunächst", "später", "früher",
  "heute", "gestern", "morgen", "hier", "dort", "da", "oben", "unten", "vorn",
  "hinten", "links", "rechts", "weit", "nahe", "sehr", "ziemlich", "recht",
  "etwa", "fast", "beinahe", "kaum", "genau", "eben", "gerade", "bereits",
  "erst", "wieder", "einmal", "mehrmals",
  // Gängige Verben
  "ist", "sind", "war", "waren", "hatte", "hatten", "hat", "haben", "wird",
  "werden", "wurde", "wurden", "kann", "können", "konnte", "konnten", "muss",
  "müssen", "musste", "mussten", "soll", "sollen", "sollte", "sollten",
  "darf", "dürfen", "durfte", "durften", "will", "wollen", "wollte",
  "wollten", "mag", "mögen", "ging", "gingen", "geht", "gehen", "kam",
  "kamen", "kommt", "kommen", "sah", "sahen", "sieht", "sehen", "lag",
  "lagen", "liegt", "liegen", "stand", "standen", "steht", "stehen", "gab",
  "gaben", "gibt", "geben", "nahm", "nahmen", "nimmt", "nehmen", "sprach",
  "sprachen", "spricht", "sprechen", "dachte", "dachten", "denkt", "denken",
  "fand", "fanden", "findet", "finden", "hieß", "hießen", "heißt", "heißen",
  "wusste", "wussten", "weiß", "wissen", "glaubte", "glaubten", "glaubt",
  "glauben", "fühlte", "fühlten", "fühlt", "fühlen",
  // Gängige Adjektive
  "gut", "gute", "guter", "gutes", "guten", "gutem", "schlecht", "schlechte",
  "groß", "große", "großer", "großes", "großen", "klein", "kleine", "kleiner",
  "kleines", "kleinen", "alt", "alte", "alter", "altes", "alten", "jung",
  "junge", "junger", "junges", "jungen", "neu", "neue", "neuer", "neues",
  "neuen", "letzte", "letzter", "letztes", "letzten", "nächste", "nächster",
  "nächstes", "nächsten", "erste", "erster", "erstes", "ersten", "zweite",
  "zweiter", "zweites", "zweiten", "dritte", "dritter", "drittes", "dritten",
  "einzige", "einziger", "einziges", "einzigen", "ganze", "ganzer", "ganzes",
  "ganzen", "höchste", "höchster", "meiste", "meisten", "wichtig", "wichtige",
  "wichtiger", "lange", "langer", "langen", "kurze", "kurzer", "kurzen",
  "schöne", "schöner", "schönes", "schönen", "stille", "stiller", "stillen",
  "dunkle", "dunkler", "dunklen", "helle", "heller", "kalte", "kalter",
  "kalten", "warme", "warmer", "warmen",
  // Gängige Nomen
  "zeit", "zeiten", "jahr", "jahre", "tag", "tage", "nacht", "nächte",
  "stunde", "stunden", "minute", "minuten", "augenblick", "moment", "woche",
  "wochen", "monat", "monate", "mensch", "menschen", "mann", "männer", "frau",
  "frauen", "kind", "kinder", "leute", "welt", "welten", "land", "länder",
  "stadt", "städte", "dorf", "dörfer", "haus", "häuser", "tür", "türen",
  "fenster", "raum", "räume", "zimmer", "weg", "wege", "straße", "straßen",
  "platz", "plätze", "wasser", "feuer", "luft", "erde", "himmel", "meer",
  "berg", "berge", "wald", "wälder", "baum", "bäume", "blume", "blumen",
  "gras", "stein", "steine", "hand", "hände", "arm", "arme", "bein", "beine",
  "kopf", "köpfe", "auge", "augen", "ohr", "ohren", "mund", "nase", "haar",
  "haare", "herz", "herzen", "blut", "körper", "seele", "geist", "gedanke",
  "gedanken", "wort", "worte", "wörter", "satz", "sätze", "sprache",
  "stimme", "stimmen", "geschichte", "geschichten", "buch", "bücher", "seite",
  "seiten", "kapitel", "text", "zeile", "zeilen", "arbeit", "leben", "tod",
  "liebe", "hass", "angst", "freude", "trauer", "zorn", "hoffnung", "mut",
  "kraft", "kräfte", "macht", "stärke", "schwäche", "frieden", "krieg",
  "streit", "kampf", "schlacht", "reise", "abenteuer", "geheimnis",
  "geheimnisse", "wahrheit", "lüge", "traum", "träume", "erinnerung",
  "erinnerungen", "zukunft", "vergangenheit", "gegenwart", "grund", "gründe",
  "art", "arten", "form", "formen", "teil", "teile", "stück", "stücke",
  "gruppe", "gruppen", "ende", "anfang", "beginn", "mitte", "rand", "ränder",
  "oberfläche", "tiefe", "höhe", "breite", "länge", "größe", "farbe",
  "farben", "licht", "lichter", "schatten", "dunkelheit", "glut", "asche",
  "rauch", "nebel", "regen", "schnee", "wind", "sturm", "wetter", "sommer",
  "winter", "frühling", "herbst", "sonne", "mond", "stern", "sterne", "wolke",
  "wolken", "ding", "dinge", "sache", "sachen", "frage", "fragen", "antwort",
  "antworten", "problem", "probleme", "idee", "ideen", "plan", "pläne",
  "ziel", "ziele", "name", "namen", "herr",
]);

/** Ortsmarker: ein vorangehendes Bestimmungswort deutet auf einen Ort hin. */
const PLACE_MARKERS: ReadonlySet<string> = new Set<string>([
  "stadt", "dorf", "burg", "schloss", "festung", "tempel", "berg", "tal",
  "wald", "see", "fluss", "insel", "hafen", "ebene", "wüste", "gebirge",
  "küste", "land", "reich", "königreich", "provinz", "grafschaft",
  "herzogtum", "markt", "gasse", "straße", "platz", "brücke", "tor", "mauer",
  "höhle", "klippe", "bucht", "meer", "ozean", "kontinent", "region",
  "gebiet", "bezirk", "viertel", "vorort", "friedhof", "kloster", "abtei",
  "zitadelle", "turm",
]);

/** Artefaktmarker: ein vorangehendes Bestimmungswort deutet auf ein Artefakt hin. */
const ARTIFACT_MARKERS: ReadonlySet<string> = new Set<string>([
  "schwert", "dolch", "klinge", "axt", "streitkolben", "lanze", "speer",
  "bogen", "ring", "amulett", "talisman", "krone", "kelch", "buch", "band",
  "foliant", "grimoire", "stein", "edelstein", "kristall", "stab",
  "schlüssel", "maske", "spiegel", "kette", "zepter", "artefakt", "reliquie",
  "karte", "kompass", "laterne", "uhr", "medaillon", "anhänger", "waffe",
  "rüstung", "helm", "schild", "umhang", "mantel", "handschuh", "tafel",
  "schriftrolle", "urkunde", "münze", "gefäß", "kessel", "leuchter", "feder",
  "tinte",
]);

/** Anreden & Titel: deuten auf eine Person (Charakter) hin. */
const CHARACTER_MARKERS: ReadonlySet<string> = new Set<string>([
  "herr", "frau", "kapitän", "prinz", "prinzessin", "könig", "königin",
  "kaiser", "kaiserin", "doktor", "professor", "meister", "meisterin",
  "magister", "graf", "gräfin", "herzog", "herzogin", "baron", "baronin",
  "fürst", "fürstin", "lord", "lady", "sir", "madame", "pater", "bruder",
  "schwester", "general", "oberst", "leutnant", "sergeant", "hauptmann",
  "kommandant", "magier", "hexe", "priester", "priesterin", "bischof", "abt",
  "äbtissin", "onkel", "tante", "vater", "mutter", "sohn", "tochter", "freund",
  "freundin",
]);

/** Orts-Suffixe: ein Name mit diesem Auslaut wird als Ort eingeordnet. */
const PLACE_SUFFIXES: readonly string[] = [
  "burg", "stadt", "tal", "berg", "wald", "see", "dorf", "heim", "furt",
  "hafen", "insel", "garten", "land", "mark", "feld", "brück", "brücken",
  "höhe", "eck", "au", "ach", "ingen", "hausen", "hofen", "felden",
];

/** Artefakt-Suffixe: ein Name mit diesem Auslaut wird als Artefakt eingeordnet. */
const ARTIFACT_SUFFIXES: readonly string[] = [
  "schwert", "klinge", "krone", "kelch", "amulett", "talisman", "ring",
  "schlüssel", "grimoire", "zepter", "reliquie", "artefakt", "stein",
  "stab", "maske", "spiegel",
];

/** Alle Marker als Ausschlusswörter für die Namenserkennung. */
const EXCLUDED_WORDS: ReadonlySet<string> = new Set<string>([
  ...COMMON_WORDS,
  ...PLACE_MARKERS,
  ...ARTIFACT_MARKERS,
  ...CHARACTER_MARKERS,
]);

/**
 * Ordnet einen erkannten Eigennamen heuristisch einer Kategorie zu.
 * Reihenfolge: Kontextwort (Ort/Artefakt) → Suffix (Ort/Artefakt)
 * → Titel (Charakter) → Standard (Charakter).
 */
function classifyProperName(word: string, prevLower: string): ProperNameType {
  if (PLACE_MARKERS.has(prevLower)) return "place";
  if (ARTIFACT_MARKERS.has(prevLower)) return "artifact";

  const lower = word.toLowerCase();
  for (const suffix of PLACE_SUFFIXES) {
    if (lower.length > suffix.length + 1 && lower.endsWith(suffix)) {
      return "place";
    }
  }
  for (const suffix of ARTIFACT_SUFFIXES) {
    if (lower.length > suffix.length + 1 && lower.endsWith(suffix)) {
      return "artifact";
    }
  }
  if (CHARACTER_MARKERS.has(prevLower)) return "character";
  return "character";
}

/**
 * Extrahiert Eigennamen aus einem Text: großgeschriebene Wörter, die
 * nicht im Wörterbuch stehen, werden heuristisch in Charaktere, Orte
 * und Artefakte eingeordnet. Gleicher Text → gleiches Ergebnis.
 */
export function extractProperNames(text: string): ProperNamesResult {
  const empty: ProperNamesResult = {
    names: [],
    count: 0,
    byType: { characters: [], places: [], artifacts: [] },
  };
  if (typeof text !== "string" || text.trim().length === 0) return empty;

  const found = new Map<string, ProperNameType>();
  const tokenRe = /[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß'’-]*/g;
  let match: RegExpExecArray | null;
  let prevLower = "";

  while ((match = tokenRe.exec(text)) !== null) {
    const raw = match[0];
    const lower = raw.toLowerCase();
    const capitalized = /^[A-ZÄÖÜ]/.test(raw);
    if (capitalized && raw.length >= 2 && !EXCLUDED_WORDS.has(lower)) {
      if (!found.has(raw)) {
        found.set(raw, classifyProperName(raw, prevLower));
      }
    }
    prevLower = lower;
  }

  const names: string[] = [];
  const characters: string[] = [];
  const places: string[] = [];
  const artifacts: string[] = [];
  for (const [name, type] of found) {
    names.push(name);
    if (type === "character") characters.push(name);
    else if (type === "place") places.push(name);
    else artifacts.push(name);
  }

  return {
    names,
    count: names.length,
    byType: { characters, places, artifacts },
  };
}

// ---------------------------------------------------------------------------
// Feature 2: Doppelte Lautschrift-Generierung (WP 133.2)
// ---------------------------------------------------------------------------

/** Ergebnis einer einzelnen Aussprache-Analyse. */
export interface PronunciationEntry {
  /** Der Eigennamen in Originalschreibweise. */
  name: string;
  /** IPA-Schreibweise in eckigen Klammern, z. B. [ˈkaɪlən]. */
  ipa: string;
  /** Einfache Lautschrift mit Betonung, z. B. KAI-len (Betonung auf erster Silbe). */
  simple: string;
  /** Index der betonten Silbe (0-basiert). */
  stressIndex: number;
  /** Zerlegte Silben. */
  syllables: string[];
  /** Deutscher Hinweis für Sprecher. */
  notes: string;
}

/** Ergebnis eines vollständigen Lautschrift-Leitfadens. */
export interface PronunciationGuide {
  entries: {
    name: string;
    ipa: string;
    simple: string;
    syllables: string[];
    notes: string;
  }[];
  count: number;
  description: string;
}

/** Deutsche Hinweise für Hörbuch-Sprecher. */
const PRONUNCIATION_HINTS: readonly string[] = [
  "Für Sprecher: die betonte Silbe deutlich heben, den Rest weich ausklingen lassen.",
  "Im Hörbuch langsam und klar artikulieren, besonders vor Konsonantenclustern.",
  "Darauf achten, dass der Vokal der betonten Silbe lang gesprochen wird.",
  "Den Namen im gesamten Werk identisch aussprechen — einmal im Aufnahme-Notizblatt festhalten.",
  "Bei schneller Sprechweise neigen Sprecher zum Verschleifen; hier bewusst sauber trennen.",
  "Die Endsilbe nicht verschlucken, sie trägt den Wiedererkennungswert des Namens.",
];

/** Deutsche Ordnungszahlen (weibliche Form) für Silbenpositionen. */
function ordinalWord(index: number): string {
  const words = [
    "erster", "zweiter", "dritter", "vierter", "fünfter",
    "sechster", "siebter", "achter", "neunter", "zehnter",
  ];
  if (index >= 0 && index < words.length) return words[index];
  return `${index + 1}.`;
}

/** Zeichen, die als Vokalkern gelten. */
const VOWEL_CHARS = "aeiouäöüy";

/** Einzelzeichen → IPA-Laut. Vokalqualität hängt von der Betonung ab. */
function mapCharToIpa(ch: string, stressed: boolean): string {
  switch (ch) {
    case "a": return "a";
    case "e": return stressed ? "ɛ" : "ə";
    case "i": return "ɪ";
    case "o": return "ɔ";
    case "u": return "ʊ";
    case "ä": return "ɛ";
    case "ö": return "œ";
    case "ü": return "ʏ";
    case "y": return "y";
    case "b": return "b";
    case "c": return "k";
    case "d": return "d";
    case "f": return "f";
    case "g": return "g";
    case "h": return "h";
    case "j": return "j";
    case "k": return "k";
    case "l": return "l";
    case "m": return "m";
    case "n": return "n";
    case "p": return "p";
    case "q": return "k";
    case "r": return "ʁ";
    case "s": return "s";
    case "t": return "t";
    case "v": return "f";
    case "w": return "v";
    case "x": return "ks";
    case "z": return "ts";
    case "ß": return "s";
    default: return "";
  }
}

/** Graphem → IPA; längere Digraphen zuerst prüfen. */
const IPA_DIGRAPHS: readonly [string, string][] = [
  ["sch", "ʃ"],
  ["ch", "ç"],
  ["ph", "f"],
  ["th", "θ"],
  ["ck", "k"],
  ["ng", "ŋ"],
  ["qu", "kv"],
  ["ei", "aɪ"],
  ["ai", "aɪ"],
  ["ey", "aɪ"],
  ["ay", "aɪ"],
  ["eu", "ɔʏ"],
  ["äu", "ɔʏ"],
  ["au", "aʊ"],
  ["ie", "iː"],
  ["ee", "iː"],
  ["oo", "uː"],
  ["aa", "aː"],
  ["ah", "aː"],
  ["eh", "eː"],
  ["ih", "iː"],
  ["oh", "oː"],
  ["uh", "uː"],
];

/** Wandelt eine einzelne Silbe in IPA um (Betonung steuert die Vokalqualität). */
function syllableToIpa(syllable: string, stressed: boolean): string {
  const s = syllable.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const three = s.slice(i, i + 3);
    const two = s.slice(i, i + 2);
    let matched = false;
    for (const [graph, ipa] of IPA_DIGRAPHS) {
      if (graph.length === 3 && three === graph) {
        out += ipa;
        i += 3;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    for (const [graph, ipa] of IPA_DIGRAPHS) {
      if (graph.length === 2 && two === graph) {
        out += ipa;
        i += 2;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    out += mapCharToIpa(s[i], stressed);
    i += 1;
  }
  return out;
}

/**
 * Zerlegt einen Namen in Silben: je ein Vokalkern pro Silbe, dazwischen
 * liegende Konsonanten werden nach dem Onset-Prinzip aufgeteilt.
 */
function syllabify(name: string): string[] {
  const chars = [...name];
  const lower = chars.map((c) => c.toLowerCase());
  const isVowel = (c: string): boolean => VOWEL_CHARS.includes(c);

  const nuclei: { start: number; end: number }[] = [];
  let i = 0;
  while (i < lower.length) {
    if (isVowel(lower[i])) {
      let j = i;
      while (j + 1 < lower.length && isVowel(lower[j + 1])) j++;
      nuclei.push({ start: i, end: j });
      i = j + 1;
    } else {
      i++;
    }
  }
  if (nuclei.length === 0) return [name];

  const boundaries: number[] = [0];
  for (let k = 1; k < nuclei.length; k++) {
    const prevEnd = nuclei[k - 1].end;
    const curStart = nuclei[k].start;
    const gap = curStart - prevEnd - 1;
    boundaries.push(gap <= 1 ? prevEnd + 1 : curStart - 1);
  }

  const syllables: string[] = [];
  for (let k = 0; k < boundaries.length; k++) {
    const start = boundaries[k];
    const end = k + 1 < boundaries.length ? boundaries[k + 1] : chars.length;
    const slice = chars.slice(start, end).join("");
    if (slice.length > 0) syllables.push(slice);
  }
  return syllables.length > 0 ? syllables : [name];
}

/**
 * Erzeugt für einen Eigennamen IPA, einfache Lautschrift, Silben und
 * Sprecher-Hinweis. Deterministisch über den Seed.
 */
export function generatePronunciation(name: string, seed: number): PronunciationEntry {
  const safeName = typeof name === "string" && name.trim().length > 0 ? name.trim() : "Unbenannt";
  const syllables = syllabify(safeName);
  const rng = createSeededRandom(hashString(`${safeName}:${seed}`));

  const stressIndex = syllables.length > 0 ? Math.floor(rng() * syllables.length) : 0;

  const ipaBody = syllables
    .map((syl, idx) => (idx === stressIndex ? `ˈ${syllableToIpa(syl, true)}` : syllableToIpa(syl, false)))
    .join("");
  const ipa = `[${ipaBody}]`;

  const simpleBody = syllables
    .map((syl, idx) => (idx === stressIndex ? syl.toUpperCase() : syl.toLowerCase()))
    .join("-");
  const simple = `${simpleBody} (Betonung auf ${ordinalWord(stressIndex)} Silbe)`;

  const hint = pick(PRONUNCIATION_HINTS, rng);
  const syllableLabel = syllables.length === 1 ? "Silbe" : "Silben";
  const notes = `${syllables.length} ${syllableLabel}; Betonung auf ${ordinalWord(stressIndex)} Silbe. ${hint}`;

  return { name: safeName, ipa, simple, stressIndex, syllables, notes };
}

/**
 * Baut einen vollständigen Lautschrift-Leitfaden für eine Liste von
 * Eigennamen. Deterministisch über den Seed.
 */
export function buildPronunciationGuide(names: string[], seed: number): PronunciationGuide {
  const list = Array.isArray(names) ? names : [];
  const entries = list.map((n, idx) => {
    const p = generatePronunciation(n, seed + idx);
    return {
      name: p.name,
      ipa: p.ipa,
      simple: p.simple,
      syllables: p.syllables,
      notes: p.notes,
    };
  });

  const count = entries.length;
  const description =
    `Lautschrift-Leitfaden für ${count} ${count === 1 ? "Eigenname" : "Eigennamen"} ` +
    "zur Hörbuch-Produktion. Jede Aussprache ist mit IPA, einfacher " +
    "Lautschrift und Betonungshinweis hinterlegt.";

  return { entries, count, description };
}

// ---------------------------------------------------------------------------
// Feature 3: 1-Klick-Anhang-Export (WP 133.2)
// ---------------------------------------------------------------------------

/** Eine Sektion des druckfertigen Anhangs. */
export interface AppendixSection {
  heading: string;
  body: string;
}

/** Ergebnis des Anhang-Exports. */
export interface GlossaryAppendix {
  title: string;
  sections: AppendixSection[];
  pageCount: number;
  printReady: boolean;
  svgPreview: string;
}

/** Escaped XML-Sonderzeichen für sicheren Einbau in SVG-Text. */
function escapeXml(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Zeilen pro Anhang-Seite (für die Seitenzahl-Schätzung). */
const APPENDIX_ROWS_PER_PAGE = 22;

/**
 * Baut die SVG-Vorschau des Anhangs. Verwendet ausschließlich
 * CSS-Variablen (keine Hex-Farben), damit das Theme greift.
 */
function buildAppendixSvg(
  title: string,
  entries: { name: string; ipa: string; simple: string }[]
): string {
  const W = 595;
  const rowHeight = 26;
  const headerHeight = 90;
  const footerHeight = 40;
  const rows = Math.max(entries.length, 1);
  const H = headerHeight + rows * rowHeight + footerHeight;
  const margin = 40;
  const colName = margin;
  const colIpa = margin + 150;
  const colSimple = margin + 260;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  );
  parts.push(`<rect width="${W}" height="${H}" style="fill: var(--bg)"/>`);
  parts.push(`<rect x="0" y="0" width="${W}" height="56" style="fill: var(--accent)"/>`);
  parts.push(
    `<text x="${margin}" y="35" font-family="Georgia, serif" font-size="20" font-weight="bold" style="fill: var(--bg)">${escapeXml(title)}</text>`
  );
  parts.push(
    `<line x1="${margin}" y1="${headerHeight - 6}" x2="${W - margin}" y2="${headerHeight - 6}" style="stroke: var(--accent)" stroke-width="1.5"/>`
  );
  parts.push(
    `<text x="${colName}" y="${headerHeight + 12}" font-family="Georgia, serif" font-size="11" font-weight="bold" style="fill: var(--muted)">Eigenname</text>`
  );
  parts.push(
    `<text x="${colIpa}" y="${headerHeight + 12}" font-family="Georgia, serif" font-size="11" font-weight="bold" style="fill: var(--muted)">IPA</text>`
  );
  parts.push(
    `<text x="${colSimple}" y="${headerHeight + 12}" font-family="Georgia, serif" font-size="11" font-weight="bold" style="fill: var(--muted)">Einfache Lautschrift</text>`
  );

  entries.forEach((entry, idx) => {
    const y = headerHeight + 34 + idx * rowHeight;
    parts.push(
      `<text x="${colName}" y="${y}" font-family="Georgia, serif" font-size="13" style="fill: var(--accent)">${escapeXml(entry.name)}</text>`
    );
    parts.push(
      `<text x="${colIpa}" y="${y}" font-family="'Courier New', monospace" font-size="12" style="fill: var(--fg)">${escapeXml(entry.ipa)}</text>`
    );
    parts.push(
      `<text x="${colSimple}" y="${y}" font-family="Georgia, serif" font-size="11" style="fill: var(--muted)">${escapeXml(entry.simple)}</text>`
    );
  });

  parts.push(
    `<text x="${margin}" y="${H - 14}" font-family="Georgia, serif" font-size="10" style="fill: var(--muted)">${escapeXml("Druckfertiger Anhang — Aussprache-Verzeichnis der Eigennamen.")}</text>`
  );
  parts.push("</svg>");
  return parts.join("\n");
}

/**
 * Erzeugt aus einem Lautschrift-Leitfaden einen druckfertigen
 * Anhang (Sektionen, Seitenzahl, SVG-Vorschau). Deterministisch
 * über den Seed.
 */
export function exportGlossaryAppendix(
  guide: { entries: { name: string; ipa: string; simple: string }[] },
  seed: number
): GlossaryAppendix {
  const entries = guide && Array.isArray(guide.entries) ? guide.entries : [];
  const rng = createSeededRandom(hashString(`appendix:${seed}:${entries.length}`));

  const title = "Anhang: Aussprache-Verzeichnis der Eigennamen";

  const rules: string[] = [
    "IPA-Lautschrift steht in eckigen Klammern; das Zeichen ˈ markiert die betonte Silbe.",
    "Die einfache Lautschrift hebt die betonte Silbe in Großbuchstaben hervor.",
    "Vokalqualität: betonte Silben werden voll, unbetonte Silben abgeschwächt gesprochen.",
    "Digraphen wie „ei“, „au“ und „eu“ werden als ein Laut gesprochen.",
    "Der Name wird im gesamten Werk einheitlich ausgesprochen.",
  ];

  const entryLines = entries.map((e) => `${e.name} · ${e.ipa} · ${e.simple}`);

  const sections: AppendixSection[] = [
    {
      heading: "Einleitung",
      body:
        "Dieser Anhang fasst die Aussprache aller Eigennamen des Werkes " +
        "zusammen. Er richtet sich an Sprecherinnen und Sprecher der " +
        "Hörbuchproduktion sowie an alle, die Namen einheitlich vortragen möchten.",
    },
    {
      heading: "Aussprache-Regeln",
      body: rules.join("\n"),
    },
    {
      heading: "Eigennamen-Verzeichnis",
      body: entryLines.length > 0 ? entryLines.join("\n") : "Keine Eigennamen erfasst.",
    },
    {
      heading: "Hinweise für Sprecher",
      body: pick(PRONUNCIATION_HINTS, rng),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(entries.length / APPENDIX_ROWS_PER_PAGE) + 1);
  const svgPreview = buildAppendixSvg(title, entries);

  return {
    title,
    sections,
    pageCount,
    printReady: true,
    svgPreview,
  };
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/** Beispiel-Leitfaden mit festem Seed für Vorschau und Demo. */
export function createSamplePronunciationGuide(): PronunciationGuide {
  return buildPronunciationGuide(
    ["Kailen", "Aurelia", "Mordred", "Elowen", "Tharion", "Ysolda", "Balthasar"],
    42
  );
}

/** Beispiel-Anhang mit festem Seed für Vorschau und Demo. */
export function createSampleAppendix(): GlossaryAppendix {
  return exportGlossaryAppendix(createSamplePronunciationGuide(), 42);
}
