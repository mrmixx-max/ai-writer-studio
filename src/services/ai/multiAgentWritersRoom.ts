// Multi-Agent Writer's Room (WP 62.1)
//
// Vier autonome KI-Personas debattieren ein Szenen-Problem und liefern einen
// abgestimmten Szenen-Vorschlag — wie in einem echten Writer's Room.
//
// Drei deterministische Werkzeuge:
//
//   1. runWritersRoom      — Problem → Debattenprotokoll + Konsens-Synthese
//   2. getPersonaProfile   — Profil eines der vier Personas
//   3. analyzeConsensus    — Übereinstimmung der Agenten bewerten
//
// Design-Regeln (analog editorialCouncil / chapterSceneSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Die vier Writer's-Room-Personas. */
export type PersonaId = 'showrunner' | 'punch-up' | 'lore-keeper' | 'empathy-advocate';

/** Ein Debattenbeitrag. */
export interface RoomStatement {
  /** Persona. */
  persona: PersonaId;
  /** Menschenlesbarer Name. */
  personaLabel: string;
  /** Die Aussage. */
  statement: string;
  /** Anliegen der Persona. */
  concern: 'pacing' | 'dialogue' | 'consistency' | 'emotion';
  /** Zustimmung zu den übrigen (0–1). */
  agreement: number;
}

/** Ergebnis einer Writer's-Room-Sitzung. */
export interface WritersRoomSession {
  /** Das diskutierte Problem. */
  problem: string;
  /** Das Protokoll in Reihenfolge. */
  protocol: RoomStatement[];
  /** Die Konsens-Synthese (abgestimmter Szenen-Vorschlag). */
  consensus: string;
  /** Anzahl der Beiträge. */
  statementCount: number;
  /** Durchschnittliche Zustimmung 0–1. */
  consensusLevel: number;
  /** Wortzahl der Synthese. */
  consensusWordCount: number;
}

/** Profil eines Personas. */
export interface PersonaProfile {
  /** ID. */
  id: PersonaId;
  /** Name. */
  label: string;
  /** Rolle in einem Satz. */
  role: string;
  /** Worauf das Persona achtet. */
  focus: string[];
  /** Typischer Einwand. */
  typicalObjection: string;
}

