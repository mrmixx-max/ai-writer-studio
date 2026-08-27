// Stilprüfung — vollständig regelbasiert, kein Modell nötig.
//
// Prüfbereiche: Füllwörter, Wiederholungen, Passivhäufung, Nominalstil,
// Klischees, Satzlängenmuster, Dialoganteil.
//
// Grundhaltung: Diese Prüfungen melden Auffälligkeiten, keine Fehler. Ein
// hoher Füllwortanteil kann Absicht sein, ein Passivsatz manchmal die richtige
// Wahl. Deshalb ist jeder Befund als "possible" eingestuft, nie als "error" —
// über literarische Absicht entscheidet der Autor, nicht das Werkzeug.

import type { AnalyzedText } from "./textmodel";

/** Füllwörter, die Texte weich machen, ohne Bedeutung zu tragen. */
export const FILLER_WORDS = [
  "eigentlich", "irgendwie", "quasi", "gewissermaßen", "letztlich",
  "praktisch", "sozusagen", "gleichsam", "eben", "halt", "wohl",
  "ziemlich", "recht", "durchaus", "geradezu", "regelrecht",
  "einfach", "einmal", "mal", "schon", "noch", "auch", "sehr",
  "ganz", "etwas", "relativ", "beinahe", "nahezu", "vielleicht",
  "offenbar", "scheinbar", "womöglich", "gewiss", "sicherlich",
  "natürlich", "selbstverständlich", "bekanntlich", "immerhin",
  "jedenfalls", "allerdings", "freilich", "indessen",
];

/**
 * Abgegriffene Wendungen.
 *
 * Bewusst ohne Artikel am Anfang notiert: „Herz schlug bis zum Hals" trifft
 * auch „sein Herz schlug…", „ihr Herz schlug…" und „das Herz schlug…".
 * Mit Artikel notiert würde die Wendung nur in einer von vier Varianten
 * erkannt — genau dieser Fehler ist beim Testen aufgefallen.
 */
export const CLICHES = [
  "wie aus dem Nichts",
  "in letzter Sekunde",
  "Blut gefror",
  "Stein und Bein",
  "Hals über Kopf",
  "auf Wolke sieben",
  "Tropfen, der das Fass",
  "wie ein Blitz aus heiterem Himmel",
  "Herz schlug bis zum Hals",
  "Herz klopfte bis zum Hals",
  "eine gefühlte Ewigkeit",
  "Zeit stand still",
  "mit einem Schlag",
  "Herz raste",
  "kalter Schweiß",
  "wie vom Donner gerührt",
  "Schmetterlinge im Bauch",
  "auf Messers Schneide",
  "am seidenen Faden",
  "wie ein offenes Buch",
  "Stille, die man schneiden konnte",
  "vor Angst wie gelähmt",
];

/** Nominalisierungs-Endungen, die Sätze schwerfällig machen. */
const NOMINAL_SUFFIXES = /\p{L}{4,}(ung|heit|keit|schaft|tum|nis)\b/gu;

/** Passiv-Erkennung: Hilfsverb + Partizip II. */
const PASSIVE = /\b(wurde|wurden|wird|werden|worden|ward)\b\s+(?:\p{L}+\s+){0,3}?\b(ge\p{L}+t|ge\p{L}+en)\b/giu;

/** Ergebnis einer Stilprüfung. */
export interface StyleIssue {
  kind:
    | "filler"
    | "repetition"
    | "passive"
    | "nominal"
    | "cliche"
    | "sentenceLength"
    | "dialogueRatio";
  /** Kurzbeschreibung in deutscher Sprache. */
  message: string;
  /** Erklärung, was daran auffällt und warum. */
  explanation: string;
  /** Position im Text, falls punktuell. */
  start: number | null;
  end: number | null;
  /** Der auffällige Textausschnitt. */
  snippet: string | null;
  /** 0..1, wie stark die Auffälligkeit ist. */
  weight: number;
}

