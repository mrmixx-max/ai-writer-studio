// „Was-wäre-wenn?"-Szenarien- & Kaskaden-Planer (WP 62.2)
//
// Simuliert die Domino-Effekte einer alternativen Entscheidung über die
// Folgekapitel und stellt die alternative Zeitlinie der Kanon-Timeline
// gegenüber.
//
// Drei deterministische Werkzeuge:
//
//   1. planWhatIfScenario — Divergenz-Punkt → Kaskade + alternative Szene
//   2. compareTimelines   — Kanon vs. Alternative (Diff)
//   3. analyzeCascade     — Schwere und Reichweite der Kaskade bewerten
//
// Design-Regeln (analog chapterSceneSynthesizer / plotTwistSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Art eines Kaskaden-Effekts. */
export type CascadeEffect =
  | 'alliance-broken'
  | 'death-prevented'
  | 'death-caused'
  | 'subplot-stranded'
  | 'motivation-shifted';

/** Eingabe für den Szenarien-Planer. */
export interface WhatIfInput {
  /** Divergenz-Punkt: die geänderte Entscheidung/Wendung. */
  divergence?: string;
  /** Kapitel, in dem die Abweichung einsetzt. */
  chapter?: number;
  /** Gesamtkapitel des Manuskripts. Default: 20. */
  totalChapters?: number;
  /** Betroffene Figuren. */
  characters?: string[];
}

/** Ein einzelner Kaskaden-Effekt. */
export interface CascadeStep {
  /** Art des Effekts. */
  effect: CascadeEffect;
  /** Menschenlesbarer Name. */
  effectLabel: string;
  /** Beschreibung. */
  description: string;
  /** Kapitel, in dem der Effekt sichtbar wird. */
  chapter: number;
  /** Schwere 0–1. */
  severity: number;
}

/** Ergebnis der Szenarien-Planung. */
export interface WhatIfScenario {
  /** Der Divergenz-Punkt. */
  divergence: string;
  /** Kapitel der Abweichung. */
  chapter: number;
  /** Die Kaskade in Kapitel-Reihenfolge. */
  cascade: CascadeStep[];
  /** Die alternative Schlüsselszene. */
  alternativeScene: string;
  /** Anzahl betroffener Folgekapitel. */
  affectedChapters: number;
  /** Gesamtschwere 0–1. */
  totalSeverity: number;
  /** Wortzahl der alternativen Szene. */
  wordCount: number;
}

/** Ein Diff-Eintrag zwischen den Zeitlinien. */
export interface TimelineDiff {
  /** Kapitel. */
  chapter: number;
  /** Was im Kanon geschieht. */
  canon: string;
  /** Was in der Alternative geschieht. */
  alternative: string;
  /** true, wenn sich dieses Kapitel unterscheidet. */
  changed: boolean;
}

/** Ergebnis des Zeitlinien-Vergleichs. */
export interface TimelineComparison {
  /** Die Diff-Einträge. */
  diffs: TimelineDiff[];
  /** Anzahl abweichender Kapitel. */
  changedCount: number;
  /** Divergenz-Rate 0–1. */
  divergenceRate: number;
  /** Kapitel, ab dem die Zeitlinien auseinanderlaufen. */
  divergencePoint: number;
}

