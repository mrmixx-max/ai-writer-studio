// Doppelbödigkeits- & Intrigen-Synthesizer (WP 64.1)
//
// In Spionage-, Hof- und Polit-Thrillern spricht niemand offen: ein höflicher
// Satz über Wein oder Schach transportiert eine versteckte Warnung oder einen
// Erpressungsversuch.
//
// Drei deterministische Werkzeuge:
//
//   1. synthesizeDoubleEntendre — Oberfläche + Subtext → doppelbödiger Dialog
//   2. decipherLine            — die wahre Absicht einer Zeile entschlüsseln
//   3. analyzeLayering         — Doppelbödigkeit eines Dialogs bewerten
//
// Design-Regeln (analog subtextConflictInjector / multiAgentWritersRoom):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Belangloses Oberflächen-Thema. */
export type SurfaceTopic = 'garden' | 'wine' | 'chess' | 'weather' | 'music';

/** Gefährliche Unterbedeutung. */
export type HiddenIntent =
  | 'accusation'
  | 'threat'
  | 'blackmail'
  | 'warning'
  | 'alliance-offer';

/** Optionen für die Dialog-Erzeugung. */
export interface DoubleEntendreOptions {
  /** Oberflächen-Thema. Default: 'garden'. */
  topic?: SurfaceTopic;
  /** Versteckte Absicht. Default: 'accusation'. */
  intent?: HiddenIntent;
  /** Sprecher. */
  speaker?: string;
  /** Angesprochene Figur. */
  listener?: string;
  /** Konkreter Subtext, z. B. „Ich weiß vom Gift". */
  secret?: string;
  /** Anzahl der Redebeiträge (2–10). Default: 6. */
  turns?: number;
}

/** Ein Redebeitrag mit Doppelboden. */
export interface LayeredLine {
  /** 1-basierte Nummer. */
  index: number;
  /** Sprecher. */
  speaker: string;
  /** Die Oberfläche — was laut gesagt wird. */
  surface: string;
  /** Die wahre Absicht — was gemeint ist. */
  subtext: string;
  /** Vielsagende Regieanweisung. */
  stageDirection?: string;
}

/** Ergebnis der Dialog-Erzeugung. */
export interface LayeredDialogue {
  /** Alle Beiträge. */
  lines: LayeredLine[];
  /** Formatierter Text (nur Oberfläche). */
  surfaceText: string;
  /** Formatierter Text mit entschlüsseltem Subtext. */
  decipheredText: string;
  /** Verwendetes Oberflächen-Thema. */
  topic: SurfaceTopic;
  /** Menschenlesbarer Themen-Name. */
  topicLabel: string;
  /** Verwendete Absicht. */
  intent: HiddenIntent;
  /** Menschenlesbarer Absichts-Name. */
  intentLabel: string;
  /** Anzahl der Beiträge. */
  lineCount: number;
}

/** Ergebnis der Dechiffrierung. */
export interface DecipheredLine {
  /** Die Oberfläche. */
  surface: string;
  /** Die entschlüsselte Absicht. */
  meaning: string;
  /** Erkannter Absichts-Typ. */
  intent: HiddenIntent | null;
  /** Auslösende Signalwörter. */
  signals: string[];
}

