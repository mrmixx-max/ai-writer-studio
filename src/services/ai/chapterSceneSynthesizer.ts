// Autonomer Gesamt-Kapitel-Synthesizer (WP 60.1)
//
// Weht aus mehreren Szenen-Beats ein vollständiges, dramaturgisch geschlossenes
// Kapitel — mit organischen Übergängen und gesteuerter narrativer Kadenz.
//
// Drei deterministische Werkzeuge:
//
//   1. synthesizeChapter    — Beat-Liste → vollständiges Kapitel (4 Szenen)
//   2. buildSceneBridge     — Übergang zwischen zwei Szenen
//   3. analyzeChapterCadence — Kadenz-Kurve (Tempo je Szene)
//
// Design-Regeln (analog proseExpander / atmosphereProseGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Dramaturgische Funktion einer Szene. */
export type SceneRole = 'hook' | 'complication' | 'turning-point' | 'resolution';

/** Narratives Tempo. */
export type Cadence = 'slow' | 'medium' | 'fast';

/** Eingabe für den Kapitel-Synthesizer. */
export interface ChapterInput {
  /** Kapitelnummer (für den Titel). */
  number?: number;
  /** Kapitel-Titel. */
  title?: string;
  /** Szenen-Beats (1–6). Werden auf die vier Rollen abgebildet. */
  beats?: string[];
  /** Ort der ersten Szene. */
  location?: string;
  /** Figur im Zentrum. */
  protagonist?: string;
  /** Antagonist/Gegenspieler. */
  antagonist?: string;
}

/** Eine erzeugte Szene. */
export interface SynthesizedScene {
  /** Dramaturgische Rolle. */
  role: SceneRole;
  /** Menschenlesbarer Rollenname. */
  roleLabel: string;
  /** Szenenüberschrift (Regie-Notiz, nicht Teil der Prosa). */
  heading: string;
  /** Die Szenenprosa. */
  prose: string;
  /** Narratives Tempo dieser Szene. */
  cadence: Cadence;
  /** Wortzahl. */
  wordCount: number;
}

/** Ergebnis der Kapitel-Synthese. */
export interface SynthesizedChapter {
  /** Kapitelnummer. */
  number: number;
  /** Kapitel-Titel. */
  title: string;
  /** Die vier Szenen. */
  scenes: SynthesizedScene[];
  /** Vollständiger Text (Szenen mit Leerzeile getrennt). */
  text: string;
  /** Gesamtwortzahl. */
  wordCount: number;
  /** Gesamtzahl der Szenen. */
  sceneCount: number;
  /** Durchschnittliches Tempo. */
  averageCadence: Cadence;
}

/** Eine Szenen-Brücke. */
export interface SceneBridge {
  /** Der Übergangstext. */
  text: string;
  /** Art des Übergangs. */
  kind: 'time' | 'place' | 'mood';
  /** Wortzahl. */
  wordCount: number;
}

