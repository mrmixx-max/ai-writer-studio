// Stil-Fingerprint & Floskel-Scanner (WP 15.2).
//
// Rein lokale, deterministische Textanalyse — kein LLM, keine Netzwerkzugriffe.
// Gemessen werden:
// - Perplexity  (Wort-Entropie als Proxy für lexikalische Überraschung)
// - Burstiness  (Dynamik der Satzlängen, Variationskoeffizient)
// - Satzvarianz (Varianz der Satzlängen)
// - durchschnittliche Satzlänge
// - Unique-Word-Ratio (Type-Token-Ratio)
// - überbeanspruchte 2–4-Wort-Kombinationen (Floskeln) samt Positionen
//
// Alle Funktionen sind defensiv: leere, zu kurze oder ungültige Eingaben
// liefern neutrale Nullwerte bzw. leere Arrays statt zu werfen.

export interface StyleFingerprint {
  /** Wort-Entropie-Proxy: 1 = ein Wort wiederholt, höher = vielfältiger. */
  perplexity: number;
  /** Satzlängen-Dynamik (Variationskoeffizient), 0 = alle Sätze gleich lang. */
  burstiness: number;
  /** Varianz der Satzlängen in Wörtern. */
  sentenceVariance: number;
  /** Durchschnittliche Satzlänge in Wörtern. */
  avgSentenceLength: number;
  /** Type-Token-Ratio: eindeutige Wörter / Gesamtwörter (0–1). */
  uniqueWordRatio: number;
}

