// Szenen-Spannungs-EKG (WP 50.2).
//
// Misst Satz für Satz den „Puls" einer Szene und erkennt statische
// Beschreibungsblöcke (Flatline) sowie Cliffhanger-Sogwirkung.
//
// Design-Regeln (analog zu neuroPacing / subplotWeaver):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefere leere Arrays
//     bzw. null statt zu werfen.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** EKG-Lesung eines einzelnen Satzes. */
export interface EcgReading {
  /** Der Satztext (getrimmt). */
  sentence: string;
  /** 0-basierter Index des Satzes im Quelltext. */
  index: number;
  /** Pulswert (0–100), höher = intensiver. */
  pulse: number;
  /** Verbdichte (0–100), Anteil der Verben am Satz. */
  verbDensity: number;
  /** Anzahl der Signalwörter im Satz. */
  signalWords: number;
  /** Anzahl der Sinnesimpuls-Wörter im Satz. */
  sensoryWords: number;
}

/** Warnung vor einem statischen Beschreibungsblock. */
export interface FlatlineWarning {
  /** Index des ersten Satzes im Flatline-Block. */
  startIndex: number;
  /** Index des letzten Satzes im Flatline-Block. */
  endIndex: number;
  /** Menschenlesbare Begründung. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Mindestlänge einer Flatline-Kette (mehr als 5 Sätze mit pulse < 20). */
export const FLATLINE_MIN_RUN = 6;

/** Puls-Schwellenwert, unter dem ein Satz als „flach" gilt. */
export const FLATLINE_PULSE_THRESHOLD = 20;

/** Gewichtung der Satzlänge an der Pulsberechnung. */
const WEIGHT_LENGTH = 0.3;

/** Gewichtung der Verbdichte an der Pulsberechnung. */
const WEIGHT_VERB = 0.3;

/** Gewichtung der Signalwörter an der Pulsberechnung. */
const WEIGHT_SIGNAL = 0.2;

/** Gewichtung der Sinnesimpulse an der Pulsberechnung. */
const WEIGHT_SENSORY = 0.2;

/** Pulsabzug pro Wort (kurze Sätze = hoher Puls). */
const LENGTH_DECAY_PER_WORD = 8;

/** Score pro Signalwort (saturierend bei 100). */
const SIGNAL_WORD_SCORE = 25;

/** Score pro Sinnesimpuls (saturierend bei 100). */
const SENSORY_WORD_SCORE = 25;

// ---------------------------------------------------------------------------
// Wortlisten (determinisch, deutsch)
// ---------------------------------------------------------------------------

/** Deutsche Signalwörter, die Spannung/Handlung andeuten. */
const SIGNAL_WORDS: readonly string[] = [
  "plötzlich", "sofort", "laut", "leise", "heftig", "stark", "hart",
  "schnell", "langsam", "dumpf", "schrill", "gellend", "knallend",
  "knisternd", "dröhnend", "schreiend", "stöhnend", "wimmernd",
  "klagend", "jubelnd", "lachend", "weinend", "schluchzend",
  "keuchend", "schnappend", "brüllend", "stampfend", "zitternd",
  "bebend", "erzittern", "beben", "klappern", "krachen", "knistern",
  "rumpeln", "dröhnen", "grollen", "toben", "stürmen", "rasen",
  "jagen", "stürzen", "stolpern", "fallen", "sinken", "steigen",
  "wachsen", "schwinden", "erlöschen", "aufblitzen", "aufleuchten",
  "erstrahlen", "glühen", "brennen", "lodern", "flackern",
  "schwanken", "wanken", "taumeln", "straucheln", "hinfallen",
  "umfallen", "zusammenbrechen", "einstürzen", "zusammensacken",
  "versinken", "ertrinken", "ersticken", "würgen", "beißen",
  "kratzen", "schlagen", "hauen", "prügeln", "treten", "stoßen",
  "schieben", "ziehen", "reißen", "zerren", "schleudern", "werfen",
  "schmeißen", "knallen", "schießen", "stechen", "schneiden",
  "hacken", "spalten", "zerreißen", "zermalmen", "zerstören",
  "vernichten", "auslöschen", "tilgen", "verbergen", "verstecken",
  "verhüllen", "vernebeln", "verschleiern", "verdecken", "vergraben",
  "versenken", "verbannen", "jagen", "hetzen", "verfolgen",
  "überfallen", "überraschen", "erschießen", "ermorden", "töten",
  "umbringen", "vergiften", "erhängen", "erstechen", "zermalmen",
  "zerquetschen", "zerschmettern", "zertrümmern", "demolieren",
  "sprengen", "bombardieren", "bomben", "angreifen", "attackieren",
  "kampf", "kämpfen", "streit", "streiten", "zank", "zanken",
  "hader", "hadern", "räson", "räsonieren", "tobsucht", "toben",
  "wahnsinn", "verrückt", "irrsinn", "delirium", "fieber",
  "schwitzen", "schwitz", "pochen", "klopfen", "hammernd",
  "rasend", "schnell", "rasch", "flink", "hastig", "eilig",
  "gehetzt", "gejagt", "verfolgt", "bedrängt", "bedroht",
  "gefahr", "gefährlich", "riskant", "gewagt", "mutig",
  "tapfer", "heldenhaft", "schrecklich", "furchtbar", "grausam",
  "grausig", "schaurig", "unheimlich", "gruselig", "makaber",
  "düster", "finster", "dunkel", "schwarz", "nacht",
  "mitternacht", "sturm", "gewitter", "donner", "blitz",
  "regen", "hagel", "schnee", "eis", "frost", "kälte",
  "hitze", "glut", "feuer", "flamme", "brand", "rauch",
  "asche", "staub", "nebel", "dunst", "schwüle", "druck",
  "spannung", "spannungsgeladen", "dramatisch", "dramatisch",
  "kritisch", "kritisch", "entscheidend", "entscheidend",
  "wichtig", "wichtig", "bedeutend", "bedeutend", "groß",
  "groß", "riesig", "gigantisch", "ungeheuer", "kolossal",
  "monströs", "furchterregend", "schauerlich", "entsetzlich",
  "abscheulich", "widerlich", "ekelhaft", "grauenhaft",
  "schreckenerregend", "panisch", "panik", "angst", "furcht",
  "schrecken", "grauen", "entsetzen", "horror", "schauer",
  "grusel", "thrill", "spannung", "suspense", "cliffhanger",
  "höhepunkt", "klimax", "krisis", "konflikt", "katastrophe",
  "desaster", "unglück", "tragödie", "drama", "dramatik",
  "spannungsbogen", "spannungsverlauf", "puls", "herz",
  "herzklopfen", "herzrasen", "pochen", "klopfen", "hammern",
  "schlagen", "schlag", "stoß", "stoss", "ruck", "ruckartig",
  "zucken", "zuckend", "krampf", "krampfend", "krampfartig",
  "zuckung", "zuckungen", "krampfanfall", "anfall", "attacke",
  "panikattacke", "herzinfarkt", "infarkt", "schlaganfall",
  "schlag", "schlagflug", "ohnmacht", "kollaps", "zusammenbruch",
  "kollabieren", "umkippen", "umfallen", "hinfallen", "stürzen",
  "absturz", "abstürzen", "crash", "krach", "knall", "bums",
  "explosion", "explodieren", "detonation", "detonieren",
  "sprengung", "sprengen", "sprengstoff", "bombe", "granate",
  "geschoss", "schuss", "feuer", "schießen", "schießerei",
  "kugel", "kugeln", "pistole", "revolver", "gewehr",
  "messer", "klinge", "dolch", "schwert", "axt", "beil",
  "hammer", "zange", "schere", "säge", "bohrer", "nagel",
  "schraube", "hammer", "hacke", "spaten", "schaufel",
  "karre", "wagen", "auto", "wagen", "fahrzeug", "motor",
  "maschine", "gerät", "apparat", "instrument", "werkzeug",
  "gerät", "ding", "sache", "gegenstand", "objekt", "artefakt",
  "reliquie", "amulett", "talisman", "zauber", "fluch",
  "hexerei", "magie", "magisch", "übernatürlich", "paranormal",
  "geist", "gespenst", "phantom", "schatten", "dämon",
  "teufel", "satan", "hölle", "feuer", "qual", "marter",
  "folter", "foltern", "quälen", "peinigen", "tortur",
  "tortur", "verhör", "verhören", "vernehmung", "befragung",
  "interrogation", "interrogieren", "einvernehmen", "aussage",
  "aussagen", "geständnis", "gestehen", "bekennen", "eingestehen",
  "zugeben", "zugestehen", "einräumen", "gestehen", "bekennen",
  "verraten", "verrat", "verräter", "veräterisch", "verrats",
  "verraten", "verraten", "verraten", "verraten", "verraten",
];

/** Deutsche Sinnesimpuls-Wörter (Sehen, Hören, Fühlen, Schmecken, Riechen). */
const SENSORY_WORDS: readonly string[] = [
  "sehen", "sah", "gesehen", "blick", "blicken", "schauen",
  "gucken", "starren", "stieren", "beobachten", "lugen",
  "hören", "hörte", "gehört", "klang", "klingen", "töne",
  "geräusch", "lärm", "knallen", "knistern", "rascheln",
  "surren", "brummen", "dröhnen", "grollen", "donnern",
  "blitzen", "glimmen", "glänzen", "schimmern", "funkeln",
  "leuchten", "erhellen", "dunkeln", "schattig", "farbe",
  "rot", "blau", "grün", "gelb", "schwarz", "weiß",
  "grau", "braun", "orange", "lila", "rosa", "türkis",
  "smell", "riechen", "roch", "geruch", "duft", "stinken",
  "foul", "muffig", "frisch", "scharf", "bitter", "süß",
  "sauer", "salzig", "umami", "geschmack", "schmecken",
  "tasten", "berühren", "fühlen", "spüren", "tasten",
  "kalt", "warm", "heiß", "eisig", "glühend", "schwitzig",
  "nass", "trocken", "feucht", "rau", "glatt", "scharf",
  "stumpf", "weich", "hart", "fest", "locker", "straff",
  "schwer", "leicht", "druck", "schmerz", "kribbeln",
  "jucken", "brennen", "stechen", "pochen", "klopfen",
  "zittern", "beben", "schauern", "gruseln", "schaudern",
  "haarsträubend", "schauer", "grusel", "schauerlich",
];

/** Deutsche Verben (Grundformen + häufige Beugungen) für die Verbdichte. */
const VERB_STEMS: readonly string[] = [
  "sein", "haben", "werden", "können", "müssen", "dürfen",
  "sollen", "wollen", "mögen", "lassen", "machen", "tun",
  "geben", "kommen", "sagen", "gehen", "wissen", "sehen",
  "lassen", "stehen", "finden", "bleiben", "liegen", "heißen",
  "denken", "nehmen", "halten", "bringen", "leben", "fahren",
  "sprechen", "spielen", "laufen", "tragen", "legen", "zeigen",
  "führen", "schreiben", "lesen", "arbeiten", "brauchen",
  "folgen", "lernen", "verstehen", "suchen", "setzen", "meinen",
  "kennen", "gelten", "stellen", "spielen", "ziehen", "fühlen",
  "erklären", "beginnen", "erzählen", "versuchen", "fragen",
  "kennen", "entscheiden", "scheinen", "warten", "verlieren",
  "zahlen", "erscheinen", "entstehen", "erhalten", "erkennen",
  "treffen", "wünschen", "bieten", "interessieren", "erinnern",
  "ändern", "schaffen", "erleben", "betrachten", "wählen",
  "hören", "schlagen", "fallen", "schießen", "stürzen",
  "laufen", "rennen", "klettern", "springen", "fliegen",
  "schwimmen", "tauchen", "kämpfen", "siegen", "verlieren",
  "sterben", "töten", "würgen", "ersticken", "ertrinken",
  "verbrennen", "explodieren", "zerstören", "bauen", "reißen",
  "brechen", "schneiden", "hacken", "stechen", "schießen",
  "werfen", "schleudern", "stoßen", "schieben", "ziehen",
  "reißen", "zerren", "drücken", "kneifen", "kratzen",
  "beißen", "schlucken", "kauen", "spucken", "kotzen",
  "weinen", "lachen", "schreien", "brüllen", "stöhnen",
  "keuchen", "schnaufen", "atmen", "pochen", "klopfen",
  "zittern", "beben", "schwanken", "wanken", "taumeln",
  "stolpern", "straucheln", "hinfallen", "umfallen",
  "zusammenbrechen", "einstürzen", "zusammensacken",
  "versinken", "ertrinken", "ersticken", "würgen",
  "beißen", "kratzen", "schlagen", "hauen", "prügeln",
  "treten", "stoßen", "schieben", "ziehen", "reißen",
  "zerren", "schleudern", "werfen", "schmeißen", "knallen",
  "schießen", "stechen", "schneiden", "hacken", "spalten",
  "zerreißen", "zermalmen", "zerstören", "vernichten",
  "auslöschen", "tilgen", "verbergen", "verstecken",
  "verhüllen", "vernebeln", "verschleiern", "verdecken",
  "vergraben", "versenken", "verbannen", "jagen", "hetzen",
  "verfolgen", "überfallen", "überraschen", "erschießen",
  "ermorden", "töten", "umbringen", "vergiften", "erhängen",
  "erstechen", "zermalmen", "zerquetschen", "zerschmettern",
  "zertrümmern", "demolieren", "sprengen", "bombardieren",
  "bomben", "angreifen", "attackieren", "kämpfen",
  "streiten", "zanken", "hadern", "räsonieren", "toben",
  "schwitzen", "pochen", "klopfen", "hammern", "rasen",
  "eilen", "hasten", "hetzen", "jagen", "verfolgen",
  "bedrängen", "bedrohen", "gefährden", "riskieren",
  "wagen", "mutigen", "tapfern", "helfen", "retten",
  "retten", "bewahren", "schützen", "verteidigen",
  "angreifen", "attackieren", "kampfen", "streiten",
  "zanken", "hadern", "räsonieren", "toben", "schwitzen",
  "pochen", "klopfen", "hammern", "rasen", "eilen",
  "hasten", "hetzen", "jagen", "verfolgen", "bedrängen",
  "bedrohen", "gefährden", "riskieren", "wagen", "mutigen",
  "tapfern", "helfen", "retten", "retten", "bewahren",
  "schützen", "verteidigen", "angreifen", "attackieren",
  "kampfen", "streiten", "zanken", "hadern", "räsonieren",
  "toben", "schwitzen", "pochen", "klopfen", "hammern",
  "rasen", "eilen", "hasten", "hetzen", "jagen",
  "verfolgen", "bedrängen", "bedrohen", "gefährden",
  "riskieren", "wagen", "mutigen", "tapfern", "helfen",
  "retten", "retten", "bewahren", "schützen", "verteidigen",
];

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Clamp einen Wert auf [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Zähle Vorkommen eines Wortes (case-insensitiv, Teilstring). */
function countOccurrences(text: string, word: string): number {
  if (!word) return 0;
  const lower = text.toLowerCase();
  const target = word.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = lower.indexOf(target, pos);
    if (idx === -1) break;
    count++;
    pos = idx + target.length;
  }
  return count;
}

/** Zähle distinkte Treffer aus einer Wortliste. */
function countDistinctHits(text: string, words: readonly string[]): number {
  let count = 0;
  for (const w of words) {
    if (countOccurrences(text, w) > 0) count++;
  }
  return count;
}

/** Extrahiere Sätze aus einem Text (defensiv). */
function splitSentences(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Trenne nach . ! ? und behalte die Zeichen als Satzzeichen bei.
  const parts = trimmed.split(/([.!?]+)/);
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i]?.trim() ?? "";
    const punct = parts[i + 1] ?? "";
    if (sentence) {
      sentences.push(sentence + punct);
    }
  }
  return sentences;
}

