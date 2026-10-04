/**
 * Reader-Sentiment-Graph-Service — WP 47.1
 * (Leser-Empathie- & Sympathiekurven-Analyse)
 *
 * Lokaler, deterministischer Service zur Berechnung von Empathie-Metriken,
 * Protagonist-/Antagonist-Gegenüberstellung, Verräter-Schock-Index und
 * Sympathiekurven über Kapitel.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChapterEmpathyData {
  chapter: number;
  vulnerability: number;
  agency: number;
  warmth: number;
}

export interface EmpathyMetrics {
  chapter: number;
  vulnerability: number;
  agency: number;
  warmth: number;
  overall: number;
}

export interface SympathyComparison {
  protagonist: EmpathyMetrics[];
  antagonist: EmpathyMetrics[];
  divergence: number[];
  maxDivergence: number;
  maxDivergenceChapter: number;
}

export interface SympathyCurve {
  points: { chapter: number; value: number }[];
  trend: 'rising' | 'falling' | 'stable';
  peak: number;
  valley: number;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const TREND_EPSILON = 0.5;

// ─── Interne Helfer ──────────────────────────────────────────────────────────

/** Rundet auf 2 Dezimalstellen (deterministisch, vermeidet Float-Rauschen). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Begrenzt einen Wert defensiv auf [0, 100]; nicht-finite Werte werden 0. */
function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return MIN_SCORE;
  if (num < MIN_SCORE) return MIN_SCORE;
  if (num > MAX_SCORE) return MAX_SCORE;
  return num;
}

/** Normalisiert eine Kapitelnummer defensiv auf eine endliche Zahl >= 0. */
function normalizeChapter(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.trunc(num));
}

/** Least-Squares-Steigung über (index, value)-Punkte. */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Berechnet Empathie-Metriken aus den Rohdaten eines Kapitels.
 *
 * vulnerability, agency, warmth werden defensiv auf [0, 100] begrenzt.
 * overall = (vulnerability + agency + warmth) / 3.
 */
export function calculateEmpathyMetrics(chapterData: ChapterEmpathyData): EmpathyMetrics {
  if (!chapterData || typeof chapterData !== 'object') {
    return { chapter: 0, vulnerability: 0, agency: 0, warmth: 0, overall: 0 };
  }

  const vulnerability = clampScore(chapterData.vulnerability);
  const agency = clampScore(chapterData.agency);
  const warmth = clampScore(chapterData.warmth);
  const overall = round2((vulnerability + agency + warmth) / 3);

  return {
    chapter: normalizeChapter(chapterData.chapter),
    vulnerability,
    agency,
    warmth,
    overall,
  };
}

/**
 * Stellt Protagonist- und Antagonist-Empathie über die Zeit gegenüber.
 *
 * Die Kapitel beider Reihen werden zu einer sortierten Vereinigung
 * zusammengeführt; fehlende Werte werden als 0 angenommen. `divergence`
 * enthält pro Kapitel den Betrag der Differenz der `overall`-Werte.
 */
export function compareProtagonistAntagonist(
  protagonist: EmpathyMetrics[],
  antagonist: EmpathyMetrics[],
): SympathyComparison {
  const safeProtagonist = Array.isArray(protagonist) ? protagonist : [];
  const safeAntagonist = Array.isArray(antagonist) ? antagonist : [];

  const protagonistByChapter = new Map<number, number>();
  for (const metric of safeProtagonist) {
    if (metric && typeof metric === 'object') {
      protagonistByChapter.set(normalizeChapter(metric.chapter), clampScore(metric.overall));
    }
  }

  const antagonistByChapter = new Map<number, number>();
  for (const metric of safeAntagonist) {
    if (metric && typeof metric === 'object') {
      antagonistByChapter.set(normalizeChapter(metric.chapter), clampScore(metric.overall));
    }
  }

  const chapters = Array.from(
    new Set<number>([...protagonistByChapter.keys(), ...antagonistByChapter.keys()]),
  ).sort((a, b) => a - b);

  const divergence: number[] = [];
  let maxDivergence = 0;
  let maxDivergenceChapter = 0;

  for (const chapter of chapters) {
    const p = protagonistByChapter.get(chapter) ?? 0;
    const a = antagonistByChapter.get(chapter) ?? 0;
    const diff = round2(Math.abs(p - a));
    divergence.push(diff);
    if (diff > maxDivergence) {
      maxDivergence = diff;
      maxDivergenceChapter = chapter;
    }
  }

  return {
    protagonist: safeProtagonist,
    antagonist: safeAntagonist,
    divergence,
    maxDivergence: round2(maxDivergence),
    maxDivergenceChapter,
  };
}

/**
 * Berechnet den Verräter-Schock-Index.
 *
 * Je höher die vorherige Empathie und je später der Verrat, desto höher
 * der Schock:
 *   shockIndex = (empathyBefore / 100) * (betrayalChapter / totalChapters) * 100
 *
 * Ergebnis ist auf [0, 100] begrenzt; bei totalChapters <= 0 wird 0 geliefert.
 */
export function calculateBetrayalShockIndex(
  protagonistEmpathyBefore: number,
  betrayalChapter: number,
  totalChapters: number,
): number {
  const empathy = clampScore(protagonistEmpathyBefore);
  const total = normalizeChapter(totalChapters);
  if (total <= 0) return 0;

  const betrayal = Math.min(normalizeChapter(betrayalChapter), total);
  const ratio = betrayal / total;
  const shockIndex = (empathy / 100) * ratio * 100;

  return round2(clampScore(shockIndex));
}

/**
 * Erzeugt eine Sympathiekurve über die Kapitel.
 *
 * Punkte werden nach Kapitel aufsteigend sortiert; der Trend wird über die
 * Least-Squares-Steigung der `overall`-Werte bestimmt.
 */
export function generateSympathyCurve(metrics: EmpathyMetrics[]): SympathyCurve {
  const safeMetrics = Array.isArray(metrics) ? metrics : [];

  const points = safeMetrics
    .filter((m): m is EmpathyMetrics => !!m && typeof m === 'object')
    .map((m) => ({
      chapter: normalizeChapter(m.chapter),
      value: clampScore(m.overall),
    }))
    .sort((a, b) => a.chapter - b.chapter);

  if (points.length === 0) {
    return { points: [], trend: 'stable', peak: 0, valley: 0 };
  }

  const values = points.map((p) => p.value);
  const slope = linearSlope(values);
  const trend: SympathyCurve['trend'] =
    slope > TREND_EPSILON ? 'rising' : slope < -TREND_EPSILON ? 'falling' : 'stable';

  const peak = round2(Math.max(...values));
  const valley = round2(Math.min(...values));

  return { points, trend, peak, valley };
}