/** Ergebnis der Kadenz-Analyse. */
export interface ChapterCadence {
  /** Tempo je Szene. */
  perScene: Cadence[];
  /** Numerische Kadenz 0–1 je Szene (0 = langsam, 1 = schnell). */
  values: number[];
  /** true, wenn die Kadenz vom langsamen Anfang zur schnellen Spitze steigt. */
  wellPaced: boolean;
  /** Position der höchsten Kadenz (0-basiert). */
  peakIndex: number;
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
// Rollen-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Rollen-Namen. */
export const ROLE_LABELS: Record<SceneRole, string> = {
  hook: 'Atmosphärischer Haken',
  complication: 'Komplikation & Konfrontation',
  'turning-point': 'Unerwarteter Wendepunkt',
  resolution: 'Ausklang oder Cliffhanger',
};

/** Kadenz je Rolle — die dramaturgische Geschwindigkeits-Regel. */
const ROLE_CADENCE: Record<SceneRole, Cadence> = {
  hook: 'slow',
  complication: 'medium',
  'turning-point': 'fast',
  resolution: 'medium',
};

/** Satzanzahl je Tempo. */
const CADENCE_SENTENCES: Record<Cadence, number> = {
  slow: 5,
  medium: 4,
  fast: 3,
};

// ---------------------------------------------------------------------------
// Prosa-Bausteine
// ---------------------------------------------------------------------------

/** Eröffnungen je Rolle. */
const ROLE_OPENERS: Record<SceneRole, readonly string[]> = {
  hook: [
    'Der Morgen kam grau und ohne Versprechen',
    'Es begann mit einem Geräusch, das niemand einordnen konnte',
    'Der Ort war leer, und das war das Erste, was auffiel',
    'Nebel lag über allem, als hätte jemand die Welt vergessen',
  ],
  complication: [
    'Es hätte einfach sein sollen, und es war es nicht',
    'Die Frage kam schneller als die Antwort',
    'Zwischen ihnen stand etwas, das keiner benannte',
    'Es gab zwei Versionen, und beide klangen wahr',
  ],
  'turning-point': [
    'Dann kippte alles',
    'Der Moment kam ohne Vorwarnung',
    'Es brach in der Mitte entzwei',
    'Nichts davon war geplant gewesen',
  ],
  resolution: [
    'Danach war es still, aber nicht friedlich',
    'Was blieb, war eine offene Rechnung',
    'Der Tag endete, wie er begonnen hatte: unentschieden',
    'Niemand sagte es laut, aber alle wussten es',
  ],
};

/** Atmosphärische Details (langsames Tempo / Worldbuilding). */
const ATMOSPHERIC_DETAILS: readonly string[] = [
  'Der Wind trug den Geruch von nassem Holz heran',
  'Irgendwo schlug eine Tür, zweimal, dann nichts',
  'Das Licht fiel schräg und machte aus allem Schatten',
  'Der Boden war kalt durch die Sohlen',
  'Ein Vogel strich tief über das Dach und war fort',
  'Die Luft schmeckte nach Rauch und Regen',
];

/** Dialogzeilen (mittleres Tempo). */
const DIALOGUE_LINES: readonly string[] = [
  '„Sie sagen, es sei vorbei."',
  '„Und wenn es das nicht ist?"',
  '„Dann haben wir ein Problem, das größer ist als wir."',
  '„Ich habe es gesehen. Ich sage nur, was ich gesehen habe."',
  '„Das glaube ich Ihnen nicht."',
  '„Sie müssen nicht. Sie müssen nur zuhören."',
];

/** Harte Kurzsätze (schnelles Tempo). */
const FAST_BEATS: readonly string[] = [
  'Kein Ausweg.',
  'Zu spät.',
  'Jetzt.',
  'Kein Zurück.',
  'Nur noch Tempo.',
  'Dann Stille.',
];

/** Cliffhanger-Schlüsse. */
const CLIFFHANGERS: readonly string[] = [
  'Und dann öffnete sich die Tür, und es war nicht, wer es sein sollte',
  'Der Brief lag auf dem Tisch, und die Handschrift war die eigene',
  'Auf dem Boden lag die Waffe, und sie war noch warm',
  'Der Name, den sie nannte, gehörte einem Toten',
  'Der Schuss fiel, und niemand wusste, wen er traf',
];

/** Ausklang-Schlüsse (ruhig). */
const RESOLUTIONS: readonly string[] = [
  'Es war vorbei, und vorbei war ein Anfang',
  'Sie würde morgen weitermachen. Heute nicht.',
  'Der Frieden kam nicht von außen, aber er kam',
  'Was übrig war, genügte',
];

/** Zeit-Brücken. */
const TIME_BRIDGES: readonly string[] = [
  'Drei Stunden später war alles anders',
  'Der Nachmittag verging, ohne dass jemand es bemerkte',
  'Am nächsten Morgen war der Nebel dichter als zuvor',
  'Die Nacht dazwischen war lang und ohne Schlaf',
];

/** Orts-Brücken. */
const PLACE_BRIDGES: readonly string[] = [
  'Der Weg führte sie dorthin, wo niemand freiwillig hinging',
  'Ein anderes Haus, ein anderes Licht, dieselbe Stille',
  'Sie wechselten den Ort, nicht die Anspannung',
  'Die Straße endete dort, wo das Gespräch beginnen musste',
];

/** Stimmungs-Brücken. */
const MOOD_BRIDGES: readonly string[] = [
  'Etwas hatte sich verschoben, ohne dass ein Wort fiel',
  'Die Stimmung kippte, und niemand konnte sagen, wann',
  'Zwischen zwei Sätzen lag mehr als zwischen zwei Stunden',
  'Es war derselbe Raum und trotzdem ein anderer',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Beats defensiv normalisieren. */
function normalizeBeats(beats: unknown): string[] {
  if (!Array.isArray(beats)) return [];
  return beats
    .filter((b): b is string => typeof b === 'string')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .slice(0, 6);
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

/** Erstes Zeichen groß. */
function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// ---------------------------------------------------------------------------
// 1) Kapitel-Synthese
// ---------------------------------------------------------------------------

/**
 * Weht aus Szenen-Beats ein vollständiges Kapitel.
 *
 * Die Beats werden auf die vier dramaturgischen Rollen abgebildet. Fehlen
 * Beats, werden die Rollen mit generischen Inhalten gefüllt. Das Tempo folgt
 * der Geschwindigkeits-Regel: langsam → mittel → schnell → mittel.
 *
 * Defensiv: ohne Beats entsteht dennoch ein vollständiges Kapitel.
 */
export function synthesizeChapter(input?: ChapterInput | null): SynthesizedChapter {
  const beats = normalizeBeats(input?.beats);
  const number =
    typeof input?.number === 'number' && Number.isFinite(input.number)
      ? Math.max(1, Math.round(input.number))
      : 1;
  const title = normalizeText(input?.title, `Kapitel ${number}`);
  const location = normalizeText(input?.location, 'Der Ort');
  const protagonist = normalizeText(input?.protagonist, 'sie');
  const antagonist = normalizeText(input?.antagonist, 'der Gegner');

  const rand = createSeededRandom(
    hashString(`${title}#${beats.join('|')}#${location}#${protagonist}#${antagonist}`),
  );

  const roles: SceneRole[] = ['hook', 'complication', 'turning-point', 'resolution'];
  const scenes: SynthesizedScene[] = [];

  roles.forEach((role, index) => {
    const cadence = ROLE_CADENCE[role];
    const sentenceCount = CADENCE_SENTENCES[cadence];
    const beat = beats[index];

    const parts: string[] = [];

    // Eröffnung: Beat, wenn vorhanden, sonst Rollen-Vorlage.
    if (beat) {
      parts.push(ensurePeriod(capitalize(beat)));
      // Ort immer verankern — eine Szene ohne Ortsbezug wirkt ortlos.
      if (role === 'hook') {
        parts.push(ensurePeriod(location));
      }
    } else if (role === 'hook') {
      parts.push(ensurePeriod(`${location}. ${pick(ROLE_OPENERS[role], rand)}`));
    } else {
      parts.push(ensurePeriod(pick(ROLE_OPENERS[role], rand)));
    }

    // Tempo-gerechte Auffüllung (ohne Wiederholungen).
    const usedDetails = new Set<string>();
    const addDetail = () => {
      if (usedDetails.size >= ATMOSPHERIC_DETAILS.length) return;
      let guard = 0;
      let detail = pick(ATMOSPHERIC_DETAILS, rand);
      while (usedDetails.has(detail) && guard < ATMOSPHERIC_DETAILS.length * 2) {
        guard++;
        detail = pick(ATMOSPHERIC_DETAILS, rand);
      }
      usedDetails.add(detail);
      parts.push(ensurePeriod(detail));
    };

    if (cadence === 'slow') {
      while (parts.length < sentenceCount) {
        addDetail();
      }
    } else if (cadence === 'medium') {
      const usedLines = new Set<string>();
      while (parts.length < sentenceCount) {
        let line = pick(DIALOGUE_LINES, rand);
        let guard = 0;
        while (usedLines.has(line) && guard < DIALOGUE_LINES.length * 2) {
          guard++;
          line = pick(DIALOGUE_LINES, rand);
        }
        usedLines.add(line);
        parts.push(`${protagonist.toUpperCase()}: ${line}`);
      }
    } else {
      // Schnell: kurze, harte Sätze.
      parts.push(ensurePeriod(pick(FAST_BEATS, rand)));
      while (parts.length < sentenceCount) {
        parts.push(pick(FAST_BEATS, rand));
      }
    }

    // Schlusssatz je Rolle.
    if (role === 'turning-point' || role === 'resolution') {
      // Antagonist nur bei der Auflösung nennen, wenn vorhanden.
      if (role === 'resolution' && antagonist !== 'der Gegner' && rand() < 0.6) {
        parts.push(ensurePeriod(`${antagonist} war nicht mehr da, und das war nicht dasselbe wie Frieden`));
      } else {
        parts.push(
          ensurePeriod(
            role === 'turning-point' ? pick(CLIFFHANGERS, rand) : pick(RESOLUTIONS, rand),
          ),
        );
      }
    }

    const prose = parts.join(' ');

    scenes.push({
      role,
      roleLabel: ROLE_LABELS[role],
      heading: `[${ROLE_LABELS[role]}]`,
      prose,
      cadence,
      wordCount: countWords(prose),
    });
  });

  const text = scenes.map((s) => s.prose).join('\n\n');
  const cadences = scenes.map((s) => s.cadence);

  return {
    number,
    title,
    scenes,
    text,
    wordCount: countWords(text),
    sceneCount: scenes.length,
    averageCadence: cadences[1] ?? 'medium',
  };
}

// ---------------------------------------------------------------------------
// 2) Szenen-Brücken
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen organischen Übergang zwischen zwei Szenen.
 *
 * Defensiv: leerer/ungültiger Text wird unverändert zurückgegeben.
 */
export function buildSceneBridge(from?: unknown, to?: unknown, kind?: unknown): SceneBridge {
  const source = typeof from === 'string' ? from.trim() : '';
  const target = typeof to === 'string' ? to.trim() : '';
  const bridgeKind: SceneBridge['kind'] =
    kind === 'time' || kind === 'place' || kind === 'mood' ? kind : 'mood';

  const rand = createSeededRandom(hashString(`${source}#${target}#${bridgeKind}`));

  const pool =
    bridgeKind === 'time'
      ? TIME_BRIDGES
      : bridgeKind === 'place'
        ? PLACE_BRIDGES
        : MOOD_BRIDGES;

  const text = ensurePeriod(pick(pool, rand));

  return { text, kind: bridgeKind, wordCount: countWords(text) };
}

// ---------------------------------------------------------------------------
// 3) Kadenz-Analyse
// ---------------------------------------------------------------------------

/**
 * Analysiert die narrative Kadenz eines Kapitels.
 *
 * `wellPaced` ist true, wenn die Kadenz ansteigt und die Spitze nicht am
 * Anfang liegt — ein Kapitel, das sofort auf Höchsttempo startet, hat keinen
 * Aufbau.
 *
 * Defensiv: leerer Text liefert eine leere Analyse.
 */
export function analyzeChapterCadence(text: unknown): ChapterCadence {
  const empty: ChapterCadence = {
    perScene: [],
    values: [],
    wellPaced: false,
    peakIndex: 0,
  };

  if (typeof text !== 'string' || text.trim().length === 0) return empty;

  // Szenen sind durch Leerzeilen getrennt (Kapitel-Format).
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (blocks.length === 0) return empty;

  // Tempo je Block heuristisch: kurze Sätze = hohes Tempo.
  const values = blocks.map((block) => {
    const sentences = block.match(/[^.!?]+[.!?]*/g) ?? [];
    const lengths = sentences.map((s) => countWords(s)).filter((l) => l > 0);
    if (lengths.length === 0) return 0;
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    // Kurze Durchschnittssätze → hohes Tempo (max. 20 Wörter als Referenz).
    return Math.round(Math.max(0, Math.min(1, 1 - avg / 20)) * 100) / 100;
  });

  const perScene: Cadence[] = values.map((v) =>
    v < 0.4 ? 'slow' : v < 0.7 ? 'medium' : 'fast',
  );

  const peakIndex = values.indexOf(Math.max(...values));

  // Wohlgepaced: Spitze nicht am Anfang und Anstieg erkennbar.
  const wellPaced =
    values.length >= 2 &&
    peakIndex > 0 &&
    values[values.length - 1] <= Math.max(...values);

  return { perScene, values, wellPaced, peakIndex };
}
