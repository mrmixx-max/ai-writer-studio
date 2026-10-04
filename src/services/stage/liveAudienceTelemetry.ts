/**
 * Live-Audience-Telemetry-Service — WP 48.1 (Live-Bühnen-Dashboard)
 *
 * Lokaler, deterministischer Service für Live-Lesungen: Akustik-Messung,
 * Regie-Hinweise (Director Cues), Q&A-Fragen mit Upvotes und QR-Link.
 *
 * Design-Vertrag:
 * - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
 * - Defensive Fallbacks: fehlende/ungültige Daten werden auf Defaults abgebildet.
 * - Gleiche Eingabe ⇒ gleiche Ausgabe (über injizierbare Uhr steuerbar).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TelemetryConfig {
  authorName: string;
  eventName: string;
  maxQuestions: number;
}

export interface AudienceQuestion {
  id: string;
  text: string;
  author: string;
  upvotes: number;
  timestamp: number;
}

export interface TelemetrySession {
  id: string;
  authorName: string;
  eventName: string;
  startTime: number;
  audioLevels: number[];
  questions: AudienceQuestion[];
  maxQuestions: number;
}

export type AudioStatus = 'too-quiet' | 'optimal' | 'too-loud' | 'muffled';

export interface AudioLevelResult {
  decibels: number;
  status: AudioStatus;
  message: string;
}

export type DirectorCueKind = 'drink-break' | 'eye-contact' | 'slow-down' | 'speed-up';

export interface DirectorCue {
  kind: DirectorCueKind;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

/** Akustik-Schwellwerte in dB. */
export const QUIET_THRESHOLD_DB = 40;
export const OPTIMAL_MAX_DB = 70;
export const LOUD_MAX_DB = 85;

/** Anzahl Fragen zwischen zwei Cues. */
export const QUESTIONS_PER_CUE = 5;

/** Anzahl Audio-Warnungen zwischen zwei Cues. */
export const WARNINGS_PER_CUE = 3;

/** Standardwerte für defensive Fallbacks. */
export const DEFAULT_AUTHOR_NAME = 'Unbekannter Autor';
export const DEFAULT_EVENT_NAME = 'Unbenannte Veranstaltung';
export const DEFAULT_MAX_QUESTIONS = 50;
export const DEFAULT_QR_HOST = 'localhost';

/** Feste Cue-Sequenz — zyklisch und deterministisch. */
const CUE_CYCLE: readonly DirectorCue[] = [
  { kind: 'drink-break', message: '[Trinkpause 10s]', priority: 'low' },
  { kind: 'eye-contact', message: '[Blickkontakt ins Publikum]', priority: 'medium' },
  { kind: 'slow-down', message: '[Tempo drosseln]', priority: 'high' },
  { kind: 'speed-up', message: '[Tempo anziehen]', priority: 'medium' },
];

// ─── Deterministische Uhr & Zähler (testbar) ─────────────────────────────────

let nowFn: () => number = () => Date.now();
let sessionCounter = 0;
let questionCounter = 0;

/**
 * Injeziert eine deterministische Uhr für Tests. `null` setzt auf Date.now() zurück.
 * (Öffentliche API bleibt unverändert; dies ist eine reine Test-Hilfe.)
 */
export function __setTelemetryClock(fn: (() => number) | null): void {
  nowFn = typeof fn === 'function' ? fn : () => Date.now();
}

/** Setzt Zähler und Uhr auf den Ausgangszustand zurück (nur für Tests). */
export function __resetTelemetry(): void {
  sessionCounter = 0;
  questionCounter = 0;
  nowFn = () => Date.now();
}

/** Aktuelle Zeit über die injizierte Uhr. */
function now(): number {
  const value = nowFn();
  return Number.isFinite(value) ? value : 0;
}

// ─── Kleine, defensive Helfer ────────────────────────────────────────────────

/** true, wenn `value` ein nicht-leerer String ist. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Sanitisiert einen String auf einen nicht-leeren Wert mit Fallback. */
function sanitizeString(value: unknown, fallback: string): string {
  return isNonEmptyString(value) ? value.trim() : fallback;
}

/** Sanitisiert maxQuestions auf eine ganze Zahl ≥ 1. */
function sanitizeMaxQuestions(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_QUESTIONS;
  return Math.floor(n);
}

/** Prüft defensiv, ob ein Objekt wie eine Session aussieht. */
function isUsableSession(session: unknown): session is TelemetrySession {
  return (
    typeof session === 'object' &&
    session !== null &&
    Array.isArray((session as TelemetrySession).audioLevels) &&
    Array.isArray((session as TelemetrySession).questions)
  );
}

/** Ordnet einen dB-Wert einem Status + Hinweis zu. */
function classifyDecibels(db: number): AudioLevelResult {
  if (db < QUIET_THRESHOLD_DB) {
    return { decibels: db, status: 'too-quiet', message: 'Bitte lauter sprechen' };
  }
  if (db <= OPTIMAL_MAX_DB) {
    return { decibels: db, status: 'optimal', message: 'Optimale Lautstärke' };
  }
  if (db <= LOUD_MAX_DB) {
    return { decibels: db, status: 'too-loud', message: 'Bitte leiser' };
  }
  return { decibels: db, status: 'muffled', message: 'Mikrofon übersteuert' };
}