/** Ergebnis der Kaskaden-Analyse. */
export interface CascadeAnalysis {
  /** Schwere 0–1. */
  severity: number;
  /** Reichweite: Anteil der betroffenen Kapitel. */
  reach: number;
  /** true, wenn die Kaskade das Finale erreicht. */
  reachesFinale: boolean;
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
// Effekt-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Effekt-Namen. */
export const EFFECT_LABELS: Record<CascadeEffect, string> = {
  'alliance-broken': 'Allianz zerbricht',
  'death-prevented': 'Tod verhindert',
  'death-caused': 'Neuer Tod',
  'subplot-stranded': 'Subplot läuft ins Leere',
  'motivation-shifted': 'Motivation verschiebt sich',
};

/** Beschreibungs-Vorlagen je Effekt. {who} wird ersetzt. */
const EFFECT_TEMPLATES: Record<CascadeEffect, readonly string[]> = {
  'alliance-broken': [
    '{who} misstraut der Gruppe und zieht sich zurück',
    'Das Bündnis mit {who} hält nicht bis zum Finale',
    'Der gemeinsame Plan wird ohne {who} neu verhandelt',
  ],
  'death-prevented': [
    '{who} überlebt, weil der Auslöser nie eintrat',
    'Der Anschlag auf {who} findet nie statt',
    '{who} ist im Finale noch am Leben',
  ],
  'death-caused': [
    '{who} stirbt, weil die Rettung ausblieb',
    'Der Tod von {who} wird vorverlegt',
    '{who} opfert sich an einer früheren Stelle',
  ],
  'subplot-stranded': [
    'Der Subplot um {who} endet ohne Auflösung',
    'Die offene Frage zu {who} wird nie beantwortet',
    'Der Handlungsstrang um {who} verliert sein Ziel',
  ],
  'motivation-shifted': [
    '{who} kämpft im Finale aus einem anderen Grund',
    'Das Motiv von {who} kippt von Rache zu Schuld',
    '{who} will nicht mehr gewinnen, sondern nur überleben',
  ],
};

/** Alternative Szenen-Bausteine. */
const SCENE_TEMPLATES: readonly string[] = [
  'Und dann tat {who} das, was im Kanon nie geschah',
  'Der Moment kam, und {who} entschied anders als geplant',
  'An dieser Stelle bog die Geschichte ab, und {who} folgte ihr',
];

/** Empfehlungs-Bausteine. */
const HIGH_SEVERITY_HINT =
  'Hohe Kaskade: Diese Änderung schreibt den dritten Akt neu — vorher plotten.';
const MEDIUM_SEVERITY_HINT =
  'Mittlere Kaskade: Zwei bis drei Kapitel brauchen Anpassung.';
const LOW_SEVERITY_HINT =
  'Geringe Kaskade: Die Änderung bleibt lokal — sicher auszuprobieren.';

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Text defensiv normalisieren. */
function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Kapitelzahl begrenzen. */
function clampChapter(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.round(value)));
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
// 1) Szenarien-Planung
// ---------------------------------------------------------------------------

/**
 * Plant ein Was-wäre-wenn-Szenario.
 *
 * Ab dem Divergenz-Punkt werden deterministisch Kaskaden-Effekte über die
 * Folgekapitel verteilt: zerbrechende Allianzen, verhinderte oder neue Tode,
 * ins Leere laufende Subplots. Die Effekte werden mit jedem Kapitel schwerer.
 *
 * Defensiv: ohne Divergenz entsteht dennoch ein vollständiges Szenario.
 */
export function planWhatIfScenario(input?: WhatIfInput | null): WhatIfScenario {
  const divergence = normalizeText(input?.divergence);
  const totalChapters = clampChapter(input?.totalChapters, 20, 200);
  const chapter = clampChapter(input?.chapter, Math.max(1, Math.round(totalChapters / 4)), totalChapters);

  const characters =
    Array.isArray(input?.characters) && input!.characters!.length > 0
      ? input!.characters!.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : ['der Mentor', 'die Heldin'];

  const rand = createSeededRandom(
    hashString(`${divergence}#${chapter}#${totalChapters}#${characters.join(',')}`),
  );

  const effects: CascadeEffect[] = [
    'alliance-broken',
    'death-prevented',
    'death-caused',
    'subplot-stranded',
    'motivation-shifted',
  ];

  // Eine Divergenz betrifft ALLE folgenden Kapitel — das ist die Natur einer
  // Kaskade. Für die Lesbarkeit wird die Liste auf 20 Schritte begrenzt und
  // gleichmäßig über die Restlänge verteilt.
  const remaining = Math.max(1, totalChapters - chapter);
  const MAX_STEPS = 20;
  const stepCount = Math.min(remaining, MAX_STEPS);

  const cascade: CascadeStep[] = [];
  for (let i = 0; i < stepCount; i++) {
    const offset =
      remaining <= MAX_STEPS
        ? i + 1
        : Math.max(1, Math.round(((i + 1) / stepCount) * remaining));

    const effect = effects[i % effects.length];
    const who = pick(characters, rand);
    const template = pick(EFFECT_TEMPLATES[effect], rand);
    // Effekte werden mit der Zeit schwerer.
    const severity = round4(Math.min(1, 0.35 + (i / Math.max(1, stepCount - 1)) * 0.6));

    cascade.push({
      effect,
      effectLabel: EFFECT_LABELS[effect],
      description: ensurePeriod(template.replace(/\{who\}/g, who)),
      chapter: Math.min(totalChapters, chapter + offset),
      severity,
    });
  }

  const totalSeverity = round4(
    cascade.reduce((s, c) => s + c.severity, 0) / cascade.length,
  );

  // Alternative Schlüsselszene.
  const who = characters[0] ?? 'die Figur';
  const alternativeScene = [
    ensurePeriod(divergence ? `Was wäre, wenn: ${divergence}` : 'Was wäre, wenn alles anders käme'),
    ensurePeriod(pick(SCENE_TEMPLATES, rand).replace(/\{who\}/g, who)),
    ensurePeriod(cascade[0]?.description ?? 'Die Folgen wären sofort spürbar'),
  ].join(' ');

  return {
    divergence,
    chapter,
    cascade,
    alternativeScene,
    affectedChapters: cascade.length,
    totalSeverity,
    wordCount: countWords(alternativeScene),
  };
}