/** Zähle Wörter in einem Satz. */
function countWords(sentence: string): number {
  const words = sentence.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/** Berechne die Verbdichte (0–100). */
function computeVerbDensity(sentence: string): number {
  const wordCount = countWords(sentence);
  if (wordCount === 0) return 0;
  const verbCount = countDistinctHits(sentence, VERB_STEMS);
  return clamp(Math.round((verbCount / wordCount) * 100), 0, 100);
}

/** Berechne den Pulswert (0–100). */
function computePulse(sentence: string): number {
  const wordCount = countWords(sentence);
  const lengthScore = clamp(100 - wordCount * LENGTH_DECAY_PER_WORD, 0, 100);
  const verbDensity = computeVerbDensity(sentence);
  const signalCount = countDistinctHits(sentence, SIGNAL_WORDS);
  const sensoryCount = countDistinctHits(sentence, SENSORY_WORDS);
  const signalScore = clamp(signalCount * SIGNAL_WORD_SCORE, 0, 100);
  const sensoryScore = clamp(sensoryCount * SENSORY_WORD_SCORE, 0, 100);
  const pulse = Math.round(
    lengthScore * WEIGHT_LENGTH +
    verbDensity * WEIGHT_VERB +
    signalScore * WEIGHT_SIGNAL +
    sensoryScore * WEIGHT_SENSORY,
  );
  return clamp(pulse, 0, 100);
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Analysiere eine Szene Satz für Satz und liefere EKG-Lesungen.
 * Defensiv: leere/ungültige Eingabe → leeres Array.
 */
export function analyzeSceneTension(scene: string): EcgReading[] {
  if (!scene || typeof scene !== "string") return [];
  const sentences = splitSentences(scene);
  const readings: EcgReading[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!sentence) continue;
    readings.push({
      sentence,
      index: i,
      pulse: computePulse(sentence),
      verbDensity: computeVerbDensity(sentence),
      signalWords: countDistinctHits(sentence, SIGNAL_WORDS),
      sensoryWords: countDistinctHits(sentence, SENSORY_WORDS),
    });
  }
  return readings;
}

/**
 * Erkenne statische Beschreibungsblöcke (Flatline).
 * Defensiv: leeres Array → null.
 */
export function detectFlatline(readings: EcgReading[]): FlatlineWarning | null {
  if (!readings || readings.length === 0) return null;
  let runStart = -1;
  let runLength = 0;
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    if (!r || typeof r.pulse !== "number" || !Number.isFinite(r.pulse)) continue;
    if (r.pulse < FLATLINE_PULSE_THRESHOLD) {
      if (runStart === -1) runStart = i;
      runLength++;
    } else {
      if (runLength >= FLATLINE_MIN_RUN) {
        return {
          startIndex: runStart,
          endIndex: i - 1,
          reason: `Statischer Beschreibungsblock: ${runLength} aufeinanderfolgende Sätze mit Puls < ${FLATLINE_PULSE_THRESHOLD}.`,
        };
      }
      runStart = -1;
      runLength = 0;
    }
  }
  if (runLength >= FLATLINE_MIN_RUN) {
    return {
      startIndex: runStart,
      endIndex: readings.length - 1,
      reason: `Statischer Beschreibungsblock: ${runLength} aufeinanderfolgende Sätze mit Puls < ${FLATLINE_PULSE_THRESHOLD}.`,
    };
  }
  return null;
}

/**
 * Berechne die Cliffhanger-Sogwirkung der letzten 3 Sätze (0–100).
 * Defensiv: leere/ungültige Eingabe → 0.
 */
export function calculateCliffhangerScore(scene: string): number {
  if (!scene || typeof scene !== "string") return 0;
  const sentences = splitSentences(scene);
  if (sentences.length === 0) return 0;
  const lastN = sentences.slice(-3);
  let score = 0;
  for (const sentence of lastN) {
    if (!sentence) continue;
    // Offene Fragen
    if (sentence.includes("?")) score += 30;
    // Unvollendete Handlungen
    if (/\b(aber|doch|jedoch|dennoch|trotzdem|indessen|indes)\b/i.test(sentence)) {
      score += 25;
    }
    // Schock-Enthüllungen
    if (sentence.includes("!")) score += 30;
    // Zusätzliche Spannung durch Signalwörter
    const signalCount = countDistinctHits(sentence, SIGNAL_WORDS);
    score += clamp(signalCount * 5, 0, 15);
  }
  return clamp(score, 0, 100);
}
