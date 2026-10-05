// Sensorischer Flashback-Weaver (WP 58.2)
//
// Rückblenden, die nicht hölzern wirken: ein Sinnesreiz in der Gegenwart
// gleitet in die Erinnerung und schnappt abrupt in die akute Gefahr zurück.
//
// Drei deterministische Werkzeuge:
//
//   1. weaveFlashback    — Trigger + Erinnerung → Drei-Phasen-Übergang
//   2. detectFlashbackTriggers — Sinnesreize in einem Text finden
//   3. analyzeFlashbackFlow    — Übergangsqualität messen (Gleiten/Snap-Back)
//
// Design-Regeln (analog proseExpander / internalMonologueGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Sinneskanal des Triggers. */
export type TriggerSense = 'auditory' | 'smell' | 'taste' | 'touch';

/** Phase des Flashbacks. */
export type FlashbackPhase = 'slip' | 'memory' | 'snapback';

/** Optionen für den Flashback-Weaver. */
export interface FlashbackOptions {
  /** Sinneskanal des Triggers. Default: 'smell'. */
  sense?: TriggerSense;
  /** Die Figur, die sich erinnert. */
  character?: string;
  /** Konkreter Sinnesreiz (z. B. „Kirchenglocke"). */
  trigger?: string;
  /** Inhalt der Erinnerung. */
  memory?: string;
  /** Akute Gefahr in der Gegenwart (für den Snap-Back). */
  presentDanger?: string;
  /** Wie alt die Figur in der Erinnerung war. */
  memoryAge?: string;
}

/** Ein Abschnitt des Flashbacks. */
export interface FlashbackSegment {
  /** Phase. */
  phase: FlashbackPhase;
  /** Menschenlesbarer Phasenname. */
  label: string;
  /** Der Text dieses Abschnitts. */
  text: string;
}

/** Ergebnis der Flashback-Erzeugung. */
export interface Flashback {
  /** Alle drei Abschnitte in Reihenfolge. */
  segments: FlashbackSegment[];
  /** Der vollständige Text. */
  text: string;
  /** Verwendeter Sinneskanal. */
  sense: TriggerSense;
  /** Der Sinnesreiz. */
  trigger: string;
  /** Wortzahl. */
  wordCount: number;
  /** true, wenn ein Snap-Back in akute Gefahr erfolgt. */
  hasSnapBack: boolean;
}

/** Ein im Text gefundener Sinnesreiz. */
export interface TriggerFinding {
  /** Der gefundene Satz. */
  sentence: string;
  /** Erkannter Kanal. */
  sense: TriggerSense;
  /** Auslösende Signalwörter. */
  signals: string[];
}

/** Ergebnis der Trigger-Erkennung. */
export interface TriggerScan {
  /** Gefundene Reize. */
  findings: TriggerFinding[];
  /** Verteilung über die Kanäle. */
  senseCounts: Record<TriggerSense, number>;
  /** Gesamtzahl. */
  total: number;
}