// ---------------------------------------------------------------------------
// 2) Zeitlinien-Vergleich
// ---------------------------------------------------------------------------

/**
 * Vergleicht die Kanon-Timeline mit der alternativen.
 *
 * Ab dem Divergenz-Punkt gelten alle Kapitel als verändert; davor bleiben sie
 * identisch. Defensiv: ungültige Szenarien liefern einen leeren Vergleich.
 */
export function compareTimelines(
  scenario: WhatIfScenario | null | undefined,
  totalChapters?: number,
): TimelineComparison {
  const empty: TimelineComparison = {
    diffs: [],
    changedCount: 0,
    divergenceRate: 0,
    divergencePoint: 0,
  };

  if (!scenario || typeof scenario !== 'object' || !Array.isArray(scenario.cascade)) {
    return empty;
  }

  const total = clampChapter(totalChapters, 20, 200);
  const point = clampChapter(scenario.chapter, 1, total);

  const diffs: TimelineDiff[] = [];
  for (let ch = 1; ch <= total; ch++) {
    const changed = ch > point;
    const step = scenario.cascade.find((c) => c.chapter === ch);

    diffs.push({
      chapter: ch,
      canon: changed ? 'Wie geplant' : 'Unverändert',
      alternative: changed
        ? step?.description ?? 'Folgen der Abweichung'
        : 'Unverändert',
      changed,
    });
  }

  const changedCount = diffs.filter((d) => d.changed).length;

  return {
    diffs,
    changedCount,
    divergenceRate: round4(changedCount / Math.max(1, diffs.length)),
    divergencePoint: point,
  };
}

// ---------------------------------------------------------------------------
// 3) Kaskaden-Analyse
// ---------------------------------------------------------------------------

/**
 * Bewertet Schwere und Reichweite einer Kaskade.
 *
 * `reachesFinale` ist true, wenn mindestens ein Effekt im letzten Drittel
 * liegt — dann muss der Autor den dritten Akt neu planen.
 *
 * Defensiv: ungültige Szenarien liefern Nullwerte.
 */
export function analyzeCascade(
  scenario: WhatIfScenario | null | undefined,
  totalChapters?: number,
): CascadeAnalysis {
  if (!scenario || !Array.isArray(scenario.cascade) || scenario.cascade.length === 0) {
    return {
      severity: 0,
      reach: 0,
      reachesFinale: false,
      recommendation: 'Kein Szenario übergeben.',
    };
  }

  const total = clampChapter(totalChapters, 20, 200);
  const severity = round4(
    scenario.cascade.reduce((s, c) => s + c.severity, 0) / scenario.cascade.length,
  );

  const reach = round4(scenario.cascade.length / Math.max(1, total));

  // Eine Kaskade „erreicht das Finale", wenn sie mehrere Stufen hat UND bis in
  // das letzte Drittel reicht. Ein einzelner Effekt kurz vor Schluss bleibt
  // lokal — er schreibt den dritten Akt nicht neu.
  const finaleThreshold = total * (2 / 3);
  const lastChapter = Math.max(...scenario.cascade.map((c) => c.chapter));
  const reachesFinale = scenario.cascade.length >= 3 && lastChapter > finaleThreshold;

  let recommendation: string;
  if (severity >= 0.7 || reachesFinale) {
    recommendation = HIGH_SEVERITY_HINT;
  } else if (severity >= 0.45) {
    recommendation = MEDIUM_SEVERITY_HINT;
  } else {
    recommendation = LOW_SEVERITY_HINT;
  }

  return { severity, reach, reachesFinale, recommendation };
}

// ---------------------------------------------------------------------------
// 4) Formatierung
// ---------------------------------------------------------------------------

/** Formatiert die Kaskade als lesbaren Bericht. */
export function formatCascadeReport(scenario: WhatIfScenario | null | undefined): string {
  if (!scenario || !Array.isArray(scenario.cascade) || scenario.cascade.length === 0) return '';

  const lines = scenario.cascade.map(
    (c) => `Kapitel ${c.chapter} [${c.effectLabel}]: ${c.description}`,
  );

  return [
    `Divergenz-Punkt: Kapitel ${scenario.chapter}`,
    scenario.divergence ? `Was wäre, wenn: ${scenario.divergence}` : 'Was wäre, wenn',
    '',
    ...lines,
  ].join('\n');
}