/** Ergebnis der Doppelbödigkeits-Analyse. */
export interface LayeringAnalysis {
  /** Anteil der Beiträge mit Doppelboden (0–1). */
  layeringRate: number;
  /** Durchschnittliche Länge der Oberfläche in Wörtern. */
  averageSurfaceLength: number;
  /** Anzahl der Regieanweisungen. */
  stageDirectionCount: number;
  /** true, wenn genug Doppelbödigkeit vorhanden ist. */
  sufficientlyLayered: boolean;
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
// Oberflächen- und Subtext-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Themen-Namen. */
export const TOPIC_LABELS: Record<SurfaceTopic, string> = {
  garden: 'Gartenblumen',
  wine: 'Weinlese',
  chess: 'Schachzüge',
  weather: 'Wetterlage',
  music: 'Kammermusik',
};

/** Menschenlesbare Absichts-Namen. */
export const INTENT_LABELS: Record<HiddenIntent, string> = {
  accusation: 'Anklage',
  threat: 'Drohung',
  blackmail: 'Erpressung',
  warning: 'Warnung',
  'alliance-offer': 'Bündnisangebot',
};

/** Oberflächen-Sätze je Thema. */
const SURFACE_LINES: Record<SurfaceTopic, readonly string[]> = {
  garden: [
    'Die Rosen stehen dieses Jahr bemerkenswert früh',
    'Man muss aufpassen, welche Knospen man abschneidet',
    'Der Gärtner hat zuletzt etwas nachlässig gearbeitet',
    'Ein einziger Schädling kann den ganzen Beet zugrunde richten',
    'Ich ziehe es vor, im Schatten zu stehen und zuzusehen',
  ],
  wine: [
    'Dieser Jahrgang hat einen merkwürdigen Nachgeschmack',
    'Man sollte wissen, was im Kelch schwimmt',
    'Ich trinke nur, was ich selbst eingeschenkt habe',
    'Der letzte Tropfen ist immer der gefährlichste',
    'Ein guter Wein verrät seinen Kellermeister',
  ],
  chess: [
    'Eine Dame, die zu weit vorprescht, steht am Ende allein',
    'Sie haben einen Bauern geopfert, ohne es zu merken',
    'Das Matt kommt immer aus der Richtung, die man nicht deckt',
    'Manche Züge sind nur dann klug, wenn niemand hinsieht',
    'Ich spiele gern gegen Gegner, die glauben zu führen',
  ],
  weather: [
    'Der Wind dreht sich schneller, als man denkt',
    'Man spürt den Sturm, lange bevor er ankommt',
    'Es wäre klug, jetzt ein Fenster zu schließen',
    'Nach diesem Wetter kommt nichts Gutes',
    'Ich habe schon Gewitter über ruhigeren Feldern gesehen',
  ],
  music: [
    'Ein falscher Ton verdirbt das ganze Quartett',
    'Manche Instrumente sollte man nicht ohne Grund stimmen',
    'Das Stück endet anders, als es beginnt',
    'Ich höre lieber zu, als mitzuspielen',
    'Ein Dirigent, der zögert, verliert das Orchester',
  ],
};

/** Subtext-Sätze je Absicht. {who} wird ersetzt. */
const SUBTEXT_LINES: Record<HiddenIntent, readonly string[]> = {
  accusation: [
    'Ich weiß, was {who} getan hat — und ich habe Beweise',
    'Die Tat lässt sich nicht länger vertuschen',
    'Ich nenne keine Namen, aber {who} kennt sie',
  ],
  threat: [
    'Wenn {who} einen Schritt zu weit geht, endet es schlecht',
    'Ich habe Mittel, die {who} nicht kennt',
    'Der nächste Zug wird der letzte sein',
  ],
  blackmail: [
    'Ich kenne ein Geheimnis von {who}, das viel wert ist',
    'Was {who} verbergen will, hat einen Preis',
    'Ein Wort von mir genügt, und alles bricht zusammen',
  ],
  warning: [
    '{who} sollte diesen Ort heute Nacht verlassen',
    'Was geplant ist, wird {who} nicht überleben',
    'Ich warne aus eigenem Interesse, nicht aus Güte',
  ],
  'alliance-offer': [
    'Ich könnte {who} etwas anbieten, das beide rettet',
    'Ein Bündnis wäre klüger als dieses Geplänkel',
    'Zusammen wären {who} und ich unangreifbar',
  ],
};

/** Vielsagende Regieanweisungen. */
const STAGE_DIRECTIONS: readonly string[] = [
  'Ein Blick, der eine Sekunde zu lang hielt',
  'Das Lächeln erreichte die Augen nicht',
  'Die Hand ruhte auf dem Glas, ohne es zu heben',
  'Ein Nicken, das keine Zustimmung war',
  'Der Blick wanderte zur Tür und wieder zurück',
  'Die Stimme blieb ruhig, und die Ruhe war die Botschaft',
  'Ein Schulterzucken, das zu betont ausfiel',
  'Die Finger tippten zweimal auf den Tisch, dann nichts',
];

/** Signalwörter je Absicht (für die Dechiffrierung). */
const INTENT_SIGNALS: Record<HiddenIntent, readonly string[]> = {
  accusation: ['weiß', 'beweise', 'tat', 'vertuschen', 'nennen'],
  threat: ['schritt zu weit', 'ende', 'mittel', 'letzte', 'schlecht'],
  blackmail: ['geheimnis', 'preis', 'verbergen', 'genügt', 'zusammenbricht'],
  warning: ['verlassen', 'nicht überleben', 'warn', 'heute nacht', 'geplant'],
  'alliance-offer': ['anbieten', 'bündnis', 'zusammen', 'unangreifbar', 'retten'],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Thema defensiv prüfen. */
function normalizeTopic(value: unknown): SurfaceTopic {
  const all: SurfaceTopic[] = ['garden', 'wine', 'chess', 'weather', 'music'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as SurfaceTopic)
    : 'garden';
}

/** Absicht defensiv prüfen. */
function normalizeIntent(value: unknown): HiddenIntent {
  const all: HiddenIntent[] = ['accusation', 'threat', 'blackmail', 'warning', 'alliance-offer'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as HiddenIntent)
    : 'accusation';
}

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Beitragszahl begrenzen. */
function normalizeTurns(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 6;
  return Math.min(10, Math.max(2, Math.round(value)));
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Rundet auf 4 Nachkommastellen. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// 1) Doppelbödiger Dialog
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen doppelbödigen Dialog.
 *
 * Die Oberfläche bleibt harmlos (Blumen, Wein, Schach); der Subtext transportiert
 * die tödliche Botschaft. Jede Zeile der Sprecherfigur trägt beide Ebenen.
 *
 * Defensiv: ohne Angaben entsteht ein vollständiger, generischer Dialog.
 */
export function synthesizeDoubleEntendre(
  options?: DoubleEntendreOptions | null,
): LayeredDialogue {
  const topic = normalizeTopic(options?.topic);
  const intent = normalizeIntent(options?.intent);
  const speaker = normalizeText(options?.speaker, 'Die Gräfin');
  const listener = normalizeText(options?.listener, 'der Botschafter');
  const secret = typeof options?.secret === 'string' ? options.secret.trim() : '';
  const turns = normalizeTurns(options?.turns);

  const rand = createSeededRandom(
    hashString(`${topic}#${intent}#${speaker}#${listener}#${secret}#${turns}`),
  );

  const surfacePool = SURFACE_LINES[topic];
  const subtextPool = SUBTEXT_LINES[intent];
  const usedSurface = new Set<string>();

  const lines: LayeredLine[] = [];

  for (let i = 0; i < turns; i++) {
    // Reihum: Trägerfigur und Gesprächspartner.
    const isCarrier = i % 2 === 0;
    const lineSpeaker = isCarrier ? speaker : listener;

    let surface = pick(surfacePool, rand);
    let guard = 0;
    while (usedSurface.has(surface) && guard < surfacePool.length * 2) {
      guard++;
      surface = pick(surfacePool, rand);
    }
    usedSurface.add(surface);

    // Subtext nur bei der Trägerfigur — sie führt das eigentliche Gespräch.
    const subtext = isCarrier
      ? (secret || pick(subtextPool, rand)).replace(/\{who\}/g, listener)
      : 'Höfliche Erwiderung ohne verborgene Absicht';

    const stageDirection = rand() < 0.7 ? pick(STAGE_DIRECTIONS, rand) : undefined;

    lines.push({
      index: i + 1,
      speaker: lineSpeaker,
      surface,
      subtext,
      stageDirection,
    });
  }

  const surfaceText = lines
    .map((l) => `${l.speaker.toUpperCase()}: „${l.surface}."`)
    .join('\n\n');

  const decipheredText = lines
    .map((l) => {
      const head = `${l.speaker.toUpperCase()}: „${l.surface}."`;
      const dir = l.stageDirection ? `\n(${l.stageDirection}.)` : '';
      return `${head}${dir}\n▸ Gemeint: ${l.subtext}`;
    })
    .join('\n\n');

  return {
    lines,
    surfaceText,
    decipheredText,
    topic,
    topicLabel: TOPIC_LABELS[topic],
    intent,
    intentLabel: INTENT_LABELS[intent],
    lineCount: lines.length,
  };
}

// ---------------------------------------------------------------------------
// 2) Dechiffrierung
// ---------------------------------------------------------------------------

/**
 * Entschlüsselt die wahre Absicht einer Dialogzeile.
 *
 * Sucht nach Signalwörtern bekannter Absichts-Typen. Defensiv: Zeilen ohne
 * Signale liefern `intent: null`.
 */
export function decipherLine(line: unknown): DecipheredLine {
  const text = typeof line === 'string' ? line.trim() : '';
  if (!text) {
    return { surface: '', meaning: 'Keine Zeile übergeben', intent: null, signals: [] };
  }

  const lower = text.toLowerCase();
  const all: HiddenIntent[] = ['accusation', 'threat', 'blackmail', 'warning', 'alliance-offer'];

  let best: { intent: HiddenIntent; signals: string[] } | null = null;
  for (const intent of all) {
    const signals = INTENT_SIGNALS[intent].filter((s) => lower.includes(s));
    if (signals.length > 0 && (!best || signals.length > best.signals.length)) {
      best = { intent, signals };
    }
  }

  if (!best) {
    return { surface: text, meaning: 'Harmlose Oberfläche', intent: null, signals: [] };
  }

  return {
    surface: text,
    meaning: `Verborgene Absicht: ${INTENT_LABELS[best.intent]}`,
    intent: best.intent,
    signals: best.signals,
  };
}

// ---------------------------------------------------------------------------
// 3) Doppelbödigkeits-Analyse
// ---------------------------------------------------------------------------

/**
 * Bewertet die Doppelbödigkeit eines Dialogs.
 *
 * `sufficientlyLayered` ist true, sobald mindestens die Hälfte der Beiträge
 * einen echten Subtext trägt. Defensiv: leere Dialoge liefern Nullwerte.
 */
export function analyzeLayering(
  dialogue: LayeredDialogue | null | undefined,
): LayeringAnalysis {
  if (!dialogue || !Array.isArray(dialogue.lines) || dialogue.lines.length === 0) {
    return {
      layeringRate: 0,
      averageSurfaceLength: 0,
      stageDirectionCount: 0,
      sufficientlyLayered: false,
    };
  }

  // Ein Beitrag ist „doppelbödig", wenn der Subtext nicht die generische
  // Erwiderung ist.
  const layered = dialogue.lines.filter(
    (l) => l.subtext !== 'Höfliche Erwiderung ohne verborgene Absicht',
  ).length;

  const layeringRate = round4(layered / dialogue.lines.length);

  const totalWords = dialogue.lines.reduce((s, l) => s + countWords(l.surface), 0);
  const averageSurfaceLength = round4(totalWords / dialogue.lines.length);

  const stageDirectionCount = dialogue.lines.filter((l) => l.stageDirection !== undefined).length;

  return {
    layeringRate,
    averageSurfaceLength,
    stageDirectionCount,
    sufficientlyLayered: layeringRate >= 0.5,
  };
}

// ---------------------------------------------------------------------------
// 4) Formatierung
// ---------------------------------------------------------------------------

/** Formatiert die Oberfläche als reinen Dialog. */
export function formatSurfaceOnly(dialogue: LayeredDialogue | null | undefined): string {
  if (!dialogue || typeof dialogue.surfaceText !== 'string') return '';
  return dialogue.surfaceText;
}

/** Formatiert den entschlüsselten Dialog. */
export function formatDeciphered(dialogue: LayeredDialogue | null | undefined): string {
  if (!dialogue || typeof dialogue.decipheredText !== 'string') return '';
  return dialogue.decipheredText;
}