/** Numerische Kennwerte des Textes. */
export interface StyleMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceWords: number;
  /** Standardabweichung der Satzlängen — niedrig heißt monoton. */
  sentenceLengthStdDev: number;
  longestSentenceWords: number;
  fillerRatio: number;
  passiveRatio: number;
  nominalRatio: number;
  dialogueRatio: number;
  /** Anteil einmalig verwendeter Wörter am Gesamtwortschatz. */
  lexicalVariety: number;
}

const STOPWORDS = new Set([
  "der", "die", "das", "und", "in", "zu", "den", "von", "mit", "sich",
  "auf", "für", "ist", "im", "dem", "nicht", "ein", "eine", "als", "auch",
  "es", "an", "werden", "aus", "er", "hat", "dass", "sie", "nach", "bei",
  "um", "am", "sind", "noch", "wie", "einem", "über", "einen", "so", "zum",
  "war", "haben", "nur", "oder", "aber", "vor", "zur", "bis", "mehr",
  "durch", "man", "sein", "wurde", "ich", "du", "wir", "ihr", "mich",
  "dich", "ihm", "ihn", "uns", "euch", "ihnen", "seine", "ihre", "was",
  "wenn", "dann", "doch", "hatte", "hatten", "ihren", "seinen", "dieser",
  "diese", "dieses", "einer", "eines", "vom", "beim", "wieder",
]);

