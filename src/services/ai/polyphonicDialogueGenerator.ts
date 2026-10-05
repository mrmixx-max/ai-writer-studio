// Polyphoner Dialog-Generator (WP 54.2)
//
// Erzeugt rhythmischen Schlagabtausch zwischen 2–4 Figuren mit individuellen
// Sprechmustern, verdeckten Absichten (Subtext) und Körpersprache-Inquits.
//
// Drei deterministische Werkzeuge:
//
//   1. generateDialogue  — Dialog aus Figuren-Setup + Konflikt-Vorgabe
//   2. detectSubtext     — verdeckte Absichten in vorhandenem Dialog finden
//   3. analyzePolyphony  — Sprechanteile und Rhythmus eines Dialogs messen
//
// Design-Regeln (analog proseExpander / editorialCouncil):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Sprechmuster einer Figur. */
export interface SpeechPattern {
  /** Slang-Neigung 0–1 (hoch = umgangssprachlich). */
  slang?: number;
  /** Förmlichkeit 0–1 (hoch = distanziert/höflich). */
  formality?: number;
  /** Sprechtempo 0–1 (hoch = kurz und schnell). */
  tempo?: number;
}

/** Eine sprechende Figur. */
export interface DialogueCharacter {
  /** Eindeutiger Name. */
  name: string;
  /** Optionale Rolle, z. B. 'Detective'. */
  role?: string;
  /** Sprechmuster. */
  pattern?: SpeechPattern;
  /** Verdeckte Absicht, z. B. 'sucht ein Geständnis'. */
  intent?: string;
}

/** Optionen für die Dialog-Erzeugung. */
export interface DialogueOptions {
  /** Gesprächsziel, z. B. „Detective sucht Geständnis". */
  conflict?: string;
  /** Anzahl der Redebeiträge (4–24). Default: 8. */
  turns?: number;
  /** Körpersprache-Aktionen zwischen den Beiträgen einfügen. Default: true. */
  includeActions?: boolean;
}

/** Ein einzelner Redebeitrag. */
export interface DialogueTurn {
  /** Sprecher-Name. */
  speaker: string;
  /** Gesprochener Text. */
  text: string;
  /** Optionale Regieanweisung/Körpersprache. */
  action?: string;
  /** Erkannte verdeckte Absicht. */
  subtext?: string;
  /** 1-basierte Beitragsnummer. */
  index: number;
}

/** Ergebnis der Dialog-Erzeugung. */
export interface GeneratedDialogue {
  /** Alle Beiträge in Reihenfolge. */
  turns: DialogueTurn[];
  /** Formatierter Drehbuch-Text. */
  script: string;
  /** Beteiligte Figuren. */
  characters: string[];
  /** Anzahl der Beiträge. */
  turnCount: number;
  /** Anzahl eingebauter Körpersprache-Aktionen. */
  actionCount: number;
}

/** Ergebnis der Subtext-Erkennung. */
export interface SubtextFinding {
  /** Der untersuchte Redebeitrag. */
  text: string;
  /** Erkannte verdeckte Absicht. */
  intent: string;
  /** Auslösende Signalwörter. */
  signals: string[];
}

