// Ritual-Armierungs- & Rüstungs-Orchestrator (WP 123.1, Meilenstein 59.0 / v7.1.0)
//
// Für epische Fiktion: die Waffenanlage („arming") einer Figur wird als
// zeremonieller, Schritt-für-Schritt-Ablauf inszeniert. Jeder Ausrüstungs-
// Schritt wird mit psychologischer Spannung verwoben — das Anziehen des
// ledernen Riemens korrespondiert mit steigendem Puls und inneren Ängsten.
//
// Drei deterministische Werkzeuge:
//
//   1. ARMING_STEPS          — der kanonische 6-Schritt-Ablauf
//   2. generateTensionWeave  — Spannung, Cues & innerer Monolog je Schritt
//   3. generateArmingScene   — vollständige Armierungs-Szene in einem Zug
//
// Design-Regeln (analog proseExpander / combatChoreographyGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed (unsigned 32-bit). */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wählt deterministisch ein Element; wirft bei leerem Array. */
function pick<T>(items: readonly T[], rng: () => number): T {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('pick: leeres Array — kein Element zum Auswählen');
  }
  return items[Math.floor(rng() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Kennung eines Armierungs-Schrittes. */
export type ArmingStepId =
  | 'underwear'
  | 'legwear'
  | 'cuirass'
  | 'armwear'
  | 'helm'
  | 'weapon';

/** Ein einzelner Armierungs-Schritt. */
export interface ArmingStep {
  /** Stabile Kennung. */
  id: ArmingStepId;
  /** Anzeigename. */
  name: string;
  /** Beschreibung des Vorgangs. */
  description: string;
  /** Dauer in Sekunden. */
  duration: number;
  /** Schwierigkeit 0–10. */
  difficulty: number;
}

/** Psychischer Zustand der Figur während der Armierung. */
export interface CharacterState {
  /** Angst 0–10. */
  fear: number;
  /** Entschlossenheit 0–10. */
  determination: number;
  /** Erfahrung 0–10. */
  experience: number;
}

/** Ergebnis der Spannungs-Verwebung eines Schrittes. */
export interface TensionWeave {
  /** Spannung 0–10. */
  tension: number;
  /** Psychologische Hinweis-Reize (Cues). */
  psychologicalCues: string[];
  /** Innerer Monolog der Figur. */
  innerMonologue: string;
}

/** Ergebnis einer vollständigen Armierungs-Szene. */
export interface ArmingScene {
  /** Ausformulierter Szenentext. */
  scene: string;
  /** Gesamtdauer in Sekunden. */
  totalDuration: number;
  /** Anzahl der Schritte. */
  stepCount: number;
  /** Durchschnittliche Spannung 0–10. */
  averageTension: number;
}

// ---------------------------------------------------------------------------
// 1) Der kanonische Schritt-Ablauf
// ---------------------------------------------------------------------------

/**
 * Der zeremonielle 6-Schritt-Ablauf der Waffenanlage.
 *
 * Reihenfolge nach traditioneller Rüst-Logik: erst das Unterkleid, dann die
 * Beine, dann der Torso, dann Arme/Hände, dann Kopf, zuletzt die Waffe.
 * Jeder Schritt trägt Dauer (Sekunden) und Schwierigkeit (0–10).
 */
export const ARMING_STEPS: readonly ArmingStep[] = [
  {
    id: 'underwear',
    name: 'Unterkleid',
    description: 'Das leinene Unterkleid wird übergezogen, kühl auf der Haut, noch kein Gewicht.',
    duration: 45,
    difficulty: 1,
  },
  {
    id: 'legwear',
    name: 'Beinlinge / Beinschienen',
    description: 'Beinlinge werden geschnürt, dann die Beinschienen an Waden und Knien festgezurrt.',
    duration: 120,
    difficulty: 4,
  },
  {
    id: 'cuirass',
    name: 'Brustpanzer / Korsage',
    description: 'Der Brustpanzer wird angelegt und die Lederriemen Zug um Zug fester geschnürt.',
    duration: 180,
    difficulty: 7,
  },
  {
    id: 'armwear',
    name: 'Armzeug / Handschuhe',
    description: 'Armzeug und Handschuhe werden angelegt; jede Fingerspitze prüft den Sitz.',
    duration: 150,
    difficulty: 6,
  },
  {
    id: 'helm',
    name: 'Helm / Diadem',
    description: 'Der Helm sinkt über den Kopf, das Visier bleibt vorerst offen; oder das Diadem wird gesetzt.',
    duration: 60,
    difficulty: 3,
  },
  {
    id: 'weapon',
    name: 'Waffenübergabe',
    description: 'Die Waffe wird überreicht und mit beiden Händen geprüft — Gewicht, Griff, Balance.',
    duration: 90,
    difficulty: 5,
  },
] as const;

// ---------------------------------------------------------------------------
// Wortschatz für die Spannungs-Verwebung
// ---------------------------------------------------------------------------

/** Körperlich-sinnliche Cues. */
const PHYSICAL_CUES: readonly string[] = [
  'Der Puls schlägt bis in die Fingerspitzen',
  'Der Atem wird flacher, als der Riemen sich schließt',
  'Ein kalter Schauer läuft über den Nacken',
  'Die Hände zittern kaum merklich, kaum sichtbar',
  'Der Lederriemen knarrt, und die Haut darunter spannt',
  'Der Mund wird trocken, das Schlucken schwer',
  'Das Herz hämmert gegen die frisch angelegte Platte',
  'Ein feiner Film Schweiß liegt auf der Stirn',
];

/** Psychische Cues (Angst, Zweifel, Erinnerung). */
const PSYCHIC_CUES: readonly string[] = [
  'Ein Bild von zu Hause schiebt sich dazwischen, ungebeten',
  'Die Erinnerung an den letzten, der so gerüstet wurde',
  'Der Zweifel flüstert, ob die Hände diesmal ruhig bleiben',
  'Die Angst sitzt tiefer als jede Rüstung reicht',
  'Ein Versprechen klingt nach, das noch eingelöst werden muss',
  'Der Gedanke an das, was danach kommt, lässt nicht los',
  'Eine alte Wunde zieht, als hätte sie die Bewegung erkannt',
  'Die Stille des Raumes ist lauter als jede Schlacht',
];

/** Entschlossenheits-Cues (Gegenpol zur Angst). */
const RESOLVE_CUES: readonly string[] = [
  'Ein tiefer Atemzug setzt die Schultern gerade',
  'Der Blick wird hart, und das Zittern weicht',
  'Ein entschlossener Griff, kein Zögern mehr',
  'Der Rücken strafft sich, als trüge er die Platte kaum',
  'Ein stilles Nicken, für niemanden als sich selbst',
  'Die Kiefer pressen sich zusammen, und der Zweifel verstummt',
];

/** Innere Monologe für niedrige Spannung. */
const MONOLOGUE_CALM: readonly string[] = [
  'Es ist nur eine Rüstung. Ein Schritt nach dem anderen.',
  'Ich habe das schon getragen, tausendmal.',
  'Ruhig. Nur die Riemen. Weiter.',
];

/** Innere Monologe für mittlere Spannung. */
const MONOLOGUE_TENSE: readonly string[] = [
  'Jeder Riemen zieht sich ein Stück enger — wie lange noch?',
  'Wenn ich das falsch schnalle, bezahle ich es draußen.',
  'Nur nicht anhalten. Wer anhält, denkt zu viel.',
];

/** Innere Monologe für hohe Spannung. */
const MONOLOGUE_FEAR: readonly string[] = [
  'Wenn dieser Riemen reißt, ist es vorbei.',
  'Ich rieche das Leder und schmecke meine Angst.',
  'Bitte lass die Hände ruhig bleiben. Bitte.',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Begrenzt einen Wert auf [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** Runden auf zwei Nachkommastellen. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Findet einen Schritt anhand der Kennung. */
function findStep(stepId: string): ArmingStep | undefined {
  return ARMING_STEPS.find((s) => s.id === stepId);
}

/** Normalisiert einen Figuren-Zustand defensiv. */
function normalizeState(state: unknown): CharacterState {
  const raw = (state && typeof state === 'object' ? state : {}) as Partial<CharacterState>;
  return {
    fear: clamp(typeof raw.fear === 'number' ? raw.fear : 5, 0, 10),
    determination: clamp(typeof raw.determination === 'number' ? raw.determination : 5, 0, 10),
    experience: clamp(typeof raw.experience === 'number' ? raw.experience : 5, 0, 10),
  };
}

// ---------------------------------------------------------------------------
// 2) Psychologische Spannungs-Verwebung
// ---------------------------------------------------------------------------

/**
 * Verwebt einen Armierungs-Schritt mit psychologischer Spannung.
 *
 * Die Spannung wächst aus der Schwierigkeit des Schrittes, der Angst der Figur
 * und der Anspannung der physischen Handlung (das Anziehen des Riemens) — sie
 * wird durch Entschlossenheit und Erfahrung gedämpft. Der innere Monolog und
 * die Cues werden deterministisch aus dem Seed gewählt.
 *
 * Defensiv: unbekannte Schritt-Kennung → Spannung 0, leere Cues, leerer Monolog.
 */
export function generateTensionWeave(
  stepId: string,
  characterState: CharacterState,
  seed: number,
): TensionWeave {
  const step = findStep(typeof stepId === 'string' ? stepId : '');

  if (!step) {
    return { tension: 0, psychologicalCues: [], innerMonologue: '' };
  }

  const state = normalizeState(characterState);
  const rng = createSeededRandom(hashString(`${step.id}#${seed}#${state.fear}#${state.determination}#${state.experience}`));

  // Grundspannung aus Schwierigkeit + Angst, gedämpft durch Erfahrung.
  const difficultyPart = (step.difficulty / 10) * 6; // 0–6
  const fearPart = (state.fear / 10) * 5; // 0–5
  const experienceDamping = (state.experience / 10) * 3.5; // 0–3.5
  const resolveDamping = (state.determination / 10) * 2.5; // 0–2.5
  const jitter = rng() * 1.5; // deterministische Streuung

  const tension = clamp(
    round2(difficultyPart + fearPart - experienceDamping - resolveDamping + jitter + 1.5),
    0,
    10,
  );

  // Cues: immer ein physischer Reiz, plus psychisch/entschlossen je nach Lage.
  const cues: string[] = [pick(PHYSICAL_CUES, rng)];

  if (tension >= 6) {
    cues.push(pick(PSYCHIC_CUES, rng));
    if (rng() < 0.6) cues.push(pick(PSYCHIC_CUES, rng));
  } else if (tension >= 3) {
    cues.push(rng() < 0.5 ? pick(PSYCHIC_CUES, rng) : pick(RESOLVE_CUES, rng));
  } else {
    cues.push(pick(RESOLVE_CUES, rng));
  }

  // Innerer Monolog passend zur Spannungslage.
  const monologuePool =
    tension >= 6.5 ? MONOLOGUE_FEAR : tension >= 3.5 ? MONOLOGUE_TENSE : MONOLOGUE_CALM;
  const innerMonologue = pick(monologuePool, rng);

  return { tension, psychologicalCues: cues, innerMonologue };
}

// ---------------------------------------------------------------------------
// 3) Vollständige Armierungs-Szene (1-Klick-Injektion)
// ---------------------------------------------------------------------------

/** Standard-Figurenzustand für eine generierte Szene. */
function stateFromSeed(rng: () => number): CharacterState {
  return {
    fear: clamp(round2(3 + rng() * 6), 0, 10),
    determination: clamp(round2(4 + rng() * 6), 0, 10),
    experience: clamp(round2(2 + rng() * 7), 0, 10),
  };
}

/**
 * Erzeugt eine vollständige, mehrschrittige Armierungs-Szene.
 *
 * Alle sechs Schritte werden durchlaufen, je Schritt wird eine Spannungs-
 * Verwebung erzeugt und zu einem lesbaren Szenentext verbunden. Gesamtdauer
 * summiert die Schritt-Dauern, `averageTension` mittelt die Spannungswerte.
 *
 * Defensiv: `ARMING_STEPS` ist konstant, daher stets 6 Schritte.
 */
export function generateArmingScene(seed: number): ArmingScene {
  const baseSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : 0;
  const rng = createSeededRandom(hashString(`arming-scene#${baseSeed}`));
  const state = stateFromSeed(rng);

  const parts: string[] = [];
  let totalDuration = 0;
  let tensionSum = 0;
  let stepCount = 0;

  for (const step of ARMING_STEPS) {
    const weave = generateTensionWeave(step.id, state, baseSeed);
    totalDuration += step.duration;
    tensionSum += weave.tension;
    stepCount += 1;

    const cueText = weave.psychologicalCues.join('. ');
    const sentence =
      `${step.name}: ${step.description}` +
      (cueText ? ` ${cueText}.` : '') +
      (weave.innerMonologue ? ` *„${weave.innerMonologue}"*` : '');

    parts.push(sentence);
  }

  const scene = parts.join('\n\n');
  const averageTension = stepCount > 0 ? round2(tensionSum / stepCount) : 0;

  return { scene, totalDuration, stepCount, averageTension };
}

// ---------------------------------------------------------------------------
// Fabriken
// ---------------------------------------------------------------------------

/** Erzeugt einen Beispiel-Armierungs-Schritt (Kopie des ersten Schrittes). */
export function createSampleArmingStep(): ArmingStep {
  const first = ARMING_STEPS[0];
  return {
    id: first.id,
    name: first.name,
    description: first.description,
    duration: first.duration,
    difficulty: first.difficulty,
  };
}

/** Erzeugt eine Beispiel-Armierungs-Szene mit festem Seed. */
export function createSampleArmingScene(): ArmingScene {
  return generateArmingScene(hashString('sample-arming-scene'));
}
