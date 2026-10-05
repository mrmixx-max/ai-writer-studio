// Multi-POV-Perspektiven-Wechsler (WP 61.1)
//
// Nimmt eine Szene aus Sicht von Figur A und schreibt sie aus Sicht von
// Figur B neu: andere Wahrnehmungsfilter, andere Sinnesfoki — Unsicherheit
// wird zur Arroganz, ein Detail wird zum Signal.
//
// Drei deterministische Werkzeuge:
//
//   1. retellFromPov     — Szene → Neuerzählung aus anderer Perspektive
//   2. buildPerceptionProfile — Wahrnehmungsprofil einer Figur
//   3. comparePerceptions — zwei Wahrnehmungsprofile gegenüberstellen
//
// Design-Regeln (analog proseExpander / internalMonologueGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Archetyp einer Figur (bestimmt den Wahrnehmungsfilter). */
export type ObserverArchetype =
  | 'warrior'
  | 'diplomat'
  | 'scholar'
  | 'thief'
  | 'healer';

/** Optionen für die Neuerzählung. */
export interface PovOptions {
  /** Figur, aus deren Sicht neu erzählt wird. */
  observer?: string;
  /** Archetyp des Beobachters (steuert den Filter). Default: 'warrior'. */
  archetype?: ObserverArchetype;
  /** Figur der Originalszene (wird beobachtet). */
  subject?: string;
  /** Originalszene aus Sicht der subject-Figur. */
  scene?: string;
}

/** Ein Wahrnehmungsprofil. */
export interface PerceptionProfile {
  /** Figur. */
  character: string;
  /** Archetyp. */
  archetype: ObserverArchetype;
  /** Menschenlesbarer Name. */
  archetypeLabel: string;
  /** Dinge, auf die diese Figur zuerst achtet. */
  focus: string[];
  /** Sinneskanäle in Prioritätsreihenfolge. */
  sensePriority: string[];
  /** Typische Fehldeutung fremder Reaktionen. */
  misreading: string;
}

/** Ein Abschnitt der Neuerzählung. */
export interface RetoldSection {
  /** Art des Abschnitts. */
  kind: 'observation' | 'misreading' | 'inner';
  /** Der Text. */
  text: string;
}

/** Ergebnis der POV-Neuerzählung. */
export interface RetoldScene {
  /** Abschnitte der Neuerzählung. */
  sections: RetoldSection[];
  /** Vollständiger Text. */
  text: string;
  /** Verwendetes Wahrnehmungsprofil. */
  profile: PerceptionProfile;
  /** Wortzahl. */
  wordCount: number;
  /** Anzahl eingebauter Fehldeutungen. */
  misreadingCount: number;
}