/** Ergebnis der Polyphonie-Analyse. */
export interface PolyphonyAnalysis {
  /** Sprechanteil je Figur (0–1), absteigend sortiert. */
  shares: { speaker: string; share: number; turns: number }[];
  /** Anzahl beteiligter Figuren. */
  characterCount: number;
  /** Durchschnittliche Beitragslänge in Wörtern. */
  avgTurnLength: number;
  /** Rhythmus-Index 0–1 (hoch = gleichmäßiger Schlagabtausch). */
  rhythmIndex: number;
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
// Sprachbausteine je Sprechmuster
// ---------------------------------------------------------------------------

/** Umgangssprachliche Einstiege (hoher Slang). */
const SLANG_OPENERS: readonly string[] = [
  'Hör mal, Kumpel —',
  'Also echt jetzt,',
  'Mann,',
  'Ey,',
  'Weißte was?',
  'Ganz ehrlich,',
];

/** Förmliche Einstiege (hohe Förmlichkeit). */
const FORMAL_OPENERS: readonly string[] = [
  'Gestatten Sie mir die Bemerkung,',
  'Wenn ich so frei sein darf:',
  'Ich erlaube mir den Hinweis,',
  'Mit Verlaub,',
  'Ich darf daran erinnern:',
  'Erlauben Sie,',
];

/** Neutrale Einstiege. */
const NEUTRAL_OPENERS: readonly string[] = [
  'Sehen Sie,',
  'Also,',
  'Nun,',
  'Hören Sie,',
  'Ich sage es so:',
  'Gut.',
];

/** Kurze, harte Erwiderungen (hohes Tempo). */
const FAST_REPLIES: readonly string[] = [
  'Nein.',
  'Falsch.',
  'Und dann?',
  'Weiter.',
  'Sicher?',
  'So?',
  'Reden Sie.',
];

/** Ausweichende Antworten (Bluff/Lenkung). */
const DEFLECTIONS: readonly string[] = [
  'Das ist eine merkwürdige Frage.',
  'Warum sollte ich das wissen?',
  'Sie sollten woanders suchen.',
  'Vielleicht fragen Sie den Wirt.',
  'Das haben schon andere versucht.',
  'Ich erinnere mich an nichts.',
];

/** Druckmachende Erwiderungen (Ermittler). */
const PRESSURE_REPLIES: readonly string[] = [
  'Ihre Geschichte hat ein Loch.',
  'Sie lügen, und ich höre es.',
  'Noch einmal, und diesmal ehrlich.',
  'Jemand hat Sie gesehen.',
  'Wir kennen die Wahrheit bereits.',
  'Sie machen es nur schlimmer.',
];

/** Körpersprache-Aktionen. */
const BODY_ACTIONS: readonly string[] = [
  'Er lehnte sich über den Tisch',
  'Sie wich keinen Zentimeter zurück',
  'Ein Finger tippte gegen das Glas',
  'Der Blick blieb an der Tür hängen',
  'Die Schultern spannten sich an',
  'Ein Lächeln, das nichts bedeutete',
  'Die Hand schloss sich um den Becher',
  'Der Stuhl kratzte über den Boden',
  'Ein Blick zur Seite, kurz nur',
  'Die Arme verschränkten sich',
];

/** Signalwörter für verdeckte Absichten. */
const SUBTEXT_SIGNALS: readonly { intent: string; signals: readonly string[] }[] = [
  { intent: 'Ausweichen', signals: ['vielleicht', 'merkwürdig', 'warum sollte', 'weiß nicht'] },
  { intent: 'Bluffen', signals: ['sicher', 'natürlich', 'selbstverständlich', 'garantiert'] },
  { intent: 'Drohen', signals: ['besser', 'sonst', 'letzte', 'warnung'] },
  { intent: 'Flirten', signals: ['interessant', 'hübsch', 'gefällt', 'bezaubernd'] },
  { intent: 'Beschwichtigen', signals: ['beruhigen', 'kein grund', 'ganz ruhig', 'entspannt'] },
  { intent: 'Lügen', signals: ['niemals', 'unmöglich', 'ausgeschlossen', 'bestimmt nicht'] },
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Figuren defensiv normalisieren (Namen erforderlich, max. 4). */
function normalizeCharacters(characters: unknown): DialogueCharacter[] {
  if (!Array.isArray(characters)) return [];
  return characters
    .filter((c): c is DialogueCharacter => !!c && typeof c === 'object' && typeof (c as DialogueCharacter).name === 'string')
    .filter((c) => c.name.trim().length > 0)
    .slice(0, 4)
    .map((c) => ({
      name: c.name.trim(),
      role: typeof c.role === 'string' ? c.role : undefined,
      pattern: c.pattern && typeof c.pattern === 'object' ? { ...c.pattern } : undefined,
      intent: typeof c.intent === 'string' ? c.intent : undefined,
    }));
}

/** Muster-Wert defensiv auf 0–1 begrenzen. */
function patternValue(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/** Beitragszahl auf sinnvollen Bereich begrenzen. */
function normalizeTurns(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 8;
  return Math.min(24, Math.max(4, Math.round(value)));
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Erzeugt den gesprochenen Text für eine Figur in einem Kontext. */
function buildLine(
  character: DialogueCharacter,
  isOpening: boolean,
  conflict: string,
  rand: () => number,
): string {
  const pattern = character.pattern ?? {};
  const slang = patternValue(pattern.slang, 0.2);
  const formality = patternValue(pattern.formality, 0.3);
  const tempo = patternValue(pattern.tempo, 0.5);

  // Hohes Tempo → kurze, harte Erwiderung (außer beim Eröffnungsbeitrag).
  if (!isOpening && tempo > 0.7 && rand() < 0.6) {
    return pick(FAST_REPLIES, rand);
  }

  // Einstieg nach dominantem Muster wählen.
  let opener: string;
  if (formality >= slang && formality > 0.5) opener = pick(FORMAL_OPENERS, rand);
  else if (slang > formality && slang > 0.5) opener = pick(SLANG_OPENERS, rand);
  else opener = pick(NEUTRAL_OPENERS, rand);

  // Inhaltlichen Kern aus Absicht oder Konflikt ableiten.
  const core =
    character.intent && character.intent.trim().length > 0
      ? character.intent.trim()
      : conflict.trim().length > 0
        ? conflict.trim()
        : 'die Sache klären';

  // Bluff/Deflection bei verdeckter Absicht.
  if (!isOpening && character.intent && rand() < 0.35) {
    return `${opener} ${pick(DEFLECTIONS, rand)}`;
  }

  // Ermittler-Druck bei förmlichem, schnellem Muster.
  if (!isOpening && formality < 0.4 && tempo < 0.4 && rand() < 0.4) {
    return `${opener} ${pick(PRESSURE_REPLIES, rand)}`;
  }

  return `${opener} ${core}.`;
}

// ---------------------------------------------------------------------------
// 1) Dialog-Erzeugung
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen polyphonen Schlagabtausch.
 *
 * Die Figuren wechseln sich reihum ab; jede Zeile folgt ihrem Sprechmuster.
 * Körpersprache-Aktionen werden deterministisch eingestreut, Subtext aus den
 * Signalwörtern der Zeile abgeleitet.
 *
 * Defensiv: weniger als 2 gültige Figuren → leerer Dialog.
 */
export function generateDialogue(
  characters: unknown,
  options?: DialogueOptions,
): GeneratedDialogue {
  const cast = normalizeCharacters(characters);
  if (cast.length < 2) {
    return { turns: [], script: '', characters: [], turnCount: 0, actionCount: 0 };
  }

  const turnTarget = normalizeTurns(options?.turns);
  const conflict = typeof options?.conflict === 'string' ? options.conflict.trim() : '';
  const includeActions = options?.includeActions !== false;

  const rand = createSeededRandom(
    hashString(`${cast.map((c) => c.name).join('|')}#${conflict}#${turnTarget}`),
  );

  const turns: DialogueTurn[] = [];
  let actionCount = 0;

  for (let i = 0; i < turnTarget; i++) {
    const character = cast[i % cast.length];
    const isOpening = i < cast.length;
    const text = buildLine(character, isOpening, conflict, rand);

    const turn: DialogueTurn = {
      speaker: character.name,
      text,
      index: i + 1,
    };

    // Körpersprache zwischen den Beiträgen (nicht nach jedem).
    if (includeActions && rand() < 0.6) {
      turn.action = pick(BODY_ACTIONS, rand);
      actionCount++;
    }

    // Subtext aus Signalwörtern ableiten (nur wenn keine offene Absicht).
    const detected = detectSubtextIn(text);
    if (detected) turn.subtext = detected;

    turns.push(turn);
  }

  return {
    turns,
    script: formatDialogueScript(turns),
    characters: cast.map((c) => c.name),
    turnCount: turns.length,
    actionCount,
  };
}

/** Formatiert Beiträge als Drehbuch-Text. */
function formatDialogueScript(turns: DialogueTurn[]): string {
  if (!Array.isArray(turns) || turns.length === 0) return '';
  return turns
    .map((t) => {
      const lines = [`${t.speaker.toUpperCase()}: ${t.text}`];
      if (t.action) lines.push(`(${t.action}.)`);
      return lines.join('\n');
    })
    .join('\n\n');
}

/** Subtext in einer einzelnen Zeile erkennen (intern, ohne Finding-Objekt). */
function detectSubtextIn(text: string): string | undefined {
  if (typeof text !== 'string' || !text) return undefined;
  const lower = text.toLowerCase();
  for (const entry of SUBTEXT_SIGNALS) {
    if (entry.signals.some((s) => lower.includes(s))) return entry.intent;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 2) Subtext-Erkennung
// ---------------------------------------------------------------------------

/**
 * Findet verdeckte Absichten in einem vorhandenen Dialog.
 *
 * Untersucht jede Zeile auf Signalwörter (Ausweichen, Bluffen, Drohen …).
 * Defensiv: leere/ungültige Eingaben liefern eine leere Liste.
 */
export function detectSubtext(turns: unknown): SubtextFinding[] {
  if (!Array.isArray(turns)) return [];
  const findings: SubtextFinding[] = [];

  for (const turn of turns) {
    const text =
      turn && typeof turn === 'object' && typeof (turn as DialogueTurn).text === 'string'
        ? (turn as DialogueTurn).text
        : typeof turn === 'string'
          ? turn
          : '';
    if (!text) continue;

    const lower = text.toLowerCase();
    for (const entry of SUBTEXT_SIGNALS) {
      const signals = entry.signals.filter((s) => lower.includes(s));
      if (signals.length > 0) {
        findings.push({ text, intent: entry.intent, signals });
        break;
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// 3) Polyphonie-Analyse
// ---------------------------------------------------------------------------

/**
 * Misst Sprechanteile und Rhythmus eines Dialogs.
 *
 * `rhythmIndex` ist 1, wenn alle Figuren gleich viele Beiträge haben, und
 * sinkt, je ungleicher die Verteilung ist. Defensiv: leerer Dialog → Nullen.
 */
export function analyzePolyphony(turns: unknown): PolyphonyAnalysis {
  const list = Array.isArray(turns)
    ? turns.filter((t): t is DialogueTurn => !!t && typeof t === 'object' && typeof (t as DialogueTurn).speaker === 'string')
    : [];

  if (list.length === 0) {
    return { shares: [], characterCount: 0, avgTurnLength: 0, rhythmIndex: 0 };
  }

  const counts = new Map<string, number>();
  let totalWords = 0;
  for (const t of list) {
    counts.set(t.speaker, (counts.get(t.speaker) ?? 0) + 1);
    totalWords += countWords(typeof t.text === 'string' ? t.text : '');
  }

  const total = list.length;
  const shares = [...counts.entries()]
    .map(([speaker, count]) => ({
      speaker,
      turns: count,
      share: Math.round((count / total) * 10000) / 10000,
    }))
    .sort((a, b) => b.turns - a.turns || a.speaker.localeCompare(b.speaker));

  const characterCount = shares.length;
  const avgTurnLength = Math.round((totalWords / total) * 100) / 100;

  // Gleichverteilung wäre 1/n je Figur; Abweichung davon senkt den Index.
  const ideal = 1 / characterCount;
  const deviation = shares.reduce((sum, s) => sum + Math.abs(s.share - ideal), 0);
  const maxDeviation = 2 * (1 - ideal);
  const rhythmIndex =
    maxDeviation > 0 ? Math.round((1 - deviation / maxDeviation) * 10000) / 10000 : 1;

  return {
    shares,
    characterCount,
    avgTurnLength,
    rhythmIndex: Math.min(1, Math.max(0, rhythmIndex)),
  };
}
