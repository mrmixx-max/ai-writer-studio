// Dialog-Subtext & Machtbalance (WP 37.1).
//
// Werkzeuge, um Dialoge auf Subtext, Infodumps und Rede-Machtverhältnisse zu
// prüfen:
//
//   1. detectExpositionDump    — findet „As you know, Bob"-Infodumps: Figuren
//                                erzählen einander Fakten, die sie längst kennen,
//                                nur um das Publikum zu informieren.
//   2. analyzePowerBalance     — misst Redezeit, Fragen vs. Befehle und
//                                Themawechsel je Figur und bestimmt die
//                                dominierende Sprecherposition.
//   3. detectSubtextMarkers    — markiert emotionale Diskrepanzen zwischen dem
//                                Gesagten und der begleitenden Handlung
//                                (Action-Tag), z. B. „Mir geht es gut." +
//                                „zittert".
//
// Design-Regeln (analog zu neuroPacing / subplotWeaver):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Arrays
//     bzw. ein definiertes Null-Ergebnis statt zu werfen.
//   - Keine Zufallswerte, keine Zeitabhängigkeit: identische Eingabe ⇒
//     identische Ausgabe.

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

/** Eine einzelne Dialogzeile mit explizit annotierten Sprechakten. */
export interface DialogueLine {
  /** Sprechername. */
  speaker: string;
  /** Gesprochener Text. */
  text: string;
  /** Ist die Zeile eine Frage? */
  isQuestion: boolean;
  /** Ist die Zeile ein Befehl? */
  isCommand: boolean;
  /** Unterbricht die Zeile die vorherige? */
  interrupts: boolean;
}

/** Ein gefundener Exposition-Dump („As you know, Bob"). */
export interface ExpositionFinding {
  /** Die auslösende Phrase (lowercase, wie im Katalog). */
  phrase: string;
  /** 0-basierte Zeichenposition im analysierten Text. */
  position: number;
  /** Menschenlesbare Begründung. */
  reason: string;
}

/** Machtbalance einer einzelnen Figur. */
export interface SpeakerBalance {
  /** Sprechername. */
  name: string;
  /** Anteil an der gesamten Redezeit (Wörter), 0–1, auf 3 Stellen gerundet. */
  talkRatio: number;
  /** Anteil an allen Fragen, 0–1, auf 3 Stellen gerundet. */
  questionRatio: number;
  /** Anteil an allen Befehlen, 0–1, auf 3 Stellen gerundet. */
  commandRatio: number;
  /** Anzahl der von dieser Figur ausgelösten Themawechsel. */
  topicChanges: number;
}

/** Gesamte Machtbalance eines Dialogabschnitts. */
export interface PowerBalance {
  /** Figuren, absteigend nach Redezeit (Gleichstand: alphabetisch). */
  speakers: SpeakerBalance[];
  /** Name der dominierenden Figur (leer, wenn keine Zeilen vorliegen). */
  dominantSpeaker: string;
}