/** Ergebnis der Konsens-Analyse. */
export interface ConsensusAnalysis {
  /** Durchschnittliche Zustimmung. */
  level: number;
  /** Personas mit Einwänden. */
  dissenters: string[];
  /** true, wenn ein tragfähiger Konsens besteht. */
  reached: boolean;
  /** Empfehlung für den Autor. */
  recommendation: string;
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
// Persona-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Persona-Namen. */
export const PERSONA_LABELS: Record<PersonaId, string> = {
  showrunner: 'Der Showrunner',
  'punch-up': 'Der Dialog-Punch-Up-Spezialist',
  'lore-keeper': 'Der Lore- & Realismus-Hüter',
  'empathy-advocate': 'Der Empathie-Advokat',
};

/** Anliegen je Persona. */
const PERSONA_CONCERN: Record<PersonaId, RoomStatement['concern']> = {
  showrunner: 'pacing',
  'punch-up': 'dialogue',
  'lore-keeper': 'consistency',
  'empathy-advocate': 'emotion',
};

/** Rollenbeschreibung je Persona. */
const PERSONA_ROLES: Record<PersonaId, string> = {
  showrunner: 'Überwacht Pacing, Hauptkonflikt und den thematischen roten Faden.',
  'punch-up': 'Verwandelt normale Sätze in messerscharfen Witz, Drohungen und Subtext.',
  'lore-keeper': 'Schlägt Alarm bei physikalischen oder in-universe Unstimmigkeiten.',
  'empathy-advocate': 'Schärft emotionale Berührungspunkte und Katharsis für den Leser.',
};

/** Foki je Persona. */
const PERSONA_FOCUS: Record<PersonaId, readonly string[]> = {
  showrunner: [
    'Steigert diese Szene den Hauptkonflikt?',
    'Trägt sie den thematischen roten Faden?',
    'Ist das Pacing im Kapitelbogen stimmig?',
  ],
  'punch-up': [
    'Sagt die Figur das Beste, was sie sagen könnte?',
    'Gibt es Subtext unter der Oberfläche?',
    'Ist der Schlagabtausch rhythmisch?',
  ],
  'lore-keeper': [
    'Widerspricht das der etablierten Weltregel?',
    'Ist die Physik konsistent?',
    'Stimmen Zeitlinie und Figurenwissen?',
  ],
  'empathy-advocate': [
    'Fühlt der Leser hier etwas?',
    'Ist die Verwundbarkeit sichtbar?',
    'Kommt die Katharsis an der richtigen Stelle?',
  ],
};

/** Typischer Einwand je Persona. */
const PERSONA_OBJECTIONS: Record<PersonaId, readonly string[]> = {
  showrunner: [
    'Das verlangsamt den Bogen, ohne Spannung zu erzeugen',
    'Der Konflikt wird zu früh aufgelöst',
    'Diese Szene wiederholt, was Kapitel 3 schon gesagt hat',
  ],
  'punch-up': [
    'Die Figur erklärt, statt zu handeln',
    'Hier fehlt der doppelte Boden',
    'Der Schlagabtausch ist zu höflich',
  ],
  'lore-keeper': [
    'Das widerspricht der Regel aus Kapitel 7',
    'Diese Entfernung ist in einer Nacht nicht zu schaffen',
    'Die Figur weiß hier mehr, als sie wissen dürfte',
  ],
  'empathy-advocate': [
    'Der Leser hat keinen Grund, hier mitzufühlen',
    'Die Figur bleibt zu lange kontrolliert',
    'Die Katharsis kommt ohne Vorbereitung',
  ],
};

/** Zustimmungs-Bausteine (wie die Personas die Idee aufnehmen). */
const AGREEMENT_OPENERS: readonly string[] = [
  'Das trägt',
  'Damit kann ich arbeiten',
  'Das ist der richtige Weg',
  'Einverstanden, mit einer Bedingung',
  'Ja, wenn wir es schärfen',
];

/** Synthese-Bausteine (Konsens-Szenenvorschlag). */
const CONSENSUS_TEMPLATES: readonly string[] = [
  'Die Szene beginnt dort, wo der Konflikt schon brennt — kein Anlauf, kein Vorgeplänkel',
  'Die Figur handelt, bevor sie erklärt, und der Subtext trägt die Bedeutung',
  'Der Wendepunkt kommt früher und trifft härter, weil er vorbereitet war',
  'Die Emotion liegt in der Handlung, nicht in der Benennung',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Problem defensiv normalisieren. */
function normalizeProblem(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Satzende sicherstellen. */
function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?»"]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Rundet auf 4 Nachkommastellen. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// 1) Writer's Room
// ---------------------------------------------------------------------------

/**
 * Führt eine Writer's-Room-Sitzung durch.
 *
 * Die vier Personas äußern sich reihum zum Problem, jeweils mit ihrem eigenen
 * Anliegen und einem typischen Einwand. Anschließend wird eine Konsens-
 * Synthese formuliert — der abgestimmte Szenen-Vorschlag.
 *
 * Defensiv: ohne Problem entsteht dennoch eine vollständige Sitzung.
 */
export function runWritersRoom(problem?: unknown): WritersRoomSession {
  const text = normalizeProblem(problem);
  const rand = createSeededRandom(hashString(text || 'leeres-problem'));

  const personas: PersonaId[] = ['showrunner', 'punch-up', 'lore-keeper', 'empathy-advocate'];
  const protocol: RoomStatement[] = [];

  for (const persona of personas) {
    const objection = pick(PERSONA_OBJECTIONS[persona], rand);
    const opener = pick(AGREEMENT_OPENERS, rand);
    // Zustimmung: Grundwert 0.7, gestreut um ±0.25.
    const agreement = round4(Math.max(0.2, Math.min(1, 0.7 + (rand() - 0.5) * 0.5)));

    protocol.push({
      persona,
      personaLabel: PERSONA_LABELS[persona],
      statement: `${opener}. ${ensurePeriod(objection)}`,
      concern: PERSONA_CONCERN[persona],
      agreement,
    });
  }

  // Konsens-Synthese: die Kernaussage plus die wichtigsten Anliegen.
  const core = pick(CONSENSUS_TEMPLATES, rand);
  const consensusParts = [ensurePeriod(core)];

  if (text) {
    consensusParts.push(
      ensurePeriod(
        `Für „${text}" heißt das: der Konflikt wird geschärft, die Welt bleibt konsistent, und die Emotion liegt in der Handlung`,
      ),
    );
  } else {
    consensusParts.push(
      ensurePeriod(
        'Der Konflikt wird geschärft, die Welt bleibt konsistent, und die Emotion liegt in der Handlung',
      ),
    );
  }

  const consensus = consensusParts.join(' ');
  const consensusLevel = round4(
    protocol.reduce((s, p) => s + p.agreement, 0) / protocol.length,
  );

  return {
    problem: text,
    protocol,
    consensus,
    statementCount: protocol.length,
    consensusLevel,
    consensusWordCount: countWords(consensus),
  };
}

// ---------------------------------------------------------------------------
// 2) Persona-Profil
// ---------------------------------------------------------------------------

/**
 * Liefert das Profil eines Personas.
 *
 * Defensiv: unbekannte IDs fallen auf den Showrunner zurück.
 */
export function getPersonaProfile(id?: unknown): PersonaProfile {
  const all: PersonaId[] = ['showrunner', 'punch-up', 'lore-keeper', 'empathy-advocate'];
  const persona: PersonaId =
    typeof id === 'string' && (all as string[]).includes(id) ? (id as PersonaId) : 'showrunner';

  return {
    id: persona,
    label: PERSONA_LABELS[persona],
    role: PERSONA_ROLES[persona],
    focus: [...PERSONA_FOCUS[persona]],
    typicalObjection: PERSONA_OBJECTIONS[persona][0],
  };
}

/** Liefert alle vier Persona-Profile. */
export function getAllPersonas(): PersonaProfile[] {
  return (['showrunner', 'punch-up', 'lore-keeper', 'empathy-advocate'] as PersonaId[]).map((id) =>
    getPersonaProfile(id),
  );
}

// ---------------------------------------------------------------------------
// 3) Konsens-Analyse
// ---------------------------------------------------------------------------

/**
 * Bewertet die Übereinstimmung einer Sitzung.
 *
 * `reached` ist true, wenn die durchschnittliche Zustimmung mindestens 0.6
 * beträgt und höchstens eine Persona deutlich abweicht.
 *
 * Defensiv: ungültige Sitzungen liefern Nullwerte.
 */
export function analyzeConsensus(
  session: WritersRoomSession | null | undefined,
): ConsensusAnalysis {
  if (!session || !Array.isArray(session.protocol) || session.protocol.length === 0) {
    return {
      level: 0,
      dissenters: [],
      reached: false,
      recommendation: 'Keine Sitzung übergeben.',
    };
  }

  const level = round4(
    session.protocol.reduce((s, p) => s + p.agreement, 0) / session.protocol.length,
  );

  const dissenters = session.protocol
    .filter((p) => p.agreement < 0.5)
    .map((p) => p.personaLabel);

  const reached = level >= 0.6 && dissenters.length <= 1;

  let recommendation: string;
  if (reached && level >= 0.8) {
    recommendation = 'Starker Konsens — die Szene kann so geschrieben werden.';
  } else if (reached) {
    recommendation = 'Konsens erreicht — die Einwände beim Schreiben berücksichtigen.';
  } else if (dissenters.length > 1) {
    recommendation = 'Zu viele Einwände — das Problem ist noch nicht klar genug gefasst.';
  } else {
    recommendation = 'Grundzustimmung zu niedrig — Szene grundsätzlich überdenken.';
  }

  return { level, dissenters, reached, recommendation };
}

// ---------------------------------------------------------------------------
// 4) Protokoll-Formatierung
// ---------------------------------------------------------------------------

/** Formatiert das Debattenprotokoll als lesbaren Text. */
export function formatRoomProtocol(session: WritersRoomSession | null | undefined): string {
  if (!session || !Array.isArray(session.protocol) || session.protocol.length === 0) return '';

  const lines = session.protocol.map(
    (p) => `${p.personaLabel} [${p.concern}]: ${p.statement}`,
  );

  return [...lines, '', `KONSENS: ${session.consensus}`].join('\n');
}
