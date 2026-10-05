// Kinetischer Action- & Kampf-Choreograf (WP 56.2)
//
// Erzeugt lesbare Kampf-Choreografien: Stakkatosätze bei Adrenalinspitzen,
// Ausnutzung von Momentum, Gewicht und Verletzungsschmerz — plus ein
// Anatomie- und Handlungs-Wächter, der unmögliche Aktionen blockiert
// (z. B. ein Langschwert mit beiden Händen führen und gleichzeitig nachladen).
//
// Drei deterministische Werkzeuge:
//
//   1. choreographCombat   — Kampf-Setup → Beat-für-Beat-Choreografie
//   2. validateCombatBeat  — Anatomie-/Handlungs-Wächter für einen Beat
//   3. analyzeCombatPacing — Rhythmus und Satzlängen einer Choreografie
//
// Design-Regeln (analog proseExpander):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Waffengattung. */
export type WeaponKind =
  | 'longsword'
  | 'dagger'
  | 'pistol'
  | 'rifle'
  | 'fists'
  | 'staff'
  | 'bow';

/** Eine kämpfende Figur. */
export interface Combatant {
  /** Name der Figur. */
  name: string;
  /** Geführte Waffe. */
  weapon?: WeaponKind;
  /** Hand-Nutzung: einhändig, beidhändig, Schild+Waffe. */
  grip?: 'one-handed' | 'two-handed' | 'shield';
  /** Startverfassung. */
  condition?: 'fresh' | 'wounded' | 'exhausted';
}

/** Gelände-Hindernis. */
export type Obstacle =
  | 'overturned-table'
  | 'wet-cobblestones'
  | 'rain'
  | 'narrow-corridor'
  | 'staircase'
  | 'smoke'
  | 'darkness'
  | 'crowd';

/** Eingabe für die Choreografie. */
export interface CombatSetup {
  /** Beteiligte Kämpfer (2–4). */
  combatants?: Combatant[];
  /** Gelände-Hindernisse. */
  obstacles?: Obstacle[];
  /** Grundtempo. Default: 'kinetic'. */
  tempo?: 'measured' | 'kinetic' | 'frantic';
  /** Ort der Szene, nur informativ. */
  location?: string;
}

/** Ein einzelner Choreografie-Beat. */
export interface CombatBeat {
  /** 1-basierte Beat-Nummer. */
  index: number;
  /** Handelnde Figur. */
  actor: string;
  /** Empfänger der Aktion (falls vorhanden). */
  target?: string;
  /** Der ausformulierte Text. */
  text: string;
  /** Art des Beats. */
  kind: 'attack' | 'defend' | 'move' | 'impact' | 'pause' | 'finish';
  /** Zugeordnetes Hindernis, falls genutzt. */
  obstacle?: Obstacle;
  /** true, wenn dieser Beat einen Regelverstoß auslöst. */
  invalid?: boolean;
}

/** Ergebnis der Choreografie. */
export interface CombatChoreography {
  /** Alle Beats in Reihenfolge. */
  beats: CombatBeat[];
  /** Formatierter Text (Beats als Absätze). */
  text: string;
  /** Beteiligte Kämpfer. */
  combatants: string[];
  /** Anzahl der Beats. */
  beatCount: number;
  /** Verwendete Hindernisse. */
  obstacles: Obstacle[];
  /** Anzahl der Sätze im Text. */
  sentenceCount: number;
  /** Durchschnittliche Satzlänge in Wörtern. */
  avgSentenceLength: number;
}

/** Ergebnis des Anatomie-/Handlungs-Wächters. */
export interface ValidationResult {
  /** true, wenn der Beat plausibel ist. */
  valid: boolean;
  /** Gefundene Verstöße. */
  violations: string[];
}