/** Eine emotionale Diskrepanz zwischen Aussage und Handlung. */
export interface SubtextMarker {
  /** Die gesprochene Aussage. */
  statement: string;
  /** Der begleitende Action-Tag. */
  actionTag: string;
  /** Menschenlesbare Beschreibung der Diskrepanz. */
  discrepancy: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Standardname für Zeilen ohne (oder mit leerem) Sprecher. */
export const UNKNOWN_SPEAKER = "Unbekannt";

/** Begründung für „As you know"-Marker. */
const AS_YOU_KNOW_REASON =
  "Klassischer „As you know, Bob\"-Marker: Figuren sagen sich gegenseitig bekannte Fakten nur fürs Publikum.";

/** Begründung für Rekapitulations-Marker. */
const RECAP_REASON =
  "Rückblenden-Exposition: vergangenes Wissen wird im Dialog wiederholt, um Leser zu informieren.";

/** Begründung für Allgemeinwissen-Marker. */
const COMMON_KNOWLEDGE_REASON =
  "Selbstverständlichkeits-Exposition: Fakten werden als Allgemeinwissen ausgegeben, um Hintergrund zu erklären.";

/**
 * Katalog auslösender Phrasen für Exposition-Dumps.
 * `reason` gruppiert die Muster in menschenlesbare Begründungen.
 */
export const EXPOSITION_PHRASES: ReadonlyArray<{ phrase: string; reason: string }> = [
  // „As you know, Bob" — Figuren erzählen sich bekanntes Wissen.
  { phrase: "wie du weißt", reason: AS_YOU_KNOW_REASON },
  { phrase: "wie sie wissen", reason: AS_YOU_KNOW_REASON },
  { phrase: "wie ihr wisst", reason: AS_YOU_KNOW_REASON },
  { phrase: "wie du sicher weißt", reason: AS_YOU_KNOW_REASON },
  { phrase: "wie sie sicher wissen", reason: AS_YOU_KNOW_REASON },
  { phrase: "du weißt ja", reason: AS_YOU_KNOW_REASON },
  { phrase: "sie wissen ja", reason: AS_YOU_KNOW_REASON },
  { phrase: "as you know", reason: AS_YOU_KNOW_REASON },
  { phrase: "you already know", reason: AS_YOU_KNOW_REASON },
  { phrase: "of course you know", reason: AS_YOU_KNOW_REASON },
  // Rekapitulation vergangenen Wissens.
  { phrase: "wie gesagt", reason: RECAP_REASON },
  { phrase: "wie bereits gesagt", reason: RECAP_REASON },
  { phrase: "wie ich bereits sagte", reason: RECAP_REASON },
  { phrase: "wie ich schon sagte", reason: RECAP_REASON },
  { phrase: "erinnerst du dich", reason: RECAP_REASON },
  { phrase: "erinnern sie sich", reason: RECAP_REASON },
  { phrase: "weißt du noch", reason: RECAP_REASON },
  { phrase: "weisst du noch", reason: RECAP_REASON },
  { phrase: "as i said", reason: RECAP_REASON },
  { phrase: "as i mentioned", reason: RECAP_REASON },
  { phrase: "as we discussed", reason: RECAP_REASON },
  { phrase: "as you may recall", reason: RECAP_REASON },
  { phrase: "as you recall", reason: RECAP_REASON },
  { phrase: "remember when", reason: RECAP_REASON },
  // Selbstverständliches Allgemeinwissen.
  { phrase: "bekanntlich", reason: COMMON_KNOWLEDGE_REASON },
  { phrase: "nicht wahr", reason: COMMON_KNOWLEDGE_REASON },
  { phrase: "needless to say", reason: COMMON_KNOWLEDGE_REASON },
  { phrase: "everybody knows", reason: COMMON_KNOWLEDGE_REASON },
];

/** Wörter, die bei der Themawechsel-Erkennung ignoriert werden. */
const STOPWORDS: ReadonlySet<string> = new Set([
  "aber", "auch", "dass", "denn", "doch", "eine", "einem", "einen", "einer", "eines",
  "etwas", "immer", "kann", "muss", "nicht", "nichts", "noch", "oder", "schon", "sehr",
  "sich", "sind", "soll", "über", "unter", "wenn", "werden", "wieder", "wird", "zwar",
  "zwischen", "diese", "dieser", "dieses", "damit", "dann", "dort", "hier", "haben",
  "hatte", "wurde", "sein", "mein", "meine", "dein", "deine", "ihre", "ihren", "unser",
  "unsere", "this", "that", "with", "have", "will", "would", "there", "their", "what",
  "when", "your", "yours", "about", "from", "they", "them", "then", "been", "were",
]);

/** Minimale Token-Länge für die Themawechsel-Erkennung. */
export const MIN_TOPIC_TOKEN_LENGTH = 4;

/** Positive Signalwörter in gesprochenen Aussagen. */
const STATEMENT_POSITIVE: readonly string[] = [
  "freut mich", "geht es gut", "geht mir gut", "alles gut", "alles in ordnung",
  "kein problem", "gern geschehen", "gern", "liebe", "danke", "wunderbar", "herrlich",
  "perfekt", "schön", "passt schon", "schon gut", "bin glücklich", "ich mag",
];

/** Negative Signalwörter in gesprochenen Aussagen. */
const STATEMENT_NEGATIVE: readonly string[] = [
  "hasse", "hass", "wut", "wütend", "verachte", "schrecklich", "fürchte", "angst",
  "traurig", "schmerz", "geht nicht", "niemals", "verrate", "lüge", "schweig",
  "lass mich", "elend", "gleichgültig", "egal", "nein",
];

/** Negative (angespannte/ablehnende) Signalwörter in Action-Tags. */
const ACTION_NEGATIVE: readonly string[] = [
  "zittert", "zitter", "ballt", "fäuste", "faust", "weint", "tränen", "zuckt zusammen",
  "weicht zurück", "starrt", "erstarrt", "bleich", "kalt", "dreht sich weg",
  "wendet sich ab", "schaut weg", "bebt", "krampft", "beißt", "kneift", "atmet schwer",
  "schluckt", "versteift", "verharrt", "zurück",
];

/** Positive (warme/zugewandte) Signalwörter in Action-Tags. */
const ACTION_POSITIVE: readonly string[] = [
  "lächelt", "lacht", "grinst", "nickt", "entspannt", "zärtlich", "streichelt",
  "umarmt", "zwinkert", "strahlt", "glüht vor", "leuchtet",
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Locale-unabhängiger String-Vergleich (deterministisch). */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Zahl auf 3 Nachkommastellen runden (deterministisch, kein Zufall). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Text in umlautbewusste Kleinbuchstaben-Tokens zerlegen. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß]+/)
    .filter((token) => token.length > 0);
}