export interface OverusedPhrase {
  /** Die 2–4-Wort-Kombination in Kleinschreibung. */
  phrase: string;
  /** Anzahl der Vorkommen im Text. */
  count: number;
  /** 0-basierte Wort-Token-Indizes des jeweiligen Phrasenstarts. */
  positions: number[];
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Wörter tokenisieren: Buchstaben/Ziffern inkl. Umlaute, Bindestrich/Apostroph. */
function tokenize(text: string): string[] {
  const hits = text.toLowerCase().match(/[a-zäöüß0-9]+(?:['’-][a-zäöüß0-9]+)*/gu);
  return hits ?? [];
}

/** Sätze an . ! ? … zerlegen (leere Fragmente werden verworfen). */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Wortanzahl je Satz. */
function sentenceLengths(text: string): number[] {
  return splitSentences(text).map((s) => tokenize(s).length);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function varianceOf(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return acc / values.length;
}

/** Auf zwei Nachkommastellen runden; nicht-endliche Werte → 0. */
function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Perplexity-Proxy über die Shannon-Entropie der Wortverteilung:
 *   H = −Σ p(w)·log2 p(w);  Perplexity = 2^H.
 * Bei einem einzigen wiederholten Wort ergibt das 1.
 */
function calculatePerplexity(words: string[]): number {
  if (words.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / words.length;
    entropy -= p * Math.log2(p);
  }
  return round2(2 ** entropy);
}

/** Prüft, ob `needle` als zusammenhängende Teilfolge in `haystack` vorkommt. */
function containsContiguous(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Berechnet den Stil-Fingerprint eines Textes.
 * Leerer Text oder Text ohne Sätze liefert ein Null-Fingerprint.
 */
export function analyzeStyleFingerprint(text: string): StyleFingerprint {
  const safe = typeof text === "string" ? text : "";
  const words = tokenize(safe);
  const sentences = splitSentences(safe);

  if (words.length === 0 || sentences.length === 0) {
    return {
      perplexity: 0,
      burstiness: 0,
      sentenceVariance: 0,
      avgSentenceLength: 0,
      uniqueWordRatio: 0,
    };
  }

  const lengths = sentences.map((s) => tokenize(s).length);
  const unique = new Set(words).size;

  return {
    perplexity: calculatePerplexity(words),
    burstiness: calculateBurstiness(safe),
    sentenceVariance: round2(varianceOf(lengths)),
    avgSentenceLength: round2(mean(lengths)),
    uniqueWordRatio: round2(unique / words.length),
  };
}

/**
 * Burstiness: Dynamik der Satzlängen als Variationskoeffizient
 * (Standardabweichung / Mittelwert).
 * 0 = alle Sätze gleich lang; höhere Werte = stärkerer Wechsel.
 * Weniger als zwei Sätze oder leerer Text → 0.
 */
export function calculateBurstiness(text: string): number {
  const safe = typeof text === "string" ? text : "";
  const lengths = sentenceLengths(safe);
  if (lengths.length < 2) return 0;
  const m = mean(lengths);
  if (m <= 0) return 0;
  return round2(Math.sqrt(varianceOf(lengths)) / m);
}

/** Reine Funktionswörter, die allein keine Floskel-Signatur tragen. */
const STOP_WORDS = new Set<string>([
  // Deutsch
  "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines",
  "und", "oder", "aber", "doch", "als", "wie", "wenn", "weil", "dass", "ob",
  "in", "im", "an", "am", "auf", "aus", "bei", "mit", "von", "vor",
  "zu", "zum", "zur", "nach", "über", "unter", "durch", "für", "gegen",
  "ohne", "um", "je", "pro",
  "ist", "sind", "war", "waren", "sein", "seine", "seinen", "ihre", "ihren", "ihr",
  "es", "er", "sie", "ich", "wir", "du", "man", "sich",
  // Englisch
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at",
  "for", "with", "is", "are", "was", "were", "be", "been", "it", "its",
]);

/**
 * Findet überbeanspruchte 2–4-Wort-Kombinationen (n-Gramme).
 *
 * - Standard-Mindesthäufigkeit: 3 (darf nicht unterschritten werden).
 * - Es werden nur „maximale“ Phrasen gemeldet: enthält eine längere Kandidaten-
 *   phrase eine kürzere zusammenhängend und kommt mindestens ebenso häufig vor,
 *   entfällt die kürzere (sonst würde „am ende des tages“ zusätzlich als
 *   „am ende“, „ende des“, „des tages“ … auftauchen).
 * - Reine Stoppwort-Kombinationen werden ignoriert.
 * - Sortierung: Häufigkeit absteigend, dann längere Phrase zuerst, dann alphabetisch.
 *
 * `positions` sind 0-basierte Wort-Token-Indizes des jeweiligen Phrasenstarts.
 * `maxResults` ist defensiv: ungültige oder nicht-positive Werte → 20.
 */
export function findOverusedPhrases(text: string, maxResults = 20): OverusedPhrase[] {
  const safe = typeof text === "string" ? text : "";
  const limit =
    Number.isFinite(maxResults) && maxResults >= 1 ? Math.floor(maxResults) : 20;

  const tokens = tokenize(safe);
  if (tokens.length < 6) return [];

  const counts = new Map<string, { count: number; positions: number[] }>();

  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const gram = tokens.slice(i, i + n);
      // Reine Funktionswort-Folgen tragen keine Floskel-Signatur.
      let allStop = true;
      for (const w of gram) {
        if (!STOP_WORDS.has(w)) {
          allStop = false;
          break;
        }
      }
      if (allStop) continue;

      const key = gram.join(" ");
      const entry = counts.get(key);
      if (entry) {
        entry.count++;
        entry.positions.push(i);
      } else {
        counts.set(key, { count: 1, positions: [i] });
      }
    }
  }

  const MIN_COUNT = 3;
  const candidates: Array<{ phrase: string; count: number; positions: number[]; words: string[] }> = [];
  for (const [phrase, { count, positions }] of counts) {
    if (count >= MIN_COUNT) {
      candidates.push({ phrase, count, positions, words: phrase.split(" ") });
    }
  }

  const maximal = candidates.filter((cand) =>
    !candidates.some(
      (other) =>
        other.words.length > cand.words.length &&
        other.count >= cand.count &&
        containsContiguous(other.words, cand.words),
    ),
  );

  maximal.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.words.length !== a.words.length) return b.words.length - a.words.length;
    return a.phrase.localeCompare(b.phrase, "de");
  });

  return maximal
    .slice(0, limit)
    .map((c) => ({ phrase: c.phrase, count: c.count, positions: c.positions }));
}

// ---------------------------------------------------------------------------
// Floskel-Alternativen (lokale, kuratierte Tabelle — kein LLM)
// ---------------------------------------------------------------------------

interface PhraseEntry {
  keys: readonly string[];
  alternatives: readonly string[];
}

/** Spezifische Phrasen zuerst, damit der Teilstring-Treffer sie bevorzugt. */
const PHRASE_ALTERNATIVES: readonly PhraseEntry[] = [
  { keys: ["am ende des tages"], alternatives: ["letztlich", "unterm Strich", "im Ergebnis"] },
  { keys: ["im wahrsten sinne des wortes", "im wahrsten sinne"], alternatives: ["buchstäblich", "tatsächlich", "ganz konkret"] },
  { keys: ["es versteht sich von selbst", "es versteht sich"], alternatives: ["selbstverständlich", "klar", "[streichen]"] },
  { keys: ["in anbetracht der tatsache", "in anbetracht"], alternatives: ["angesichts", "weil", "da"] },
  { keys: ["es ist wichtig zu beachten", "es ist wichtig zu wissen", "es ist wichtig zu"], alternatives: ["wichtig:", "entscheidend ist", "zu beachten:"] },
  { keys: ["in der heutigen zeit", "in der heutigen welt"], alternatives: ["heute", "derzeit", "gegenwärtig"] },
  { keys: ["wie bereits erwähnt", "wie schon erwähnt", "wie gesagt"], alternatives: ["wie erwähnt", "nochmals", "[streichen]"] },
  { keys: ["im großen und ganzen"], alternatives: ["überwiegend", "im Wesentlichen", "alles in allem"] },
  { keys: ["früher oder später"], alternatives: ["irgendwann", "über kurz oder lang", "letztlich"] },
  { keys: ["eine vielzahl von"], alternatives: ["viele", "zahlreiche", "eine Reihe"] },
  { keys: ["eine reihe von"], alternatives: ["mehrere", "viele", "etliche"] },
  { keys: ["eine große rolle spielen"], alternatives: ["bedeutsam sein", "entscheidend sein", "prägen"] },
  { keys: ["einen wichtigen beitrag leisten"], alternatives: ["beitragen zu", "fördern", "stützen"] },
  { keys: ["im grunde genommen", "im grunde"], alternatives: ["eigentlich", "genau genommen", "letztlich"] },
  { keys: ["im prinzip", "im prinzip schon"], alternatives: ["grundsätzlich", "im Kern", "im Wesentlichen"] },
  { keys: ["letzten endes"], alternatives: ["letztlich", "schlussendlich", "am Ende"] },
  { keys: ["auf jeden fall"], alternatives: ["in jedem Fall", "unbedingt", "gewiss"] },
  { keys: ["ohne zweifel"], alternatives: ["zweifellos", "sicher", "gewiss"] },
  { keys: ["meiner meinung nach"], alternatives: ["aus meiner Sicht", "ich finde", "ich halte … für"] },
  { keys: ["ich denke", "ich glaube"], alternatives: ["ich meine", "vermutlich", "meiner Einschätzung nach"] },
  { keys: ["in diesem zusammenhang"], alternatives: ["hierbei", "dabei", "in diesem Punkt"] },
  { keys: ["in bezug auf"], alternatives: ["bezüglich", "hinsichtlich", "zu"] },
  { keys: ["im hinblick auf"], alternatives: ["bezüglich", "hinsichtlich", "für"] },
  { keys: ["mit anderen worten"], alternatives: ["anders gesagt", "genauer", "kurz:"] },
  { keys: ["es handelt sich um"], alternatives: ["ist", "dabei geht es um", "es geht um"] },
  { keys: ["darüber hinaus"], alternatives: ["außerdem", "zudem", "überdies"] },
  { keys: ["des weiteren", "desweiteren"], alternatives: ["außerdem", "ferner", "zudem"] },
  { keys: ["zum einen"], alternatives: ["erstens", "einerseits"] },
  { keys: ["zum anderen"], alternatives: ["zweitens", "andererseits"] },
  { keys: ["auf der einen seite"], alternatives: ["einerseits"] },
  { keys: ["auf der anderen seite"], alternatives: ["andererseits", "hingegen", "demgegenüber"] },
  { keys: ["nach wie vor"], alternatives: ["weiterhin", "unverändert", "noch immer"] },
  { keys: ["in erster linie"], alternatives: ["vor allem", "hauptsächlich", "primär"] },
  { keys: ["zur gleichen zeit"], alternatives: ["zugleich", "gleichzeitig"] },
  { keys: ["hin und wieder"], alternatives: ["gelegentlich", "manchmal", "bisweilen"] },
  { keys: ["ab und zu"], alternatives: ["manchmal", "gelegentlich"] },
  { keys: ["nach und nach"], alternatives: ["allmählich", "schrittweise"] },
  { keys: ["immer wieder"], alternatives: ["wiederholt", "ständig", "beständig"] },
  { keys: ["im moment"], alternatives: ["derzeit", "aktuell", "gerade jetzt"] },
  { keys: ["im gegensatz dazu"], alternatives: ["hingegen", "dagegen", "demgegenüber"] },
  { keys: ["nichtsdestotrotz"], alternatives: ["dennoch", "trotzdem", "gleichwohl"] },
  { keys: ["wie dem auch sei"], alternatives: ["jedenfalls", "gleichviel"] },
  { keys: ["an dieser stelle"], alternatives: ["hier", "an diesem Punkt"] },
  { keys: ["sozusagen"], alternatives: ["gleichsam", "gewissermaßen", "[streichen]"] },
  { keys: ["last but not least"], alternatives: ["schließlich", "zuletzt", "nicht zuletzt"] },
  { keys: ["first and foremost"], alternatives: ["zuerst", "vor allem", "in erster Linie"] },
  { keys: ["at the end of the day"], alternatives: ["ultimately", "in the end", "finally"] },
];

/**
 * Schlägt Alternativen für eine Floskel vor.
 *
 * - Bekannte Phrase (case-insensitiv, Whitespace-normalisiert) → kuratierte Liste.
 * - Enthält die Eingabe eine bekannte Phrase als Teilstring → deren Liste.
 * - Unbekannte Phrase → generische, deterministische Hinweise (nie leer).
 * - Leere/ungültige Eingabe → leeres Array.
 */
export function suggestAlternatives(phrase: string): string[] {
  if (typeof phrase !== "string") return [];
  const normalized = phrase.toLowerCase().trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return [];

  const direct = PHRASE_ALTERNATIVES.find((e) => e.keys.includes(normalized));
  if (direct) return [...direct.alternatives];

  const partial = PHRASE_ALTERNATIVES.find((e) =>
    e.keys.some((k) => normalized.includes(k)),
  );
  if (partial) return [...partial.alternatives];

  return [
    `„${phrase.trim()}“ konkretisieren — eine kurze, direkte Formulierung wählen.`,
    "Kürzen: prüfen, ob die Phrase ersatzlos gestrichen werden kann.",
    "Durch ein einzelnes, präzises Wort ersetzen.",
  ];
}