/** Zählt die Audio-Warnungen (alles außer 'optimal'). */
function countAudioWarnings(session: TelemetrySession): number {
  let count = 0;
  for (const db of session.audioLevels) {
    if (classifyDecibels(db).status !== 'optimal') count++;
  }
  return count;
}

// ─── 1) createTelemetrySession ────────────────────────────────────────────────

/**
 * Erstellt eine neue Live-Telemetrie-Session.
 * Defensive Fallbacks: ungültige Config-Werte werden auf Defaults abgebildet.
 */
export function createTelemetrySession(config: TelemetryConfig): TelemetrySession {
  const safeConfig = (config ?? {}) as Partial<TelemetryConfig>;
  sessionCounter += 1;

  return {
    id: `session-${sessionCounter}`,
    authorName: sanitizeString(safeConfig.authorName, DEFAULT_AUTHOR_NAME),
    eventName: sanitizeString(safeConfig.eventName, DEFAULT_EVENT_NAME),
    startTime: now(),
    audioLevels: [],
    questions: [],
    maxQuestions: sanitizeMaxQuestions(safeConfig.maxQuestions),
  };
}

// ─── 2) measureAudioLevel ─────────────────────────────────────────────────────

/**
 * Misst einen dB-Wert und protokolliert ihn in der Session.
 * < 40 dB too-quiet · 40–70 optimal · 70–85 too-loud · > 85 muffled.
 */
export function measureAudioLevel(session: TelemetrySession, decibels: number): AudioLevelResult {
  const db = Number.isFinite(decibels) ? decibels : 0;
  const result = classifyDecibels(db);

  if (isUsableSession(session)) {
    session.audioLevels.push(db);
  }

  return result;
}

// ─── 3) generateDirectorCue ───────────────────────────────────────────────────

/**
 * Erzeugt einen Regie-Hinweis, sobald eine Meilenstein-Schwelle erreicht ist:
 * alle 5 Fragen oder alle 3 Audio-Warnungen. Sonst `null`.
 * Die Cue-Art wird zyklisch aus einer festen Sequenz gewählt (deterministisch).
 */
export function generateDirectorCue(session: TelemetrySession): DirectorCue | null {
  if (!isUsableSession(session)) return null;

  const questionMilestones = Math.floor(session.questions.length / QUESTIONS_PER_CUE);
  const warningMilestones = Math.floor(countAudioWarnings(session) / WARNINGS_PER_CUE);
  const totalMilestones = questionMilestones + warningMilestones;

  if (totalMilestones <= 0) return null;

  const index = (totalMilestones - 1) % CUE_CYCLE.length;
  return { ...CUE_CYCLE[index] };
}

// ─── 4) submitQuestion ────────────────────────────────────────────────────────

/**
 * Reicht eine Q&A-Frage ein. Die Frage wird nur in der Session gespeichert,
 * solange die Kapazität (maxQuestions) nicht erreicht ist. Zurückgegeben wird
 * stets ein gültiges AudienceQuestion-Objekt.
 */
export function submitQuestion(
  session: TelemetrySession,
  question: string,
  author: string,
): AudienceQuestion {
  questionCounter += 1;
  const entry: AudienceQuestion = {
    id: `q-${questionCounter}`,
    text: typeof question === 'string' ? question.trim() : '',
    author: sanitizeString(author, 'Anonym'),
    upvotes: 0,
    timestamp: now(),
  };

  if (isUsableSession(session)) {
    const capacity = sanitizeMaxQuestions(session.maxQuestions);
    if (session.questions.length < capacity) {
      session.questions.push(entry);
    }
  }

  return entry;
}

// ─── 5) getTopQuestions ───────────────────────────────────────────────────────

/**
 * Liefert die Top-Fragen nach Upvotes (absteigend). Bei Gleichstand entscheidet
 * die frühere Einreichung, danach die ID — vollständig deterministisch.
 * Mutiert die Session nicht.
 */
export function getTopQuestions(session: TelemetrySession, limit: number): AudienceQuestion[] {
  if (!isUsableSession(session) || session.questions.length === 0) return [];

  const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : 0;
  if (safeLimit <= 0) return [];

  const sorted = [...session.questions].sort((a, b) => {
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return sorted.slice(0, safeLimit);
}

// ─── 6) generateQRLink ────────────────────────────────────────────────────────

/**
 * Erzeugt einen QR-Code-Link für Zuschauer. Defensive Fallbacks: leerer/ungültiger
 * Host → localhost; fehlender Event-Name → leerer Query-Wert.
 */
export function generateQRLink(session: TelemetrySession, host: string): string {
  const rawHost = sanitizeString(host, DEFAULT_QR_HOST).replace(/\/+$/, '');
  const base = /^https?:\/\//i.test(rawHost) ? rawHost : `https://${rawHost}`;
  const sessionId = isUsableSession(session) && isNonEmptyString(session.id) ? session.id : 'session';
  const event = isUsableSession(session) ? sanitizeString(session.eventName, '') : '';

  return `${base}/live/${sessionId}?event=${encodeURIComponent(event)}`;
}