/** Signifikante Tokens (Länge ≥ Schwelle, kein Stoppwort). */
function significantTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const token of tokenize(text)) {
    if (token.length >= MIN_TOPIC_TOKEN_LENGTH && !STOPWORDS.has(token)) out.add(token);
  }
  return out;
}

/** Zwei Mengen schneiden sich nicht? (leere Menge ⇒ kein Themawechsel). */
function disjoint(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const token of a) {
    if (b.has(token)) return false;
  }
  return true;
}

/** Wie viele der Phrasen kommen (case-insensitiv) im Text vor? */
function countPhrases(lowerText: string, phrases: readonly string[]): number {
  let hits = 0;
  for (const phrase of phrases) {
    if (lowerText.includes(phrase)) hits += 1;
  }
  return hits;
}

/** Sentiment einer Aussage: positive, negative oder neutral (Gleichstand). */
function statementSentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  const pos = countPhrases(lower, STATEMENT_POSITIVE);
  const neg = countPhrases(lower, STATEMENT_NEGATIVE);
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

/** Sentiment eines Action-Tags: positive, negative oder neutral (Gleichstand). */
function actionSentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  const pos = countPhrases(lower, ACTION_POSITIVE);
  const neg = countPhrases(lower, ACTION_NEGATIVE);
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

/** Normalisierte, garantierte Dialogzeile. */
interface NormalizedLine {
  speaker: string;
  text: string;
  isQuestion: boolean;
  isCommand: boolean;
  interrupts: boolean;
}

/** Dialogzeilen defensiv normalisieren (ungültige Einträge verwerfen). */
function normalizeLines(lines: unknown): NormalizedLine[] {
  if (!Array.isArray(lines)) return [];
  const out: NormalizedLine[] = [];
  for (const entry of lines) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const speaker =
      typeof raw.speaker === "string" && raw.speaker.trim().length > 0
        ? raw.speaker.trim()
        : UNKNOWN_SPEAKER;
    out.push({
      speaker,
      text: typeof raw.text === "string" ? raw.text : "",
      isQuestion: raw.isQuestion === true,
      isCommand: raw.isCommand === true,
      interrupts: raw.interrupts === true,
    });
  }
  return out;
}

/** Akkumulator je Sprecher während der Machtbalance-Analyse. */
interface SpeakerAcc {
  name: string;
  words: number;
  questions: number;
  commands: number;
  topicChanges: number;
}

// ---------------------------------------------------------------------------
// 1) Exposition-Dumps
// ---------------------------------------------------------------------------

/**
 * Erkennt „As you know, Bob"-Infodumps in einem Dialogtext.
 *
 * Sucht case-insensitiv nach einem kuratierten Katalog auslösender Phrasen und
 * liefert je Vorkommen einen Treffer mit 0-basierter Zeichenposition. Die
 * Ergebnisse sind stabil nach Position, dann nach Phrase sortiert. Nicht-String-
 * oder leere Eingaben liefern ein leeres Array (kein Throw).
 */
