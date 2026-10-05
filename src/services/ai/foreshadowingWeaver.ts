// Foreshadowing-Weaver & Tschechows Gewehr (WP 56.1)
//
// Legt unauffällige Hinweise auf eine spätere Enthüllung (Twist) in
// bestehende Szenen — in drei Subtilitätsstufen, damit der Twist im Finale
// rückblickend überzeugt statt aufgesetzt zu wirken.
//
// Drei deterministische Werkzeuge:
//
//   1. mapTwistToClues   — Twist → Hinweis-Plan über alle Stufen
//   2. injectForeshadowing — Hinweis-Sätze in eine Szene einweben
//   3. auditForeshadowing — vorhandene Hinweise finden und bewerten
//
// Design-Regeln (analog proseExpander / literaryToneShifter):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Subtilitätsstufe eines Hinweises. */
export type SubtletyLevel = 1 | 2 | 3;

/** Eine geplante Hinweis-Pflanzung. */
export interface Clue {
  /** Stabile ID. */
  id: string;
  /** Subtilitätsstufe (1 = kaum merklich, 3 = ominöse Ahnung). */
  level: SubtletyLevel;
  /** Menschenlesbare Stufe. */
  levelLabel: string;
  /** Der Hinweis-Text, einpassbar in Prosa. */
  text: string;
  /** Erkenntnis-Kategorie des Hinweises. */
  category: 'sensory' | 'object' | 'dialogue';
  /** Empfohlenes Kapitel (je später desto näher am Twist). */
  suggestedChapter: number;
}

/** Ergebnis der Twist-zu-Hinweis-Abbildung. */
export interface CluePlan {
  /** Der analysierte Twist. */
  twist: string;
  /** Erkannte Schlüsselbegriffe des Twists. */
  keywords: string[];
  /** Geplante Hinweise, aufsteigend nach Stufe. */
  clues: Clue[];
  /** Empfohlene Gesamtzahl. */
  totalClues: number;
  /** Gesamtkapitel-Annahme. */
  totalChapters: number;
}

/** Optionen für die Prosa-Injektion. */
export interface InjectionOptions {
  /** Zielkapitel (steuert die Hinweis-Auswahl). */
  chapter?: number;
  /** Anzahl einzuflechtender Hinweise (1–3). Default: 3. */
  count?: number;
  /** Gesamtkapitel des Manuskripts. Default: 20. */
  totalChapters?: number;
}

/** Ergebnis der Prosa-Injektion. */
export interface InjectedProse {
  /** Der erweiterte Szenentext. */
  text: string;
  /** Die eingeflochtenen Hinweise. */
  inserted: Clue[];
  /** Anzahl der Einflechtungen. */
  insertedCount: number;
  /** Einfügepositionen als Satzindizes (0-basiert). */
  positions: number[];
}

/** Ein im Text gefundener Hinweis. */
export interface ForeshadowingFinding {
  /** Der gefundene Satz. */
  sentence: string;
  /** Zugeordnete Stufe. */
  level: SubtletyLevel;
  /** Auslösende Signalwörter. */
  signals: string[];
}