/** Ergebnis der Übergangsanalyse. */
export interface FlashbackFlow {
  /** Qualität des Gleitens 0–1 (weich = gut). */
  slipQuality: number;
  /** Qualität des Snap-Backs 0–1 (abrupt = gut). */
  snapQuality: number;
  /** Gesamtqualität 0–1. */
  quality: number;
  /** Gefundene Übergangsmarker. */
  markers: string[];
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
// Kanal-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Kanal-Namen. */
export const SENSE_LABELS: Record<TriggerSense, string> = {
  auditory: 'Auditiv (Klang)',
  smell: 'Olfaktorisch (Geruch)',
  taste: 'Gustatorisch (Geschmack)',
  touch: 'Haptisch (Berührung)',
};

/** Menschenlesbare Phasen-Namen. */
export const PHASE_LABELS: Record<FlashbackPhase, string> = {
  slip: 'Gleiten (Slip-Stream)',
  memory: 'Vergangenheitsszene',
  snapback: 'Snap-Back',
};

/** Standard-Trigger je Kanal. */
const DEFAULT_TRIGGERS: Record<TriggerSense, string> = {
  auditory: 'eine Kirchenglocke, die zweimal schlug',
  smell: 'der Geruch von verbranntem Lavendel',
  taste: 'der bittere Nachgeschmack von Tee',
  touch: 'ein Sprung im Porzellan unter dem Daumen',
};

/** Gleiten-Vorlagen (Gegenwart verblasst über den Sinnesanker). */
const SLIP_TEMPLATES: Record<TriggerSense, readonly string[]> = {
  auditory: [
    'Der Klang traf sie ohne Vorwarnung, und für einen Moment war der Raum nicht mehr der Raum',
    'Der Ton hing in der Luft, und mit ihm kam etwas, das lange verschlossen war',
    'Zwei Schläge nur, und die Gegenwart begann zu verblassen wie altes Papier',
  ],
  smell: [
    'Der Geruch stieg auf, und mit ihm öffnete sich eine Tür, die sie längst zugemauert glaubte',
    'Es roch plötzlich nach damals, und die Jahre dazwischen verloren ihren Halt',
    'Der Duft war nur eine Sekunde da, aber er genügte, um alles zu verschieben',
  ],
  taste: [
    'Der Geschmack kam unerwartet, und die Zunge erinnerte sich schneller als der Verstand',
    'Bitter, und mit dem Bitteren kam ein ganzer Sommer zurück',
    'Ein Schluck, und die Zeit knickte in der Mitte ein',
  ],
  touch: [
    'Die Kante schnitt in den Daumen, und der Schmerz war der Schlüssel',
    'Unter der Fingerkuppe brach etwas, und mit ihm eine Mauer',
    'Die Berührung war kalt und vertraut, und das Vertraute war das Schlimmste',
  ],
};

/** Erinnerungs-Details (sinnlich, konkret). */
const MEMORY_DETAILS: readonly string[] = [
  'Die Hände der Mutter rochen nach Seife und Kohle',
  'Ein Radio spielte etwas, das niemand zu Ende hörte',
  'Draußen fuhr ein Wagen vorbei und wurde nie wieder gehört',
  'Der Kuchen war verbrannt und niemand sagte es',
  'Ein Vogel schlug gegen die Scheibe und flog weiter',
];

/** Snap-Back-Vorlagen (abrupter Ruck in die Gegenwart). */
const SNAPBACK_TEMPLATES: readonly string[] = [
  'Dann der Schlag',
  'Ein Geräusch riss alles entzwei',
  'Und dann war da Blut',
  'Der Schuss kam, bevor der Gedanke fertig war',
  'Jemand schrie ihren Namen, und es war nicht der von damals',
];

/** Snap-Back-Zusätze (emotionale Erschütterung). */
const SNAPBACK_AFTERMATH: readonly string[] = [
  'Sie war wieder da, und alles tat gleichzeitig weh',
  'Die Erinnerung fiel von ihr ab wie nasser Stoff',
  'Der Boden war wieder der Boden, und das half nicht',
  'Die Gegenwart war lauter, kälter und dringlicher als jede Erinnerung',
];

/** Signalwörter je Kanal (für die Erkennung). */
const SENSE_SIGNALS: Record<TriggerSense, readonly string[]> = {
  auditory: ['glocke', 'klang', 'ton', 'läutete', 'pfiff', 'schlug', 'hörte', 'geräusch', 'lied'],
  smell: ['geruch', 'roch', 'duft', 'rauch', 'lavendel', 'dunst', 'stank', 'atem der luft'],
  taste: ['geschmack', 'schmeckte', 'bitter', 'süß', 'salzig', 'zunge', 'schluck', 'tee'],
  touch: ['berührte', 'kalt', 'warm', 'schnitt', 'sprung', 'porzellan', 'haut', 'fingerkuppe', 'griff'],
};

/** Übergangsmarker für das Gleiten. */
const SLIP_MARKERS: readonly string[] = [
  'verblasste', 'verlor', 'öffnete', 'verschoben', 'damals', 'zurück',
  'erinnerte', 'kam', 'stieg', 'begann',
];

/** Übergangsmarker für den Snap-Back. */
const SNAP_MARKERS: readonly string[] = [
  'dann', 'plötzlich', 'riss', 'schlag', 'schuss', 'schrie', 'knall', 'auf einmal',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Kanal defensiv prüfen. */
function normalizeSense(value: unknown): TriggerSense {
  const all: TriggerSense[] = ['auditory', 'smell', 'taste', 'touch'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as TriggerSense)
    : 'smell';
}

/** Text defensiv normalisieren. */
function normalizeText(value: unknown): string {
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

/** Sätze zerlegen. */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]*/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// 1) Flashback-Weaver
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen Drei-Phasen-Flashback.
 *
 *   1. **Gleiten** — die Gegenwart verblasst über den Sinnesanker,
 *   2. **Vergangenheit** — lebendige Erinnerung im jüngeren Tonfall,
 *   3. **Snap-Back** — abrupter Ruck zurück in die akute Gefahr.
 *
 * Defensiv: ohne Angaben entsteht ein vollständiger, generischer Flashback.
 */
export function weaveFlashback(options?: FlashbackOptions | null): Flashback {
  const sense = normalizeSense(options?.sense);
  const character = normalizeText(options?.character) || 'Sie';
  const trigger = normalizeText(options?.trigger) || DEFAULT_TRIGGERS[sense];
  const memory = normalizeText(options?.memory);
  const danger = normalizeText(options?.presentDanger);
  const memoryAge = normalizeText(options?.memoryAge);

  const rand = createSeededRandom(hashString(`${sense}#${character}#${trigger}#${memory}#${danger}`));

  const segments: FlashbackSegment[] = [];

  // Phase 1: Gleiten.
  const slipParts: string[] = [ensurePeriod(pick(SLIP_TEMPLATES[sense], rand))];
  slipParts.push(ensurePeriod(`Es war ${trigger}`));
  segments.push({
    phase: 'slip',
    label: PHASE_LABELS.slip,
    text: slipParts.join(' '),
  });

  // Phase 2: Erinnerung.
  const memoryParts: string[] = [];
  // Die Figur immer nennen — eine Erinnerung ohne Subjekt wirkt ortlos.
  memoryParts.push(
    ensurePeriod(
      memoryAge
        ? `Damals war ${character} ${memoryAge}`
        : `${character} war damals jünger, und alles war größer`,
    ),
  );
  if (memory) {
    memoryParts.push(ensurePeriod(memory));
  } else {
    memoryParts.push(ensurePeriod(pick(MEMORY_DETAILS, rand)));
  }
  memoryParts.push(ensurePeriod(pick(MEMORY_DETAILS, rand)));
  segments.push({
    phase: 'memory',
    label: PHASE_LABELS.memory,
    text: memoryParts.join(' '),
  });

  // Phase 3: Snap-Back.
  const snapParts: string[] = [ensurePeriod(pick(SNAPBACK_TEMPLATES, rand))];
  if (danger) {
    snapParts.push(ensurePeriod(danger));
  }
  snapParts.push(ensurePeriod(pick(SNAPBACK_AFTERMATH, rand)));
  segments.push({
    phase: 'snapback',
    label: PHASE_LABELS.snapback,
    text: snapParts.join(' '),
  });

  const text = segments.map((s) => s.text).join('\n\n');

  return {
    segments,
    text,
    sense,
    trigger,
    wordCount: countWords(text),
    hasSnapBack: snapParts.length > 0,
  };
}

// ---------------------------------------------------------------------------
// 2) Trigger-Erkennung
// ---------------------------------------------------------------------------

/**
 * Findet sensorische Trigger in einem Text.
 *
 * Jeder Satz wird dem Kanal mit den meisten Treffern zugeordnet; bei
 * Gleichstand gewinnt die feste Reihenfolge (auditiv vor olfaktorisch …).
 *
 * Defensiv: leerer/ungültiger Text liefert ein leeres Ergebnis.
 */
export function detectFlashbackTriggers(text: unknown): TriggerScan {
  const empty: TriggerScan = {
    findings: [],
    senseCounts: { auditory: 0, smell: 0, taste: 0, touch: 0 },
    total: 0,
  };

  if (typeof text !== 'string' || text.trim().length === 0) return empty;

  const sentences = splitSentences(text);
  const findings: TriggerFinding[] = [];
  const senseCounts: Record<TriggerSense, number> = { auditory: 0, smell: 0, taste: 0, touch: 0 };
  const order: TriggerSense[] = ['auditory', 'smell', 'taste', 'touch'];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    let best: { sense: TriggerSense; signals: string[] } | null = null;

    for (const sense of order) {
      const signals = SENSE_SIGNALS[sense].filter((s) => lower.includes(s));
      if (signals.length > 0 && (!best || signals.length > best.signals.length)) {
        best = { sense, signals };
      }
    }

    if (best) {
      findings.push({ sentence, sense: best.sense, signals: best.signals });
      senseCounts[best.sense]++;
    }
  }

  return { findings, senseCounts, total: findings.length };
}

// ---------------------------------------------------------------------------
// 3) Übergangsanalyse
// ---------------------------------------------------------------------------

/**
 * Bewertet die Qualität eines Flashback-Übergangs.
 *
 * Ein guter Flashback **gleitet weich** hinein (Slip-Marker, geringe
 * Satz-Wucht) und **schnappt hart** zurück (Snap-Marker, kurze Sätze).
 *
 * Defensiv: leerer Text liefert Qualität 0.
 */
export function analyzeFlashbackFlow(text: unknown): FlashbackFlow {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { slipQuality: 0, snapQuality: 0, quality: 0, markers: [] };
  }

  const lower = text.toLowerCase();
  const sentences = splitSentences(text);
  const lengths = sentences.map(countWords);
  const avgLength = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;

  const slipHits = SLIP_MARKERS.filter((m) => lower.includes(m));
  const snapHits = SNAP_MARKERS.filter((m) => lower.includes(m));

  // Gleiten: Marker vorhanden und Satzbau eher lang/fließend.
  const slipQuality = Math.round(Math.min(1, slipHits.length * 0.2 + (avgLength > 8 ? 0.3 : 0.1)) * 10000) / 10000;

  // Snap-Back: Marker vorhanden und mindestens ein kurzer Satz.
  const shortCount = lengths.filter((l) => l < 6).length;
  const snapQuality = Math.round(Math.min(1, snapHits.length * 0.2 + (shortCount > 0 ? 0.4 : 0)) * 10000) / 10000;

  const quality = Math.round(((slipQuality + snapQuality) / 2) * 10000) / 10000;

  return {
    slipQuality,
    snapQuality,
    quality,
    markers: [...slipHits, ...snapHits],
  };
}