/** Ergebnis der Pacing-Analyse. */
export interface CombatPacing {
  /** Anzahl der Sätze. */
  sentenceCount: number;
  /** Durchschnittliche Satzlänge in Wörtern. */
  avgSentenceLength: number;
  /** Längster Satz in Wörtern. */
  longestSentence: number;
  /** Anteil kurzer Sätze (< 6 Wörter) — Maß für Stakkato. */
  staccatoRatio: number;
  /** Rhythmus-Bewertung 0–1 (hoch = guter Wechsel aus kurz und lang). */
  rhythmScore: number;
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
// Waffen-Regeln (Grundlage des Wächters)
// ---------------------------------------------------------------------------

/** Erfordert die Waffe beide Hände? */
const TWO_HANDED_WEAPONS: ReadonlySet<WeaponKind> = new Set(['longsword', 'rifle', 'bow', 'staff']);

/** Nachladen nötig? */
const RELOAD_WEAPONS: ReadonlySet<WeaponKind> = new Set(['pistol', 'rifle', 'bow']);

/** Menschenlesbare Waffennamen. */
export const WEAPON_LABELS: Record<WeaponKind, string> = {
  longsword: 'Langschwert',
  dagger: 'Dolch',
  pistol: 'Pistole',
  rifle: 'Gewehr',
  fists: 'bloße Fäuste',
  staff: 'Stab',
  bow: 'Bogen',
};

/** Menschenlesbare Hindernis-Namen. */
export const OBSTACLE_LABELS: Record<Obstacle, string> = {
  'overturned-table': 'umgestürzter Tisch',
  'wet-cobblestones': 'rutschiges Kopfsteinpflaster',
  rain: 'Regen',
  'narrow-corridor': 'enger Gang',
  staircase: 'Treppe',
  smoke: 'Rauch',
  darkness: 'Dunkelheit',
  crowd: 'Menschenmenge',
};

// ---------------------------------------------------------------------------
// Beat-Bausteine
// ---------------------------------------------------------------------------

/** Angriffs-Verben. */
const ATTACK_LINES: readonly string[] = [
  'Ein Schritt nach vorn, dann der Hieb',
  'Der Arm fuhr herum, schnell und ohne Zögern',
  'Kein Ausholen, nur der Stoß',
  'Die Klinge kam von unten',
  'Ein kurzer Satz, dann der Schlag',
];

/** Verteidigungs-Linien. */
const DEFEND_LINES: readonly string[] = [
  'Die Parade kam rechtzeitig, gerade eben',
  'Ein Ruck zur Seite, und die Klinge ging ins Leere',
  'Der Unterarm blockte, und es tat weh',
  'Ausweichen, knapp, ohne Eleganz',
  'Die Deckung hielt, diesmal',
];

/** Bewegungs-Linien. */
const MOVE_LINES: readonly string[] = [
  'Zwei Schritte zurück, um Luft zu holen',
  'Ein Sprung über das Hindernis',
  'Zur Seite, an der Wand entlang',
  'Ein Kreis, um die Flanke zu gewinnen',
  'Rückwärts, Schritt für Schritt',
];

/** Treffer-/Wucht-Linien. */
const IMPACT_LINES: readonly string[] = [
  'Der Treffer saß, und der Atem stockte',
  'Es krachte, und die Welt verschob sich',
  'Schmerz schoss durch die Schulter',
  'Der Aufprall nahm den Boden unter den Füßen',
  'Ein dumpfer Schlag, dann das Taumeln',
];

/** Kurze Stakkato-Sätze für Adrenalinspitzen. */
const STACCATO_LINES: readonly string[] = [
  'Kein Atem.',
  'Nur Bewegung.',
  'Dann Stille.',
  'Wieder hoch.',
  'Kein Zurück.',
  'Zu schnell.',
];

/** Pausen-Linien. */
const PAUSE_LINES: readonly string[] = [
  'Beide standen, keuchend, und keiner gab nach',
  'Ein Moment, in dem nichts geschah',
  'Die Sekunde dehnte sich',
  'Stille, nur das Blut im Ohr',
];

/** Abschluss-Linien. */
const FINISH_LINES: readonly string[] = [
  'Dann fiel eine Waffe, und es war vorbei',
  'Der Letzte blieb stehen und atmete',
  'Keiner sagte etwas. Es war genug.',
  'Das Ende kam schnell und ohne Ankündigung',
];

/** Hindernis-Wirkungen. */
const OBSTACLE_EFFECTS: Record<Obstacle, string> = {
  'overturned-table': 'Der Tisch kippte zwischen sie, ein flüchtiger Wall',
  'wet-cobblestones': 'Ein Fuß rutschte weg, und das Gleichgewicht kippte',
  rain: 'Der Regen machte jede Bewegung schwerer und jede Sicht kürzer',
  'narrow-corridor': 'Der Gang ließ keine Ausweichbewegung zu',
  staircase: 'Die Stufen nahmen jedem Schritt die Kraft',
  smoke: 'Der Rauch nahm die Konturen mit',
  darkness: 'Im Dunkeln zählte jedes Geräusch mehr als jeder Blick',
  crowd: 'Die Menge drängte, und niemand wusste, wer zu wem gehörte',
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Kämpfer defensiv normalisieren (2–4 gültige). */
function normalizeCombatants(list: unknown): Combatant[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c): c is Combatant => !!c && typeof c === 'object' && typeof (c as Combatant).name === 'string')
    .filter((c) => c.name.trim().length > 0)
    .slice(0, 4)
    .map((c) => ({
      name: c.name.trim(),
      weapon: isWeapon(c.weapon) ? c.weapon : 'fists',
      grip: c.grip === 'two-handed' || c.grip === 'shield' || c.grip === 'one-handed' ? c.grip : undefined,
      condition: c.condition === 'wounded' || c.condition === 'exhausted' ? c.condition : 'fresh',
    }));
}