/** Ergebnis des Foreshadowing-Audits. */
export interface ForeshadowingAudit {
  /** Gefundene Hinweise. */
  findings: ForeshadowingFinding[];
  /** Verteilung über die Stufen. */
  levelCounts: Record<SubtletyLevel, number>;
  /** Gesamtzahl gefundener Hinweise. */
  total: number;
  /** Bewertung 0–1: wie gut sind alle drei Stufen abgedeckt? */
  coverage: number;
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
// Stufen-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Stufennamen. */
export const LEVEL_LABELS: Record<SubtletyLevel, string> = {
  1: 'Kaum merklich',
  2: 'Gegenstands-Verankerung',
  3: 'Ominöse Ahnung',
};

/** Signalwörter je Erkenntnis-Kategorie (für das Audit). */
const CATEGORY_SIGNALS: Record<Clue['category'], readonly string[]> = {
  sensory: ['geschmack', 'geruch', 'schmeckte', 'roch', 'bitter', 'süß', 'kalt', 'warm', 'flüchtig', 'kaum'],
  object: ['regal', 'mörser', 'fleck', 'ärmel', 'tisch', 'schublade', 'flasche', 'dose', 'kasten', 'werkzeug'],
  dialogue: ['sollte', 'vielleicht', 'gewiss', 'bald', 'ach', 'wer weiß', 'sicher', 'angeblich', 'man sagt'],
};

/** Stufen-Signalwörter (für das Audit). */
const LEVEL_SIGNALS: Record<SubtletyLevel, readonly string[]> = {
  1: ['kaum', 'flüchtig', 'beinahe', 'fast', 'unmerklich', 'leicht', 'schwach', 'kurz'],
  2: ['regal', 'mörser', 'fleck', 'ärmel', 'stand', 'lag', 'dose', 'flasche', 'zeug', 'gerät'],
  3: ['sollte', 'wer weiß', 'man sagt', 'vielleicht', 'bald', 'gewiss', 'angeblich', 'ahnen'],
};

// ---------------------------------------------------------------------------
// Bausteine für Hinweis-Texte
// ---------------------------------------------------------------------------

/** Sinnes-Bausteine (Stufe 1). */
const SENSORY_TEMPLATES: readonly string[] = [
  'Ein bitterer Nachgeschmack blieb auf der Zunge, kaum der Rede wert',
  'Der Wein schmeckte einen Hauch anders als sonst, und niemand erwähnte es',
  'Ein Geruch lag im Raum, den {subject} nicht einordnen konnte',
  'Für einen Moment war da etwas Kühles, Metallisches im Geschmack',
  'Ein Ziehen im Nacken, das sofort wieder verging',
];

/** Gegenstands-Bausteine (Stufe 2). */
const OBJECT_TEMPLATES: readonly string[] = [
  'Auf dem Regal stand ein {object}, den niemand mehr benutzte',
  'An einem Ärmel saß ein Fleck, den man für Wein hätte halten können',
  'Hinter der Tür lag ein {object}, achtlos abgelegt',
  'Ein Werkzeug lag auf dem Tisch, dessen Zweck {subject} nicht kannte',
  'In der Schublade klirrte etwas, als sie geschlossen wurde',
];

/** Dialog-Bausteine (Stufe 3). */
const DIALOGUE_TEMPLATES: readonly string[] = [
  '„Man sollte nie fragen, was in einem Trank steckt." Ein Lächeln, das zu lange hielt.',
  '„{subject} sieht blass aus. Das kommt und geht."',
  '„Bald ist es vorbei", sagte jemand, und meinte etwas anderes.',
  '„Wer weiß, was der Wein hier so alles weiß."',
  '„Ich mische nichts. Ich bewahre nur auf."',
];

/** Gegenstands-Namen für Stufe 2. */
const OBJECT_NOUNS: readonly string[] = ['Mörser', 'Kännchen', 'Fläschchen', 'Beutel', 'Kästchen'];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Twist defensiv normalisieren. */
function normalizeTwist(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Zählt auf sinnvollen Bereich begrenzen. */
function clampCount(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Schlüsselbegriffe eines Twists extrahieren: Inhaltswörter ab 4 Zeichen,
 * ohne Füllwörter.
 */
function extractKeywords(twist: string): string[] {
  if (!twist) return [];
  const STOPWORDS = new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'und', 'oder', 'aber', 'mit', 'von', 'für', 'auf', 'aus', 'bei', 'nach',
    'sich', 'wird', 'werden', 'hat', 'haben', 'ist', 'sind', 'war', 'waren',
    'langsam', 'später', 'dann', 'immer', 'mehr',
  ]);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of twist.split(/\s+/)) {
    const word = raw.replace(/[^A-Za-zÄÖÜäöüß]/g, '').toLowerCase();
    if (word.length < 4) continue;
    if (STOPWORDS.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    result.push(word);
  }
  return result.slice(0, 8);
}

/** Sätze eines Texts (Satzzeichen bleiben am Satz). */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]*/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Vorlage mit Subjekt/Gegenstand füllen. */
function fillTemplate(template: string, subject: string, objectNoun: string): string {
  const s = subject || 'die Figur';
  return template.replace(/\{subject\}/g, s).replace(/\{object\}/g, objectNoun);
}

