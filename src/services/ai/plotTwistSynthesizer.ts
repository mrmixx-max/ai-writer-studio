// Autonomer Plot-Twist-Synthesizer (WP 58.1)
//
// Wenn die Geschichte in der Mitte durchhängt: erzeugt einen dramaturgischen
// Donnerschlag, der logisch vorbereitet, aber überraschend ist — inklusive
// der kompletten Konfrontationsszene.
//
// Drei deterministische Werkzeuge:
//
//   1. synthesizeTwist      — Twist-Idee je Archetyp (mit Vorbereitungsplan)
//   2. generateConfrontation — komplette Szenen-Prosa zur Enthüllung
//   3. scoreTwistImpact     — Überraschung × Vorbereitung = Wirksamkeit
//
// Design-Regeln (analog proseExpander / foreshadowingWeaver):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Die vier Twist-Archetypen. */
export type TwistArchetype =
  | 'identity-reveal'
  | 'false-objective'
  | 'moral-reversal'
  | 'sacrifice-choice';

/** Ein ausgearbeiteter Twist. */
export interface TwistIdea {
  /** Archetyp. */
  archetype: TwistArchetype;
  /** Menschenlesbarer Name. */
  label: string;
  /** Die eigentliche Enthüllung in einem Satz. */
  reveal: string;
  /** Wer die Enthüllung ausspricht/auslöst. */
  revealer: string;
  /** Betroffene Figur(en). */
  affected: string[];
  /** Logische Vorbereitung: Hinweise, die den Twist stützen. */
  setup: string[];
  /** Emotionale Wirkung auf den Leser. */
  emotionalImpact: string;
}

/** Optionen für die Twist-Synthese. */
export interface TwistOptions {
  /** Bevorzugter Archetyp (sonst deterministisch gewählt). */
  archetype?: TwistArchetype;
  /** Held der Geschichte. */
  protagonist?: string;
  /** Antagonist oder verdächtigte Figur. */
  antagonist?: string;
  /** Zentrales Objekt/Ziel der Handlung. */
  artifact?: string;
  /** Kapitelnummer der Enthüllung. */
  chapter?: number;
}

/** Ein Redebeitrag der Konfrontationsszene. */
export interface ConfrontationLine {
  /** Sprecher. */
  speaker: string;
  /** Text (Rede oder Erzählpassage). */
  text: string;
  /** Art des Beitrags. */
  kind: 'setup' | 'reveal' | 'reaction' | 'consequence';
}

/** Ergebnis der Konfrontations-Erzeugung. */
export interface ConfrontationScene {
  /** Der Twist, der enthüllt wird. */
  twist: TwistIdea;
  /** Alle Beiträge in Reihenfolge. */
  lines: ConfrontationLine[];
  /** Formatierter Szenentext. */
  text: string;
  /** Beteiligte Figuren. */
  characters: string[];
  /** Anzahl der Beiträge. */
  lineCount: number;
  /** Wortzahl. */
  wordCount: number;
}