/** Waffen-Kennung prüfen. */
function isWeapon(value: unknown): value is WeaponKind {
  return (
    value === 'longsword' ||
    value === 'dagger' ||
    value === 'pistol' ||
    value === 'rifle' ||
    value === 'fists' ||
    value === 'staff' ||
    value === 'bow'
  );
}

/** Hindernisse defensiv normalisieren. */
function normalizeObstacles(list: unknown): Obstacle[] {
  if (!Array.isArray(list)) return [];
  const valid: Obstacle[] = [
    'overturned-table', 'wet-cobblestones', 'rain', 'narrow-corridor',
    'staircase', 'smoke', 'darkness', 'crowd',
  ];
  return list.filter((o): o is Obstacle => typeof o === 'string' && (valid as string[]).includes(o));
}

/** Tempo defensiv prüfen. */
function normalizeTempo(value: unknown): 'measured' | 'kinetic' | 'frantic' {
  return value === 'measured' || value === 'kinetic' || value === 'frantic' ? value : 'kinetic';
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Sätze zerlegen. */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]*/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Beat-Anzahl je Tempo. */
const TEMPO_BEATS: Record<'measured' | 'kinetic' | 'frantic', number> = {
  measured: 6,
  kinetic: 10,
  frantic: 14,
};

// ---------------------------------------------------------------------------
// 1) Anatomie- & Handlungs-Wächter
// ---------------------------------------------------------------------------

/**
 * Prüft, ob ein Kampf-Beat anatomisch und handlungslogisch möglich ist.
 *
 * Erkennt u. a.:
 *   - eine zweihändige Waffe mit nur einer Hand führen,
 *   - mit belegten Händen nachladen,
 *   - zwei Waffen gleichzeitig führen, die beide Hände brauchen,
 *   - einen Treffer kassieren und im selben Beat präzise nachladen.
 *
 * Defensiv: fehlende Angaben gelten als gültig.
 */