/** Satzende sicherstellen. */
function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?»"]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// ---------------------------------------------------------------------------
// 1) Twist-zu-Hinweis-Abbildung
// ---------------------------------------------------------------------------

/**
 * Bildet eine spätere Enthüllung auf einen Hinweis-Plan ab.
 *
 * Erzeugt je Stufe mindestens einen Hinweis; die vorgeschlagenen Kapitel
 * liegen umso näher am Twist, je höher die Stufe ist (Stufe 1 früh, Stufe 3
 * kurz vor der Enthüllung). Die Texte greifen die Schlüsselbegriffe des
 * Twists auf, damit die Hinweise inhaltlich passen.
 *
 * Defensiv: ein leerer Twist liefert einen leeren Plan.
 */
export function mapTwistToClues(twist: unknown, totalChapters?: number): CluePlan {
  const text = normalizeTwist(twist);
  const chapters = clampCount(totalChapters, 20, 1, 200);

  if (!text) {
    return { twist: '', keywords: [], clues: [], totalClues: 0, totalChapters: chapters };
  }

  const keywords = extractKeywords(text);
  const rand = createSeededRandom(hashString(`${text}#${chapters}`));
  const subject = keywords[0] ? keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1) : '';

  // Kapitel-Fenster je Stufe: 1 früh, 2 mittig, 3 spät.
  const windows: Record<SubtletyLevel, [number, number]> = {
    1: [1, Math.max(1, Math.round(chapters * 0.35))],
    2: [
      Math.max(1, Math.round(chapters * 0.3)),
      Math.max(2, Math.round(chapters * 0.7)),
    ],
    3: [
      Math.max(1, Math.round(chapters * 0.6)),
      Math.max(1, chapters - 1),
    ],
  };

  const clues: Clue[] = [];
  const levels: SubtletyLevel[] = [1, 2, 3];

  for (const level of levels) {
    const [min, max] = windows[level];
    const suggestedChapter = min + Math.floor(rand() * Math.max(1, max - min + 1));

    const template =
      level === 1
        ? pick(SENSORY_TEMPLATES, rand)
        : level === 2
          ? pick(OBJECT_TEMPLATES, rand)
          : pick(DIALOGUE_TEMPLATES, rand);

    const objectNoun = pick(OBJECT_NOUNS, rand);

    clues.push({
      id: `clue-${level}`,
      level,
      levelLabel: LEVEL_LABELS[level],
      text: ensurePeriod(fillTemplate(template, subject, objectNoun)),
      category: level === 1 ? 'sensory' : level === 2 ? 'object' : 'dialogue',
      suggestedChapter: Math.min(chapters, Math.max(1, suggestedChapter)),
    });
  }

  return {
    twist: text,
    keywords,
    clues,
    totalClues: clues.length,
    totalChapters: chapters,
  };
}

// ---------------------------------------------------------------------------
// 2) Prosa-Injektion
// ---------------------------------------------------------------------------

/**
 * Webt Hinweis-Sätze nahtlos in eine bestehende Szene ein.
 *
 * Die Hinweise werden an Satzgrenzen eingefügt (nie mitten im Satz), verteilt
 * über den Text. Der Originaltext bleibt vollständig erhalten.
 *
 * Defensiv: leerer Szenentext liefert nur die Hinweise als eigenen Text.
 */