/** Bewertung der Twist-Wirksamkeit. */
export interface TwistImpact {
  /** Überraschung 0–1 (wie unerwartet der Twist ist). */
  surprise: number;
  /** Vorbereitung 0–1 (wie gut die Hinweise ihn stützen). */
  preparation: number;
  /** Wirksamkeit 0–1 (Überraschung × Vorbereitung, harmonisch). */
  impact: number;
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
// Archetyp-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Archetyp-Namen. */
export const ARCHETYPE_LABELS: Record<TwistArchetype, string> = {
  'identity-reveal': 'Identitäts-Enthüllung',
  'false-objective': 'Scheinziel (False Objective)',
  'moral-reversal': 'Moralische Umkehr',
  'sacrifice-choice': 'Opfer-Wahl',
};

/** Enthüllungs-Vorlagen je Archetyp. {mentor}, {artifact}, {protagonist} werden ersetzt. */
const REVEAL_TEMPLATES: Record<TwistArchetype, readonly string[]> = {
  'identity-reveal': [
    '{mentor} ist der wahre Drahtzieher — und war es von Anfang an',
    '{mentor} ist der rechtmäßige Thronerbe, den alle für tot hielten',
    '{mentor} hat jede Spur gelegt, der die Gruppe gefolgt ist',
    '{mentor} hat den Krieg begonnen, um ihn zu beenden',
  ],
  'false-objective': [
    '{artifact} war nie das Ziel — es war der Schlüssel, den der Feind brauchte',
    'Die Rettung von {artifact} hat das Siegel erst geöffnet',
    '{artifact} sollte nie gefunden werden, sondern bewacht',
    'Jeder Schritt zu {artifact} war ein Schritt in die Falle',
  ],
  'moral-reversal': [
    'Die scheinbar böse Fraktion um {mentor} schützt die Welt vor einer größeren Katastrophe',
    '{mentor} tötet, um Schlimmeres zu verhindern — und niemand wusste es',
    'Die Belagerten um {mentor} sind nicht die Opfer, sondern die Wächter',
    'Der Krieg, den alle um {mentor} verurteilen, ist das letzte Bollwerk',
  ],
  'sacrifice-choice': [
    'Der Sieg verlangt die Zerstörung dessen, wofür {protagonist} gekämpft hat',
    'Um zu gewinnen, muss {protagonist} genau das aufgeben, was ihn rettete',
    'Die Rettung kostet {protagonist} das Leben des Einzigen, der sie möglich macht',
    'Der Ausweg ist für {protagonist} der Verlust — und er weiß es',
  ],
};

/** Vorbereitungs-Hinweise je Archetyp. */
const SETUP_TEMPLATES: Record<TwistArchetype, readonly string[]> = {
  'identity-reveal': [
    'Eine beiläufige Bemerkung, die nur im Rückblick Sinn ergibt',
    'Ein Detail der Kleidung oder Ausrüstung, das nicht passt',
    'Eine Entscheidung, die zu schnell und zu richtig war',
    'Ein Name, der an einer falschen Stelle auftaucht',
  ],
  'false-objective': [
    'Ein Warnhinweis, den die Figur als Aberglaube abtut',
    'Eine Karte oder Inschrift mit einem unlesbaren Zusatz',
    'Ein Handwerker, der zu genau über das Objekt Bescheid weiß',
    'Ein Fluch, der eher wie ein Schutz wirkt',
  ],
  'moral-reversal': [
    'Ein fehlender Bericht über die Gräueltaten des Feindes',
    'Ein Gefangener, der sich nicht wie ein Gefangener benimmt',
    'Eine Waffe, die nie gegen Zivilisten eingesetzt wurde',
    'Ein Befehl, der Milde verlangt, wo Härte erwartet wird',
  ],
  'sacrifice-choice': [
    'Eine Prophezeiung mit einer Bedingung, die niemand hören wollte',
    'Ein Versprechen, das an eine Bedingung geknüpft war',
    'Ein Gegenstand, der nie benutzt wurde, obwohl er bereitlag',
    'Ein Abschied, der zu endgültig wirkte für einen Aufbruch',
  ],
};

/** Emotionale Wirkung je Archetyp. */
const IMPACT_LABELS: Record<TwistArchetype, string> = {
  'identity-reveal': 'Erschüttertes Vertrauen — jede geteilte Szene wird neu lesbar',
  'false-objective': 'Sinnverlust und Wut — die ganze Reise kippt in ihr Gegenteil',
  'moral-reversal': 'Moralische Erschütterung — Gut und Böse tauschen die Plätze',
  'sacrifice-choice': 'Tragische Erhabenheit — Größe durch Verlust',
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Archetyp defensiv prüfen. */
function normalizeArchetype(value: unknown): TwistArchetype | null {
  const all: TwistArchetype[] = [
    'identity-reveal', 'false-objective', 'moral-reversal', 'sacrifice-choice',
  ];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as TwistArchetype)
    : null;
}

/** Namen defensiv normalisieren. */
function normalizeName(value: unknown, fallback: string): string {
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
// 1) Twist-Synthese
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen ausgearbeiteten Twist samt logischer Vorbereitung.
 *
 * Ohne Vorgabe wird der Archetyp deterministisch aus den Eingaben gewählt.
 * Die Vorbereitungs-Hinweise sind so formuliert, dass sie im Manuskript
 * beiläufig wirken und erst rückblickend Sinn ergeben.
 *
 * Defensiv: fehlende Namen werden durch neutrale Platzhalter ersetzt.
 */
export function synthesizeTwist(options?: TwistOptions | null): TwistIdea {
  const protagonist = normalizeName(options?.protagonist, 'der Held');
  const antagonist = normalizeName(options?.antagonist, 'der Mentor');
  const artifact = normalizeName(options?.artifact, 'das Relikt');

  const requested = normalizeArchetype(options?.archetype);
  const rand = createSeededRandom(
    hashString(`${protagonist}#${antagonist}#${artifact}#${requested ?? 'auto'}#${options?.chapter ?? 0}`),
  );

  const archetype: TwistArchetype =
    requested ??
    pick(
      ['identity-reveal', 'false-objective', 'moral-reversal', 'sacrifice-choice'] as TwistArchetype[],
      rand,
    );

  const raw = pick(REVEAL_TEMPLATES[archetype], rand);
  const reveal = raw
    .replace(/\{mentor\}/g, antagonist)
    .replace(/\{protagonist\}/g, protagonist)
    .replace(/\{artifact\}/g, artifact);

  // Zwei Vorbereitungs-Hinweise, deterministisch und ohne Wiederholung.
  const setupPool = SETUP_TEMPLATES[archetype];
  const setup: string[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (setup.length < 2 && guard < setupPool.length * 3) {
    guard++;
    const idx = Math.floor(rand() * setupPool.length) % setupPool.length;
    if (used.has(idx) && used.size < setupPool.length) continue;
    used.add(idx);
    setup.push(setupPool[idx]);
  }

  // Betroffene Figuren je Archetyp.
  const affected =
    archetype === 'identity-reveal'
      ? [protagonist, antagonist]
      : archetype === 'sacrifice-choice'
        ? [protagonist]
        : archetype === 'false-objective'
          ? [protagonist, artifact]
          : [protagonist, antagonist];

  return {
    archetype,
    label: ARCHETYPE_LABELS[archetype],
    reveal: ensurePeriod(reveal),
    revealer: archetype === 'identity-reveal' ? antagonist : protagonist,
    affected,
    setup,
    emotionalImpact: IMPACT_LABELS[archetype],
  };
}

// ---------------------------------------------------------------------------
// 2) Konfrontationsszene
// ---------------------------------------------------------------------------

/** Aufbau-Beiträge vor der Enthüllung. */
const SETUP_LINES: readonly string[] = [
  'Der Raum war zu still für das, was gleich geschehen würde',
  'Niemand hatte die Waffe gezogen, und das war das Schlimmste',
  'Auf dem Tisch lagen die Beweise, ordentlich wie Rechnungen',
  'Die Tür war zu, aber niemand hatte sie geschlossen',
];

/** Schock-Reaktionen nach der Enthüllung. */
const REACTION_LINES: readonly string[] = [
  'Das Blut wich aus dem Gesicht, und die Hände wurden kalt',
  'Ein Wort blieb im Hals stecken und kam nie heraus',
  'Die Beine trugen nicht mehr, und die Wand musste es tun',
  'Es war kein Schrei. Es war ein Atemholen, das nicht endete',
  'Etwas in der Brust riss, und es machte kein Geräusch',
];

/** Konsequenz-Beiträge nach der Reaktion. */
const CONSEQUENCE_LINES: readonly string[] = [
  'Die Freundschaft war nicht zerbrochen — sie hatte nie existiert',
  'Was bleibt, ist die Frage, ob man es früher hätte sehen müssen',
  'Niemand sagte etwas. Es gab nichts mehr zu sagen.',
  'Die Loyalität fiel lautlos zu Boden und niemand hob sie auf',
  'Von hier an gab es nur noch ein Ziel, und es war nicht mehr dasselbe',
];

/**
 * Erzeugt die komplette Konfrontationsszene zum Twist.
 *
 * Vier Phasen: Aufbau → Enthüllung → Schockreaktion → Konsequenz. Die Szene
 * ist zur direkten Übernahme ins Manuskript formatiert.
 *
 * Defensiv: fehlende Namen werden durch neutrale Platzhalter ersetzt.
 */
export function generateConfrontation(options?: TwistOptions | null): ConfrontationScene {
  const protagonist = normalizeName(options?.protagonist, 'der Held');
  const antagonist = normalizeName(options?.antagonist, 'der Mentor');
  const twist = synthesizeTwist(options);

  const rand = createSeededRandom(
    hashString(`confront#${protagonist}#${antagonist}#${twist.archetype}`),
  );

  const lines: ConfrontationLine[] = [];

  // Phase 1: Aufbau.
  lines.push({ speaker: 'Erzähler', text: ensurePeriod(pick(SETUP_LINES, rand)), kind: 'setup' });
  lines.push({
    speaker: protagonist,
    text: `„${twist.setup[0] ?? 'Das war also die ganze Zeit so'}?"`,
    kind: 'setup',
  });

  // Phase 2: Enthüllung.
  lines.push({
    speaker: twist.revealer,
    text: `„${twist.reveal.replace(/\.$/, '')}."`,
    kind: 'reveal',
  });

  // Phase 3: Schockreaktion.
  lines.push({
    speaker: 'Erzähler',
    text: ensurePeriod(pick(REACTION_LINES, rand)),
    kind: 'reaction',
  });
  lines.push({
    speaker: protagonist,
    text: `„${pick(['Du', 'Sie'] as const, rand)} … warum?"`,
    kind: 'reaction',
  });

  // Phase 4: Konsequenz.
  lines.push({
    speaker: twist.revealer,
    text: `„${twist.emotionalImpact}."`,
    kind: 'consequence',
  });
  lines.push({
    speaker: 'Erzähler',
    text: ensurePeriod(pick(CONSEQUENCE_LINES, rand)),
    kind: 'consequence',
  });

  const text = lines
    .map((l) => (l.speaker === 'Erzähler' ? l.text : `${l.speaker.toUpperCase()}: ${l.text}`))
    .join('\n\n');

  return {
    twist,
    lines,
    text,
    characters: [protagonist, antagonist],
    lineCount: lines.length,
    wordCount: countWords(text),
  };
}

// ---------------------------------------------------------------------------
// 3) Wirksamkeits-Bewertung
// ---------------------------------------------------------------------------

/**
 * Bewertet die Wirksamkeit eines Twists.
 *
 * `surprise` sinkt mit der Zahl der Vorbereitungs-Hinweise (zu viele Hinweise
 * machen den Twist vorhersehbar), `preparation` steigt damit. `impact` ist das
 * harmonische Mittel beider Werte — ein Twist braucht beides.
 *
 * Defensiv: ungültige Eingaben liefern Nullen.
 */
export function scoreTwistImpact(twist: TwistIdea | null | undefined): TwistImpact {
  if (!twist || typeof twist !== 'object') {
    return {
      surprise: 0,
      preparation: 0,
      impact: 0,
      recommendation: 'Kein Twist übergeben.',
    };
  }

  const setupCount = Array.isArray(twist.setup) ? twist.setup.length : 0;

  // Vorbereitung: 1 Hinweis = 0.5, 2 = 0.85, ab 3 = 1 (mit Sättigung).
  const preparation = Math.round(Math.min(1, setupCount === 0 ? 0 : 0.5 + setupCount * 0.175) * 10000) / 10000;

  // Überraschung: hoher Grundwert, sinkt mit zu vielen Hinweisen.
  const surprise = Math.round(Math.max(0.3, 1 - setupCount * 0.12) * 10000) / 10000;

  // Harmonisches Mittel: bestraft einseitige Werte stärker als das arithmetische.
  const impact =
    surprise + preparation > 0
      ? Math.round(((2 * surprise * preparation) / (surprise + preparation)) * 10000) / 10000
      : 0;

  let recommendation: string;
  if (impact >= 0.75) {
    recommendation = 'Starker Twist: überraschend und dennoch vorbereitet.';
  } else if (preparation < 0.5) {
    recommendation = 'Zu wenig Vorbereitung — der Twist wirkt aufgesetzt. Hinweise einweben.';
  } else if (surprise < 0.5) {
    recommendation = 'Zu viele Hinweise — der Twist ist vorhersehbar. Spuren reduzieren.';
  } else {
    recommendation = 'Solide: Überraschung und Vorbereitung sind ausgewogen.';
  }

  return { surprise, preparation, impact, recommendation };
}