export function detectExpositionDump(dialogue: string): ExpositionFinding[] {
  if (typeof dialogue !== "string" || dialogue.length === 0) return [];
  const lower = dialogue.toLowerCase();
  const findings: ExpositionFinding[] = [];
  const seen = new Set<string>();

  for (const { phrase, reason } of EXPOSITION_PHRASES) {
    let from = 0;
    while (from <= lower.length - phrase.length) {
      const idx = lower.indexOf(phrase, from);
      if (idx < 0) break;
      const key = `${idx}:${phrase}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push({ phrase, position: idx, reason });
      }
      from = idx + phrase.length;
    }
  }

  return findings.sort((a, b) => a.position - b.position || cmpStr(a.phrase, b.phrase));
}

// ---------------------------------------------------------------------------
// 2) Machtbalance
// ---------------------------------------------------------------------------

/**
 * Misst die Machtbalance eines Dialogabschnitts.
 *
 * Je Sprecher werden Redezeit (Wortanteil), Fragen-, Befehlsanteil und die Zahl
 * der ausgelösten Themawechsel berechnet. Ein Themawechsel liegt vor, wenn eine
 * Zeile kein signifikantes Token mit der unmittelbar vorangehenden Zeile teilt
 * (leere Token-Mengen zählen nicht als Wechsel). `dominantSpeaker` ist die
 * Figur mit dem größten Redeanteil; bei Gleichstand entscheidet der Name
 * alphabetisch. Fehlende/ungültige Eingaben liefern `{ speakers: [], dominantSpeaker: "" }`.
 */
export function analyzePowerBalance(lines: DialogueLine[]): PowerBalance {
  const normalized = normalizeLines(lines);
  if (normalized.length === 0) return { speakers: [], dominantSpeaker: "" };

  const accs = new Map<string, SpeakerAcc>();
  const accFor = (name: string): SpeakerAcc => {
    let acc = accs.get(name);
    if (!acc) {
      acc = { name, words: 0, questions: 0, commands: 0, topicChanges: 0 };
      accs.set(name, acc);
    }
    return acc;
  };

  let totalWords = 0;
  let totalQuestions = 0;
  let totalCommands = 0;

  for (let i = 0; i < normalized.length; i++) {
    const line = normalized[i];
    const acc = accFor(line.speaker);
    const words = tokenize(line.text).length;
    acc.words += words;
    totalWords += words;

    if (line.isQuestion) {
      acc.questions += 1;
      totalQuestions += 1;
    }
    if (line.isCommand) {
      acc.commands += 1;
      totalCommands += 1;
    }

    if (i > 0) {
      const prev = significantTokens(normalized[i - 1].text);
      const curr = significantTokens(line.text);
      if (disjoint(curr, prev)) acc.topicChanges += 1;
    }
  }

  const speakers: SpeakerBalance[] = [...accs.values()]
    .map((acc) => ({
      name: acc.name,
      talkRatio: totalWords > 0 ? round3(acc.words / totalWords) : 0,
      questionRatio: totalQuestions > 0 ? round3(acc.questions / totalQuestions) : 0,
      commandRatio: totalCommands > 0 ? round3(acc.commands / totalCommands) : 0,
      topicChanges: acc.topicChanges,
    }))
    .sort((a, b) => b.talkRatio - a.talkRatio || cmpStr(a.name, b.name));

  return { speakers, dominantSpeaker: speakers[0]?.name ?? "" };
}

// ---------------------------------------------------------------------------
// 3) Subtext-Marker
// ---------------------------------------------------------------------------

/**
 * Markiert emotionale Diskrepanzen zwischen Aussage und begleitender Handlung.
 *
 * Der Dialog wird in Aussagen (Satzgrenzen/Zeilen) zerlegt und der Reihe nach
 * mit den Action-Tags gepaart (Index-Ausrichtung, bis zur kürzeren Liste). Eine
 * Diskrepanz entsteht, wenn die Aussage positiv, die Handlung aber negativ
 * wirkt (beschwichtigende Worte, angespannter Körper) oder umgekehrt. Neutrale
 * Signale erzeugen keine Marker. Fehlende/ungültige Eingaben liefern ein leeres
 * Array (kein Throw).
 */
export function detectSubtextMarkers(dialogue: string, actionTags: string[]): SubtextMarker[] {
  if (typeof dialogue !== "string" || dialogue.length === 0) return [];
  if (!Array.isArray(actionTags)) return [];

  const statements = dialogue
    .split(/[.!?]+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const tags: string[] = [];
  for (const tag of actionTags) {
    if (typeof tag === "string" && tag.trim().length > 0) tags.push(tag.trim());
  }

  const pairCount = Math.min(statements.length, tags.length);
  const markers: SubtextMarker[] = [];

  for (let i = 0; i < pairCount; i++) {
    const statement = statements[i];
    const actionTag = tags[i];
    const said = statementSentiment(statement);
    const shown = actionSentiment(actionTag);

    if (said === "positive" && shown === "negative") {
      markers.push({
        statement,
        actionTag,
        discrepancy:
          "Emotionale Diskrepanz: Die Aussage wirkt beschwichtigend/positiv, die Handlung verrät Anspannung oder Ablehnung.",
      });
    } else if (said === "negative" && shown === "positive") {
      markers.push({
        statement,
        actionTag,
        discrepancy:
          "Emotionale Diskrepanz: Die Aussage wirkt schroff/negativ, die Handlung verrät Wärme oder Zustimmung.",
      });
    }
  }

  return markers;
}