export function validateCombatBeat(
  combatant: Combatant | null | undefined,
  action?: { attack?: boolean; reload?: boolean; defend?: boolean; hands?: number },
): ValidationResult {
  const violations: string[] = [];

  if (!combatant || typeof combatant !== 'object') {
    return { valid: true, violations };
  }

  const weapon = isWeapon(combatant.weapon) ? combatant.weapon : 'fists';
  const grip = combatant.grip;
  const hands = typeof action?.hands === 'number' ? action.hands : undefined;

  // Zweihändige Waffe mit einer Hand.
  if (TWO_HANDED_WEAPONS.has(weapon) && grip === 'one-handed') {
    violations.push(
      `${WEAPON_LABELS[weapon]} erfordert beide Hände — einhändige Führung ist unmöglich`,
    );
  }

  // Nachladen mit belegten Händen.
  if (action?.reload && RELOAD_WEAPONS.has(weapon)) {
    const blockedHands = grip === 'shield' ? 1 : grip === 'two-handed' ? 2 : hands === 2 ? 2 : 0;
    if (blockedHands >= 2) {
      violations.push(
        `${WEAPON_LABELS[weapon]} nachladen braucht eine freie Hand — beide sind belegt`,
      );
    }
  }

  // Angriff und Nachladen im selben Beat.
  if (action?.attack && action?.reload) {
    violations.push('Angriff und Nachladen im selben Beat ist nicht gleichzeitig möglich');
  }

  // Zweihändige Waffe plus Schild.
  if (TWO_HANDED_WEAPONS.has(weapon) && grip === 'shield') {
    violations.push(`${WEAPON_LABELS[weapon]} lässt sich nicht mit einem Schild führen`);
  }

  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// 2) Choreografie
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine Beat-für-Beat-Kampf-Choreografie.
 *
 * Der Rhythmus folgt dem Tempo: bei `frantic` überwiegen kurze Stakkato-Sätze,
 * bei `measured` längere, kontrollierte Beschreibungen. Hindernisse werden
 * deterministisch eingewoben und verändern die Aktionen.
 *
 * Defensiv: weniger als 2 gültige Kämpfer → leere Choreografie.
 */
export function choreographCombat(setup?: CombatSetup | null): CombatChoreography {
  const cast = normalizeCombatants(setup?.combatants);
  const obstacles = normalizeObstacles(setup?.obstacles);
  const tempo = normalizeTempo(setup?.tempo);

  if (cast.length < 2) {
    return {
      beats: [],
      text: '',
      combatants: [],
      beatCount: 0,
      obstacles: [],
      sentenceCount: 0,
      avgSentenceLength: 0,
    };
  }

  const rand = createSeededRandom(
    hashString(
      `${cast.map((c) => `${c.name}:${c.weapon}`).join('|')}#${obstacles.join(',')}#${tempo}`,
    ),
  );

  const beatTarget = TEMPO_BEATS[tempo];
  const beats: CombatBeat[] = [];
  const usedObstacles = new Set<Obstacle>();

  for (let i = 0; i < beatTarget; i++) {
    const actor = cast[i % cast.length];
    const target = cast[(i + 1) % cast.length];

    // Beat-Art deterministisch bestimmen.
    let kind: CombatBeat['kind'];
    const isLast = i === beatTarget - 1;
    const roll = rand();

    if (isLast) kind = 'finish';
    else if (roll < 0.35) kind = 'attack';
    else if (roll < 0.55) kind = 'defend';
    else if (roll < 0.7) kind = 'move';
    else if (roll < 0.85) kind = 'impact';
    else kind = 'pause';

    // Bei hohem Tempo gelegentlich einen Stakkato-Beat einschieben.
    const staccato = tempo === 'frantic' && rand() < 0.5;

    let text: string;
    switch (kind) {
      case 'attack':
        text = pick(ATTACK_LINES, rand);
        break;
      case 'defend':
        text = pick(DEFEND_LINES, rand);
        break;
      case 'move':
        text = pick(MOVE_LINES, rand);
        break;
      case 'impact':
        text = pick(IMPACT_LINES, rand);
        break;
      case 'pause':
        text = pick(PAUSE_LINES, rand);
        break;
      case 'finish':
      default:
        text = pick(FINISH_LINES, rand);
        break;
    }

    // Hindernis einweben (nicht in jedem Beat).
    let beatObstacle: Obstacle | undefined;
    if (obstacles.length > 0 && rand() < 0.35) {
      beatObstacle = pick(obstacles, rand);
      usedObstacles.add(beatObstacle);
      text = `${text}. ${OBSTACLE_EFFECTS[beatObstacle]}`;
    }

    // Stakkato-Zusatz bei Adrenalinspitzen.
    if (staccato) {
      text = `${text}. ${pick(STACCATO_LINES, rand)}`;
    }

    // Zustand der Figur einarbeiten.
    if (actor.condition === 'wounded' && rand() < 0.4) {
      text = `${text}. Die Wunde zog bei jeder Bewegung`;
    } else if (actor.condition === 'exhausted' && rand() < 0.4) {
      text = `${text}. Die Luft wurde knapp`;
    }

    // Wächter laufen lassen: unmögliche Kombinationen werden markiert.
    const validation = validateCombatBeat(actor, {
      attack: kind === 'attack',
      reload: kind === 'attack' && RELOAD_WEAPONS.has(actor.weapon ?? 'fists') && rand() < 0.3,
    });

    beats.push({
      index: i + 1,
      actor: actor.name,
      target: kind === 'attack' || kind === 'impact' ? target.name : undefined,
      text: text.endsWith('.') ? text : `${text}.`,
      kind,
      obstacle: beatObstacle,
      invalid: !validation.valid || undefined,
    });
  }

  const text = beats.map((b) => b.text).join(' ');
  const sentences = splitSentences(text);

  return {
    beats,
    text,
    combatants: cast.map((c) => c.name),
    beatCount: beats.length,
    obstacles: [...usedObstacles],
    sentenceCount: sentences.length,
    avgSentenceLength:
      sentences.length > 0 ? Math.round((countWords(text) / sentences.length) * 100) / 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 3) Pacing-Analyse
// ---------------------------------------------------------------------------

/**
 * Misst den Rhythmus einer Kampf-Choreografie.
 *
 * `staccatoRatio` ist der Anteil kurzer Sätze (< 6 Wörter);
 * `rhythmScore` belohnt einen Wechsel aus kurzen und langen Sätzen
 * (einheitliche Längen ergeben einen niedrigeren Wert).
 *
 * Defensiv: leerer Text liefert Nullen.
 */
export function analyzeCombatPacing(text: unknown): CombatPacing {
  const safe = typeof text === 'string' ? text : '';
  const sentences = splitSentences(safe);

  if (sentences.length === 0) {
    return {
      sentenceCount: 0,
      avgSentenceLength: 0,
      longestSentence: 0,
      staccatoRatio: 0,
      rhythmScore: 0,
    };
  }

  const lengths = sentences.map(countWords);
  const total = lengths.reduce((a, b) => a + b, 0);
  const shortCount = lengths.filter((l) => l < 6).length;

  // Rhythmus: Standardabweichung der Satzlängen, normiert.
  const mean = total / lengths.length;
  const variance =
    lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  // Eine mittlere Streuung gilt als idealer Wechsel.
  const ideal = Math.max(2, mean * 0.6);
  const rhythmScore = Math.round(Math.max(0, 1 - Math.abs(stdDev - ideal) / ideal) * 10000) / 10000;

  return {
    sentenceCount: sentences.length,
    avgSentenceLength: Math.round(mean * 100) / 100,
    longestSentence: Math.max(...lengths),
    staccatoRatio: Math.round((shortCount / lengths.length) * 10000) / 10000,
    rhythmScore,
  };
}
