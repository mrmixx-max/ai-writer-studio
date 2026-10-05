// Figurenstimmen-Evolutions-Modulator (WP 64.2)
//
// Eine Figur darf in Kapitel 25 nicht mehr so sprechen wie in Kapitel 1.
// Nach Schlachten, Verrat oder Schicksalsschlägen verändern sich Sprechtempo,
// Wortschatz und Tonfall.
//
// Drei deterministische Werkzeuge:
//
//   1. evolveCharacterVoice — Trauma-Marken → Stimmen-Metamorphose
//   2. compareVoices        — Vorher/Nachher-Gegenüberstellung
//   3. analyzeVoiceShift    — Dramaturgischen Wandel bewerten
//
// Design-Regeln (analog characterVoiceEvolution / doubleEntendreSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Art der Zäsur. */
export type TraumaType =
  | 'betrayal'
  | 'loss'
  | 'battle'
  | 'humiliation'
  | 'revelation'
  | 'growth';

/** Eine dramaturgische Zäsur. */
export interface TraumaMark {
  /** Kapitel, in dem die Zäsur eintritt. */
  chapter: number;
  /** Art der Zäsur. */
  type: TraumaType;
  /** Kurze Beschreibung. */
  label: string;
}

/** Stimmen-Parameter. */
export interface VoiceProfile {
  /** Gesprächigkeit (0–1): 1 = redselig, 0 = wortkarg. */
  verbosity: number;
  /** Zynismus-Index (0–1). */
  cynicism: number;
  /** Sarkasmus-Index (0–1). */
  sarcasm: number;
  /** Naivität (0–1): 1 = naiv, 0 = illusionslos. */
  naivety: number;
  /** Durchschnittliche Satzlänge in Wörtern. */
  avgSentenceLength: number;
  /** Anteil der Floskeln (0–1). */
  fillerRate: number;
}

/** Ergebnis der Stimmen-Evolution. */
export interface VoiceEvolution {
  /** Name der Figur. */
  character: string;
  /** Ausgangs-Stimme. */
  before: VoiceProfile;
  /** End-Stimme. */
  after: VoiceProfile;
  /** Alle Zäsuren. */
  traumas: TraumaMark[];
  /** Formatierter Vorher/Nachher-Vergleich. */
  comparison: string;
  /** Dramaturgischer Wandel (0–1). */
  shiftMagnitude: number;
}

/** Ergebnis der Wandels-Analyse. */
export interface VoiceShiftAnalysis {
  /** Veränderung der Gesprächigkeit. */
  verbosityDelta: number;
  /** Veränderung des Zynismus. */
  cynicismDelta: number;
  /** Veränderung des Sarkasmus. */
  sarcasmDelta: number;
  /** Veränderung der Naivität. */
  naivetyDelta: number;
  /** Gesamtwandel (0–1). */
  totalShift: number;
  /** true, wenn ein deutlicher Wandel vorliegt. */
  significantlyChanged: boolean;
}

// ---------------------------------------------------------------------------
// Trauma-Effekte
// ---------------------------------------------------------------------------

/** Effekte je Trauma-Typ. */
const TRAUMA_EFFECTS: Record<TraumaType, Partial<VoiceProfile>> = {
  betrayal: { verbosity: -0.15, cynicism: +0.25, sarcasm: +0.20, naivety: -0.30, avgSentenceLength: -3, fillerRate: -0.10 },
  loss: { verbosity: -0.20, cynicism: +0.15, sarcasm: +0.10, naivety: -0.20, avgSentenceLength: -2, fillerRate: -0.15 },
  battle: { verbosity: -0.10, cynicism: +0.20, sarcasm: +0.15, naivety: -0.25, avgSentenceLength: -4, fillerRate: -0.10 },
  humiliation: { verbosity: -0.15, cynicism: +0.30, sarcasm: +0.25, naivety: -0.35, avgSentenceLength: -2, fillerRate: -0.10 },
  revelation: { verbosity: -0.05, cynicism: +0.10, sarcasm: +0.05, naivety: -0.15, avgSentenceLength: -1, fillerRate: -0.05 },
  growth: { verbosity: +0.10, cynicism: -0.10, sarcasm: -0.05, naivety: +0.15, avgSentenceLength: +2, fillerRate: +0.05 },
};