/** Ergebnis des Wahrnehmungsvergleichs. */
export interface PerceptionComparison {
  /** Profil A. */
  a: PerceptionProfile;
  /** Profil B. */
  b: PerceptionProfile;
  /** Gemeinsame Foki. */
  sharedFocus: string[];
  /** Wie stark sich die Wahrnehmung unterscheidet (0 = identisch). */
  divergence: number;
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
// Archetyp-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Archetyp-Namen. */
export const ARCHETYPE_LABELS: Record<ObserverArchetype, string> = {
  warrior: 'Krieger',
  diplomat: 'Diplomatin',
  scholar: 'Gelehrter',
  thief: 'Diebin',
  healer: 'Heilerin',
};

/** Worauf jede Figur zuerst achtet. */
const ARCHETYPE_FOCUS: Record<ObserverArchetype, readonly string[]> = {
  warrior: [
    'die Hände — wo sie sind und was sie halten',
    'die Haltung und das Gewicht auf den Füßen',
    'der Abstand zwischen den Körpern',
    'jede Bewegung, die zu schnell ist',
  ],
  diplomat: [
    'der Tonfall und was er verschweigt',
    'die Kleidung und was sie über den Stand verrät',
    'wer zuerst spricht und wer wartet',
    'die kleinen Höflichkeiten, die fehlen',
  ],
  scholar: [
    'die genaue Wortwahl und ihre Widersprüche',
    'die Reihenfolge, in der Dinge erzählt werden',
    'was nicht erwähnt wird',
    'die Zahlen und Namen, die fallen',
  ],
  thief: [
    'die Ausgänge und ihre Entfernung',
    'was die Leute bei sich tragen',
    'wo das Licht nicht hinfällt',
    'wer zu lange hinsieht',
  ],
  healer: [
    'die Atmung und ihr Rhythmus',
    'die Spannung im Nacken und in den Schultern',
    'was der Körper verrät, das der Mund verbirgt',
    'jede Stelle, an der jemand unbewusst Halt sucht',
  ],
};

/** Sinnes-Priorität je Archetyp. */
const ARCHETYPE_SENSES: Record<ObserverArchetype, readonly string[]> = {
  warrior: ['Berührung', 'Gehör', 'Sicht'],
  diplomat: ['Gehör', 'Sicht', 'Geruch'],
  scholar: ['Sicht', 'Gehör', 'Geschmack'],
  thief: ['Sicht', 'Gehör', 'Berührung'],
  healer: ['Berührung', 'Geruch', 'Gehör'],
};

/** Typische Fehldeutung je Archetyp. */
const ARCHETYPE_MISREADING: Record<ObserverArchetype, readonly string[]> = {
  warrior: [
    'Das Zögern sah aus wie Arroganz',
    'Die Unsicherheit wirkte wie eine Drohung',
    'Das Zittern las er als Wut',
  ],
  diplomat: [
    'Die Schüchternheit klang wie Berechnung',
    'Das Schweigen deutete sie als Ablehnung',
    'Die Direktheit nahm sie als Angriff',
  ],
  scholar: [
    'Die Verwirrung hielt er für Verstellung',
    'Die Wiederholung wertete er als Unsicherheit',
    'Die Auslassung las er als Lüge',
  ],
  thief: [
    'Der Blick zur Tür wirkte wie eine Falle',
    'Die Ruhe hielt sie für eine Waffe',
    'Das Zuwenden nahm sie als Ablenkung',
  ],
  healer: [
    'Die Anspannung sah sie als Schuld',
    'Die Müdigkeit deutete sie als Trauer',
    'Das Wegsehen las sie als Schmerz',
  ],
};

/** Beobachtungs-Bausteine je Archetyp. */
const ARCHETYPE_OBSERVATIONS: Record<ObserverArchetype, readonly string[]> = {
  warrior: [
    'Die Hand lag ruhig, aber zu weit vom Körper entfernt',
    'Das Gewicht verlagerte sich auf das hintere Bein',
    'Ein halber Schritt zurück, bevor der Satz endete',
  ],
  diplomat: [
    'Der Ton fiel am Ende des Satzes, wo er steigen sollte',
    'Die Frage kam höflich und ließ keine Antwort zu',
    'Ein Lächeln, das eine Sekunde zu spät kam',
  ],
  scholar: [
    'Dieselbe Geschichte, aber eine Zahl hatte sich geändert',
    'Der Name fiel zweimal, und beim zweiten Mal anders',
    'Eine Auslassung, genau dort, wo sie auffallen musste',
  ],
  thief: [
    'Die Tür im Rücken, drei Schritte entfernt',
    'Der Ring am Finger war zu groß für die Hand',
    'Der Blick ging zweimal dorthin, wo nichts war',
  ],
  healer: [
    'Die Atmung ging flach, obwohl der Satz ruhig klang',
    'Die Schultern standen hoch, als trüge jemand Last',
    'Die Hände suchten den Tisch, ohne es zu wollen',
  ],
};

/** Innere Kommentare je Archetyp. */
const ARCHETYPE_INNER: Record<ObserverArchetype, readonly string[]> = {
  warrior: ['Das würde Ärger geben', 'Noch war nichts entschieden', 'Zu viele Fragen, zu wenig Deckung'],
  diplomat: ['Das war eine Botschaft', 'Hier stimmt die Form nicht zum Inhalt', 'Jemand spielt ein Spiel'],
  scholar: ['Die Logik trägt nicht', 'Etwas fehlt in der Reihe', 'Das erklärt nicht alles'],
  thief: ['Zeit, sich einen Weg zu merken', 'Zu einfach, das ist nie einfach', 'Hier riecht es nach Falle'],
  healer: ['Der tut sich weh und sagt es nicht', 'Das ist mehr als Müdigkeit', 'Jemand sollte nach ihm sehen'],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Archetyp defensiv prüfen. */
function normalizeArchetype(value: unknown): ObserverArchetype {
  const all: ObserverArchetype[] = ['warrior', 'diplomat', 'scholar', 'thief', 'healer'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as ObserverArchetype)
    : 'warrior';
}

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
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

// ---------------------------------------------------------------------------
// 1) Wahrnehmungsprofil
// ---------------------------------------------------------------------------

/**
 * Erzeugt das Wahrnehmungsprofil einer Figur.
 *
 * Das Profil bestimmt, worauf die Figur achtet, welche Sinne dominieren und
 * wie sie fremde Reaktionen typischerweise fehldeutet.
 *
 * Defensiv: ungültige Archetypen fallen auf `warrior` zurück.
 */
export function buildPerceptionProfile(
  character?: unknown,
  archetype?: unknown,
): PerceptionProfile {
  const name = normalizeText(character, 'Die Figur');
  const a = normalizeArchetype(archetype);

  return {
    character: name,
    archetype: a,
    archetypeLabel: ARCHETYPE_LABELS[a],
    focus: [...ARCHETYPE_FOCUS[a]],
    sensePriority: [...ARCHETYPE_SENSES[a]],
    misreading: ARCHETYPE_MISREADING[a][0],
  };
}

// ---------------------------------------------------------------------------
// 2) POV-Neuerzählung
// ---------------------------------------------------------------------------

/**
 * Erzählt eine Szene aus der Perspektive einer anderen Figur neu.
 *
 * Drei Abschnitte: die Beobachtung (mit dem Filter des Archetyps), die
 * Fehldeutung (Unsicherheit wird zur Arroganz) und der innere Kommentar.
 * Der Originaltext der Szene fließt als Bezugspunkt ein.
 *
 * Defensiv: ohne Szene entsteht dennoch eine vollständige Neuerzählung.
 */
export function retellFromPov(options?: PovOptions | null): RetoldScene {
  const observer = normalizeText(options?.observer, 'Der Beobachter');
  const subject = normalizeText(options?.subject, 'die andere Figur');
  const scene = typeof options?.scene === 'string' ? options.scene.trim() : '';
  const a = normalizeArchetype(options?.archetype);

  const rand = createSeededRandom(hashString(`${observer}#${subject}#${a}#${scene}`));

  const profile = buildPerceptionProfile(observer, a);
  const sections: RetoldSection[] = [];

  // Beobachtung: der Wahrnehmungsfilter des Archetyps.
  const observationParts: string[] = [];
  observationParts.push(
    ensurePeriod(`${observer} sah ${subject} und sah zuerst ${pick(ARCHETYPE_FOCUS[a], rand)}`),
  );
  observationParts.push(ensurePeriod(pick(ARCHETYPE_OBSERVATIONS[a], rand)));
  if (scene) {
    observationParts.push(ensurePeriod(`Die Szene war dieselbe, aber nicht dieselbe`));
  }
  sections.push({ kind: 'observation', text: observationParts.join(' ') });

  // Fehldeutung: die Reaktion wird falsch gelesen.
  const misreading = pick(ARCHETYPE_MISREADING[a], rand);
  sections.push({ kind: 'misreading', text: ensurePeriod(misreading) });

  // Innerer Kommentar.
  sections.push({ kind: 'inner', text: ensurePeriod(pick(ARCHETYPE_INNER[a], rand)) });

  const text = sections.map((s) => s.text).join('\n\n');

  return {
    sections,
    text,
    profile,
    wordCount: countWords(text),
    misreadingCount: sections.filter((s) => s.kind === 'misreading').length,
  };
}

// ---------------------------------------------------------------------------
// 3) Wahrnehmungsvergleich
// ---------------------------------------------------------------------------

/**
 * Vergleicht zwei Wahrnehmungsprofile.
 *
 * `divergence` ist 0 bei identischen Profilen und steigt mit dem Unterschied
 * der Fokus-Listen und Sinnes-Prioritäten.
 *
 * Defensiv: ungültige Profile werden aus Namen gebaut.
 */
export function comparePerceptions(
  a?: unknown,
  b?: unknown,
): PerceptionComparison {
  const profileA =
    a && typeof a === 'object' && Array.isArray((a as PerceptionProfile).focus)
      ? (a as PerceptionProfile)
      : buildPerceptionProfile(typeof a === 'string' ? a : 'A', 'warrior');

  const profileB =
    b && typeof b === 'object' && Array.isArray((b as PerceptionProfile).focus)
      ? (b as PerceptionProfile)
      : buildPerceptionProfile(typeof b === 'string' ? b : 'B', 'diplomat');

  const sharedFocus = profileA.focus.filter((f) => profileB.focus.includes(f));

  // Divergenz: unterschiedliche Foki + unterschiedliche Sinne.
  const focusDivergence =
    (profileA.focus.length + profileB.focus.length - 2 * sharedFocus.length) /
    Math.max(1, profileA.focus.length + profileB.focus.length);

  const sharedSenses = profileA.sensePriority.filter((s) =>
    profileB.sensePriority.includes(s),
  ).length;
  const senseDivergence =
    1 - sharedSenses / Math.max(1, Math.max(profileA.sensePriority.length, profileB.sensePriority.length));

  const divergence =
    Math.round(((focusDivergence + senseDivergence) / 2) * 10000) / 10000;

  return {
    a: profileA,
    b: profileB,
    sharedFocus,
    divergence: Math.min(1, Math.max(0, divergence)),
  };
}