export function injectForeshadowing(
  scene: unknown,
  twist: unknown,
  options?: InjectionOptions,
): InjectedProse {
  const source = typeof scene === 'string' ? scene : '';
  const plan = mapTwistToClues(twist, options?.totalChapters);
  const count = clampCount(options?.count, 3, 1, 3);

  if (plan.clues.length === 0) {
    return { text: source, inserted: [], insertedCount: 0, positions: [] };
  }

  // Hinweise passend zum Zielkapitel auswählen (nächstgelegene Stufe zuerst).
  const chapter = clampCount(options?.chapter, Math.round(plan.totalChapters / 2), 1, plan.totalChapters);
  const ranked = [...plan.clues].sort(
    (a, b) => Math.abs(a.suggestedChapter - chapter) - Math.abs(b.suggestedChapter - chapter),
  );
  const selected = ranked.slice(0, count);

  const sentences = splitSentences(source);

  if (sentences.length === 0) {
    const only = selected.map((c) => c.text).join(' ');
    return {
      text: only,
      inserted: selected,
      insertedCount: selected.length,
      positions: selected.map((_, i) => i),
    };
  }

  // Einfügepositionen gleichmäßig über den Text verteilen (nie am Ende).
  const positions: number[] = [];
  const slots = Math.max(1, sentences.length);
  for (let i = 0; i < selected.length; i++) {
    const pos = Math.min(
      sentences.length,
      Math.max(1, Math.round(((i + 1) / (selected.length + 1)) * slots)),
    );
    positions.push(pos);
  }

  // Von hinten einfügen, damit Indizes stabil bleiben.
  const result = [...sentences];
  const inserted: Clue[] = [];
  const finalPositions: number[] = [];

  for (let i = selected.length - 1; i >= 0; i--) {
    const pos = positions[i];
    result.splice(pos, 0, selected[i].text);
    inserted.unshift(selected[i]);
    finalPositions.unshift(pos);
  }

  return {
    text: result.join(' '),
    inserted,
    insertedCount: inserted.length,
    positions: finalPositions,
  };
}

// ---------------------------------------------------------------------------
// 3) Foreshadowing-Audit
// ---------------------------------------------------------------------------

/**
 * Findet vorhandene Hinweise in einem Text und bewertet ihre Verteilung.
 *
 * `coverage` ist 1, wenn alle drei Stufen mindestens einmal vorkommen.
 * Defensiv: leerer Text liefert ein leeres Audit.
 */
export function auditForeshadowing(text: unknown): ForeshadowingAudit {
  const empty: ForeshadowingAudit = {
    findings: [],
    levelCounts: { 1: 0, 2: 0, 3: 0 },
    total: 0,
    coverage: 0,
  };

  if (typeof text !== 'string' || text.trim().length === 0) return empty;

  const sentences = splitSentences(text);
  const findings: ForeshadowingFinding[] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    // Höchste passende Stufe gewinnt (3 > 2 > 1).
    let matchedLevel: SubtletyLevel | null = null;
    let matchedSignals: string[] = [];

    for (const level of [3, 2, 1] as SubtletyLevel[]) {
      const signals = LEVEL_SIGNALS[level].filter((s) => lower.includes(s));
      if (signals.length > 0) {
        matchedLevel = level;
        matchedSignals = signals;
        break;
      }
    }

    if (matchedLevel !== null) {
      findings.push({ sentence, level: matchedLevel, signals: matchedSignals });
    }
  }

  const levelCounts: Record<SubtletyLevel, number> = { 1: 0, 2: 0, 3: 0 };
  for (const f of findings) levelCounts[f.level]++;

  const coveredLevels = ([1, 2, 3] as SubtletyLevel[]).filter((l) => levelCounts[l] > 0).length;
  const coverage = Math.round((coveredLevels / 3) * 10000) / 10000;

  return { findings, levelCounts, total: findings.length, coverage };
}

// ---------------------------------------------------------------------------
// 4) Signalwörter-Export (für UI-Hinweise)
// ---------------------------------------------------------------------------

/** Signalwörter einer Kategorie (für die UI-Anzeige). */
export function getCategorySignals(category: Clue['category']): readonly string[] {
  return CATEGORY_SIGNALS[category] ?? [];
}