/** Menschenlesbare Trauma-Namen. */
export const TRAUMA_LABELS: Record<TraumaType, string> = {
  betrayal: 'Verrat',
  loss: 'Verlust',
  battle: 'Schlacht',
  humiliation: 'Demütigung',
  revelation: 'Enthüllung',
  growth: 'Wachstum',
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Trauma-Typ defensiv prüfen. */
function normalizeTraumaType(value: unknown): TraumaType {
  const all: TraumaType[] = ['betrayal', 'loss', 'battle', 'humiliation', 'revelation', 'growth'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as TraumaType)
    : 'betrayal';
}

/** Zahl auf [0, 1] begrenzen. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Zahl auf [min, max] begrenzen. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rundet auf 2 Nachkommastellen. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** VoiceProfile defensiv prüfen. */
function normalizeProfile(value: Partial<VoiceProfile> | null | undefined): VoiceProfile {
  return {
    verbosity: clamp01(value?.verbosity ?? 0.7),
    cynicism: clamp01(value?.cynicism ?? 0.2),
    sarcasm: clamp01(value?.sarcasm ?? 0.1),
    naivety: clamp01(value?.naivety ?? 0.8),
    avgSentenceLength: clamp(value?.avgSentenceLength ?? 14, 3, 40),
    fillerRate: clamp01(value?.fillerRate ?? 0.3),
  };
}

// ---------------------------------------------------------------------------
// 1) Stimmen-Evolution
// ---------------------------------------------------------------------------

/**
 * Berechnet die Stimmen-Metamorphose einer Figur über eine Reihe von Zäsuren.
 *
 * Jede Zäsur verändert die Stimme: Verrat senkt die Gesprächigkeit und erhöht
 * den Zynismus; Wachstum wirkt gegenteilig. Die Effekte addieren sich und werden
 * auf sinnvolle Werte begrenzt.
 *
 * Defensiv: ohne Zäsuren bleibt die Stimme unverändert.
 */
export function evolveCharacterVoice(
  character: string,
  traumas: TraumaMark[] | null | undefined,
  initialVoice?: Partial<VoiceProfile> | null,
): VoiceEvolution {
  const name = normalizeText(character, 'Die Figur');
  const before = normalizeProfile(initialVoice);
  const marks = Array.isArray(traumas) ? traumas : [];

  const after: VoiceProfile = { ...before };

  for (const mark of marks) {
    const type = normalizeTraumaType(mark.type);
    const effect = TRAUMA_EFFECTS[type];

    if (effect.verbosity !== undefined) after.verbosity = clamp01(after.verbosity + effect.verbosity);
    if (effect.cynicism !== undefined) after.cynicism = clamp01(after.cynicism + effect.cynicism);
    if (effect.sarcasm !== undefined) after.sarcasm = clamp01(after.sarcasm + effect.sarcasm);
    if (effect.naivety !== undefined) after.naivety = clamp01(after.naivety + effect.naivety);
    if (effect.avgSentenceLength !== undefined) after.avgSentenceLength = clamp(after.avgSentenceLength + effect.avgSentenceLength, 3, 40);
    if (effect.fillerRate !== undefined) after.fillerRate = clamp01(after.fillerRate + effect.fillerRate);
  }

  const verbosityDelta = round2(after.verbosity - before.verbosity);
  const cynicismDelta = round2(after.cynicism - before.cynicism);
  const sarcasmDelta = round2(after.sarcasm - before.sarcasm);
  const naivetyDelta = round2(after.naivety - before.naivety);

  const totalShift = round2(
    (Math.abs(verbosityDelta) + Math.abs(cynicismDelta) + Math.abs(sarcasmDelta) + Math.abs(naivetyDelta)) / 4,
  );

  const comparison = [
    `=== ${name}: Stimmen-Wandel ===`,
    '',
    `VORHER (Kapitel 1):`,
    `  Gesprächigkeit: ${Math.round(before.verbosity * 100)}%`,
    `  Zynismus: ${Math.round(before.cynicism * 100)}%`,
    `  Sarkasmus: ${Math.round(before.sarcasm * 100)}%`,
    `  Naivität: ${Math.round(before.naivety * 100)}%`,
    `  Ø Satzlänge: ${before.avgSentenceLength} Wörter`,
    `  Floskeln: ${Math.round(before.fillerRate * 100)}%`,
    '',
    `NACHHER (Kapitel ${marks.length > 0 ? marks[marks.length - 1].chapter : 1}):`,
    `  Gesprächigkeit: ${Math.round(after.verbosity * 100)}%`,
    `  Zynismus: ${Math.round(after.cynicism * 100)}%`,
    `  Sarkasmus: ${Math.round(after.sarcasm * 100)}%`,
    `  Naivität: ${Math.round(after.naivety * 100)}%`,
    `  Ø Satzlänge: ${after.avgSentenceLength} Wörter`,
    `  Floskeln: ${Math.round(after.fillerRate * 100)}%`,
    '',
    `WANDEL: ${Math.round(totalShift * 100)}%`,
  ].join('\n');

  return {
    character: name,
    before,
    after,
    traumas: marks,
    comparison,
    shiftMagnitude: totalShift,
  };
}

// ---------------------------------------------------------------------------
// 2) Vorher/Nachher-Vergleich
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine formatierte Vorher/Nachher-Gegenüberstellung.
 */
export function compareVoices(evolution: VoiceEvolution | null | undefined): string {
  if (!evolution || typeof evolution.comparison !== 'string') return '';
  return evolution.comparison;
}

// ---------------------------------------------------------------------------
// 3) Wandels-Analyse
// ---------------------------------------------------------------------------

/**
 * Bewertet den dramaturgischen Wandel einer Stimme.
 *
 * `significantlyChanged` ist true, sobald der Gesamtwandel 15 % übersteigt.
 */
export function analyzeVoiceShift(
  evolution: VoiceEvolution | null | undefined,
): VoiceShiftAnalysis {
  if (!evolution) {
    return {
      verbosityDelta: 0,
      cynicismDelta: 0,
      sarcasmDelta: 0,
      naivetyDelta: 0,
      totalShift: 0,
      significantlyChanged: false,
    };
  }

  const verbosityDelta = round2(evolution.after.verbosity - evolution.before.verbosity);
  const cynicismDelta = round2(evolution.after.cynicism - evolution.before.cynicism);
  const sarcasmDelta = round2(evolution.after.sarcasm - evolution.before.sarcasm);
  const naivetyDelta = round2(evolution.after.naivety - evolution.before.naivety);

  const totalShift = round2(
    (Math.abs(verbosityDelta) + Math.abs(cynicismDelta) + Math.abs(sarcasmDelta) + Math.abs(naivetyDelta)) / 4,
  );

  return {
    verbosityDelta,
    cynicismDelta,
    sarcasmDelta,
    naivetyDelta,
    totalShift,
    significantlyChanged: totalShift >= 0.15,
  };
}