/** Alle Wörter in Kleinschreibung. */
function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}]+(?:[-'’][\p{L}]+)*/gu) ?? []);
}

/** Standardabweichung. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Berechnet die Kennwerte eines Textes. */
export function computeMetrics(a: AnalyzedText): StyleMetrics {
  const all = words(a.raw);
  const lengths = a.sentences.map((s) => s.words).filter((n) => n > 0);
  const total = all.length || 1;

  const fillerCount = all.filter((w) => FILLER_WORDS.includes(w)).length;
  const passiveCount = (a.raw.match(PASSIVE) ?? []).length;
  const nominalCount = (a.raw.match(NOMINAL_SUFFIXES) ?? []).length;

  const dialogueWords = a.sentences
    .filter((s) => s.isDialogue)
    .reduce((acc, s) => acc + s.words, 0);

  const content = all.filter((w) => !STOPWORDS.has(w) && w.length > 2);
  const unique = new Set(content);

  return {
    wordCount: a.wordCount,
    sentenceCount: a.sentences.length,
    avgSentenceWords:
      lengths.length > 0
        ? Math.round((lengths.reduce((x, y) => x + y, 0) / lengths.length) * 10) / 10
        : 0,
    sentenceLengthStdDev: Math.round(stdDev(lengths) * 10) / 10,
    longestSentenceWords: lengths.length > 0 ? Math.max(...lengths) : 0,
    fillerRatio: Math.round((fillerCount / total) * 1000) / 1000,
    passiveRatio:
      a.sentences.length > 0
        ? Math.round((passiveCount / a.sentences.length) * 1000) / 1000
        : 0,
    nominalRatio: Math.round((nominalCount / total) * 1000) / 1000,
    dialogueRatio:
      a.wordCount > 0 ? Math.round((dialogueWords / a.wordCount) * 1000) / 1000 : 0,
    lexicalVariety:
      content.length > 0 ? Math.round((unique.size / content.length) * 1000) / 1000 : 0,
  };
}

// ---------------------------------------------------------------------------
//  Schwellwerte
//
//  Bewusst großzügig gewählt. Ein Werkzeug, das bei jedem dritten Satz
//  anschlägt, wird ignoriert — dann ist es wertlos. Diese Werte melden nur,
//  was auch einem aufmerksamen Lektor auffiele.
// ---------------------------------------------------------------------------
const T = {
  /** Füllwortanteil, ab dem es auffällt. */
  fillerRatio: 0.05,
  /** Passivsätze je Satz. */
  passiveRatio: 0.25,
  /** Nominalisierungen je Wort. */
  nominalRatio: 0.04,
  /** Sätze über dieser Wortzahl sind schwer lesbar. */
  longSentence: 45,
  /** Unter dieser Streuung wirken Satzlängen monoton. */
  minStdDev: 4,
  /** Mindestlänge, ab der Satzlängen-Monotonie überhaupt aussagekräftig ist. */
  minSentencesForRhythm: 12,
  /** Gleiches Wort so oft in einem Fenster von 40 Wörtern. */
  repetitionCount: 3,
  repetitionWindow: 40,
  /** Mindestlänge eines Wortes, das als Wiederholung zählt. */
  repetitionMinLen: 5,
  /**
   * Untergrenze für quotenbasierte Prüfungen.
   *
   * Unter dieser Wortzahl sind Anteile nicht aussagekräftig: Ein einzelnes
   * Füllwort in zehn Wörtern ergäbe 10 % und wäre ein Fehlalarm.
   *
   * 30 statt 50, weil Prüfungen auch auf kurze Absätze angewendet werden —
   * eine Szene mit fünf Passivsätzen in 40 Wörtern ist ein echter Befund.
   * Punktuelle Prüfungen (Klischees, überlange Sätze, Wiederholungen) haben
   * diese Grenze nicht, sie brauchen keine Quote.
   */
  minWordsForRatios: 30,
};

/**
 * Prüft einen Text auf stilistische Auffälligkeiten.
 * Läuft vollständig offline und liefert immer ein Ergebnis.
 */
export function checkStyle(a: AnalyzedText): { issues: StyleIssue[]; metrics: StyleMetrics } {
  const metrics = computeMetrics(a);
  const issues: StyleIssue[] = [];

  if (a.wordCount === 0) return { issues, metrics };

  // Quotenbasierte Prüfungen nur bei ausreichender Textlänge — sonst wären
  // Anteile Zufall. Punktuelle Prüfungen (Klischees, überlange Sätze,
  // Wiederholungen) laufen unabhängig davon, weil sie keine Quote brauchen.
  const ratiosMeaningful = a.wordCount >= T.minWordsForRatios;

  // --- Füllwörter ---------------------------------------------------------
  if (ratiosMeaningful && metrics.fillerRatio > T.fillerRatio) {
    const found = new Map<string, number>();
    for (const w of words(a.raw)) {
      if (FILLER_WORDS.includes(w)) found.set(w, (found.get(w) ?? 0) + 1);
    }
    const top = [...found.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([w, n]) => `${w} (${n}×)`)
      .join(", ");

    issues.push({
      kind: "filler",
      message: `Hoher Füllwortanteil: ${(metrics.fillerRatio * 100).toFixed(1)} %`,
      explanation:
        `Häufigste Füllwörter: ${top}. Füllwörter schwächen Aussagen ab. ` +
        "Streiche sie testweise — bleibt der Sinn erhalten, waren sie entbehrlich.",
      start: null,
      end: null,
      snippet: null,
      weight: Math.min(1, metrics.fillerRatio / (T.fillerRatio * 2)),
    });
  }

  // --- Passivhäufung ------------------------------------------------------
  if (ratiosMeaningful && metrics.passiveRatio > T.passiveRatio) {
    const first = PASSIVE.exec(a.raw);
    PASSIVE.lastIndex = 0; // Regex mit /g merkt sich die Position.

    issues.push({
      kind: "passive",
      message: `Viel Passiv: in ${(metrics.passiveRatio * 100).toFixed(0)} % der Sätze`,
      explanation:
        "Passivkonstruktionen verbergen, wer handelt. Im Erzähltext nimmt das " +
        "Tempo. Prüfe, ob eine handelnde Figur genannt werden kann.",
      start: first ? first.index : null,
      end: first ? first.index + first[0].length : null,
      snippet: first ? first[0] : null,
      weight: Math.min(1, metrics.passiveRatio / (T.passiveRatio * 2)),
    });
  }

  // --- Nominalstil --------------------------------------------------------
  if (ratiosMeaningful && metrics.nominalRatio > T.nominalRatio) {
    const m = a.raw.match(NOMINAL_SUFFIXES);
    issues.push({
      kind: "nominal",
      message: `Nominalstil: ${(metrics.nominalRatio * 100).toFixed(1)} % Substantivierungen`,
      explanation:
        `Beispiele: ${(m ?? []).slice(0, 6).join(", ")}. Substantivierungen auf ` +
        "-ung, -heit, -keit machen Sätze statisch. Ein Verb wirkt lebendiger " +
        "als das Substantiv, das daraus gebildet wurde.",
      start: null,
      end: null,
      snippet: null,
      weight: Math.min(1, metrics.nominalRatio / (T.nominalRatio * 2)),
    });
  }

  // --- Überlange Sätze ----------------------------------------------------
  for (const s of a.sentences) {
    if (s.words > T.longSentence) {
      issues.push({
        kind: "sentenceLength",
        message: `Sehr langer Satz: ${s.words} Wörter`,
        explanation:
          "Sätze über 45 Wörter verlieren den Leser. Prüfe, ob sich der Satz " +
          "an einer Konjunktion teilen lässt.",
        start: s.start,
        end: s.end,
        snippet: s.text.slice(0, 120) + (s.text.length > 120 ? "…" : ""),
        weight: Math.min(1, s.words / (T.longSentence * 2)),
      });
    }
  }

  // --- Monotoner Satzrhythmus --------------------------------------------
  if (
    ratiosMeaningful &&
    a.sentences.length >= T.minSentencesForRhythm &&
    metrics.sentenceLengthStdDev < T.minStdDev
  ) {
    issues.push({
      kind: "sentenceLength",
      message: `Gleichförmiger Satzrhythmus (Streuung ${metrics.sentenceLengthStdDev})`,
      explanation:
        `Die Sätze sind fast alle etwa ${metrics.avgSentenceWords} Wörter lang. ` +
        "Wechselnde Längen erzeugen Rhythmus; gleichförmige wirken monoton. " +
        "Ein kurzer Satz nach einem langen setzt einen Akzent.",
      start: null,
      end: null,
      snippet: null,
      weight: 0.5,
    });
  }

  // --- Klischees ----------------------------------------------------------
  const lower = a.raw.toLowerCase();
  for (const c of CLICHES) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx >= 0) {
      issues.push({
        kind: "cliche",
        message: `Abgegriffene Wendung: „${c}“`,
        explanation:
          "Solche Formulierungen sind so verbraucht, dass sie kein Bild mehr " +
          "erzeugen. Ein eigenes Bild wirkt stärker.",
        start: idx,
        end: idx + c.length,
        snippet: a.raw.slice(idx, idx + c.length),
        weight: 0.6,
      });
    }
  }

  // --- Wortwiederholungen in engem Abstand -------------------------------
  const all = words(a.raw);
  const seen = new Map<string, number[]>();
  all.forEach((w, i) => {
    if (w.length < T.repetitionMinLen || STOPWORDS.has(w)) return;
    const arr = seen.get(w) ?? [];
    arr.push(i);
    seen.set(w, arr);
  });

  for (const [word, positions] of seen) {
    if (positions.length < T.repetitionCount) continue;
    // Gleitendes Fenster: liegen genug Vorkommen dicht beieinander?
    for (let i = 0; i + T.repetitionCount - 1 < positions.length; i++) {
      const span = positions[i + T.repetitionCount - 1] - positions[i];
      if (span <= T.repetitionWindow) {
        const idx = a.raw.toLowerCase().indexOf(word);
        issues.push({
          kind: "repetition",
          message: `„${word}“ ${T.repetitionCount}× auf engem Raum`,
          explanation:
            `Das Wort erscheint ${T.repetitionCount} Mal innerhalb von etwa ` +
            `${span} Wörtern. Unbeabsichtigte Wiederholungen fallen beim Lesen auf. ` +
            "Als Stilmittel eingesetzt, kannst du den Befund als bewusst markieren.",
          start: idx >= 0 ? idx : null,
          end: idx >= 0 ? idx + word.length : null,
          snippet: word,
          weight: 0.5,
        });
        break; // Ein Befund je Wort genügt.
      }
    }
  }

  return { issues, metrics };
}
