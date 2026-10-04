// Voice-Memo-Companion-Service (WP 43.1 — Diktat als Schreib-Asset).
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
// - Der Smart-Tagger arbeitet ausschließlich über Keyword-Overlap und
//   Figurennamen-Erkennung (Wortgrenzen-Regex).
// - Defensive Fallbacks: fehlende/ungültige Daten (null, NaN, negative Werte,
//   falsche Typen, kaputte Objekte) werden auf Defaults abgebildet statt zu
//   werfen.
// - Gleiche Eingabe ⇒ gleiche Ausgabe. IDs werden aus einem inhaltsbasierten
//   Hash abgeleitet (keine Zufallsquelle), Sortierungen sind stabil.

// --- Typen --------------------------------------------------------------------------

export type MemoTargetKind = "chapter" | "character" | "codex";

export interface VoiceMemo {
  /** Stabile, inhaltsbasierte ID (deterministisch aus dem Inhalt abgeleitet). */
  id: string;
  /** Transkribierter Text des Memos. */
  transcript: string;
  /** Aufnahmedauer in Sekunden (nicht-negativ). */
  durationSec: number;
  /** Aufnahmezeitpunkt als Unix-Millisekunden. */
  recordedAt: number;
  /** Anzahl Wörter im Transkript. */
  wordCount: number;
}

export interface MemoChapter {
  id: string;
  title: string;
  content: string;
}

export interface MemoContext {
  chapters: MemoChapter[];
  characters: string[];
  codexTopics: string[];
}

export interface MemoTarget {
  kind: MemoTargetKind;
  targetId: string;
  targetLabel: string;
  /** Konfidenz in [0, 1]; auf zwei Nachkommastellen gerundet. */
  confidence: number;
  reason: string;
}

// --- Konstanten ---------------------------------------------------------------------

/**
 * Stoppwörter (Deutsch + Englisch), die für den Keyword-Overlap entfernt
 * werden. Bewusst konservativ gehalten, damit inhaltstragende Begriffe
 * erhalten bleiben.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  // Deutsch
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "eines", "und", "oder", "aber", "doch", "denn", "weil", "wenn",
  "dass", "als", "wie", "so", "auch", "nur", "noch", "schon", "sehr", "mehr",
  "ist", "sind", "war", "waren", "wird", "werden", "wurde", "wurden", "sein",
  "hat", "haben", "hatte", "hatten", "kann", "können", "muss", "müssen",
  "soll", "sollen", "will", "wollen", "würde", "würden", "ich", "du", "er",
  "sie", "es", "wir", "ihr", "mich", "dich", "sich", "uns", "euch", "mir",
  "dir", "ihm", "ihn", "ihnen", "mein", "dein", "sein", "ihre", "unser",
  "mit", "von", "zu", "zum", "zur", "bei", "nach", "aus", "auf", "an", "in",
  "im", "am", "über", "unter", "vor", "für", "gegen", "ohne", "um", "durch",
  "nicht", "kein", "keine", "keinen", "keinem", "keiner", "hier", "da", "dort",
  "dann", "man", "mich", "wird", "zum", "das", "dies", "diese", "dieser",
  "dieses", "jene", "jener", "jetzt", "etwa", "eben", "mal", "ganz", "etwas",
  // Englisch
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this",
  "these", "those", "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "have", "has", "had", "will", "would", "can", "could",
  "should", "shall", "may", "might", "must", "of", "to", "in", "on", "at",
  "by", "for", "with", "from", "as", "so", "not", "no", "it", "its", "he",
  "she", "they", "we", "you", "i", "me", "my", "our", "your", "their", "him",
  "her", "them", "us", "there", "here", "when", "where", "which", "who", "whom",
]);

/** Minimale Länge eines Keyword-Tokens, das für den Overlap genutzt wird. */
const MIN_KEYWORD_LENGTH = 3;

// --- Defensive Helfer ---------------------------------------------------------------

/** true, wenn `value` ein nicht-leerer String ist. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Begrenzt `value` auf [min, max]; NaN/Infinity → min. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Rundet auf zwei Nachkommastellen (deterministisch, begrenzt auf [0,1]). */
function roundConfidence(value: number): number {
  const c = clamp(value, 0, 1);
  return Math.round(c * 100) / 100;
}

/** Normalisiert einen Text auf Kleinbuchstaben (Umlaute bleiben erhalten). */
function normalize(text: string): string {
  return text.toLowerCase();
}

/**
 * Zerlegt einen Text in normalisierte Keyword-Tokens. Entfernt Stoppwörter,
 * zu kurze Tokens und Duplikate. Die Reihenfolge des ersten Auftretens bleibt
 * erhalten (deterministisch).
 */
function extractKeywords(text: string): string[] {
  if (!isNonEmptyString(text)) return [];

  const raw = normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of raw) {
    if (token.length < MIN_KEYWORD_LENGTH) continue;
    if (STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }

  return result;
}

/** Deterministischer FNV-1a-32-Hash eines Strings → 8-stelliger Hex-String. */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV-Primzahl 16777619 via Multiplikation modulo 2^32.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Zählt Wörter in einem Text (whitespace-getrennt, defensiv). */
function countWords(text: string): number {
  if (!isNonEmptyString(text)) return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/** Formatiert einen Millisekunden-Zeitstempel deterministisch (UTC). */
function formatTimestamp(recordedAt: number): string {
  const ms = Number.isFinite(recordedAt) ? recordedAt : 0;
  const iso = new Date(ms).toISOString();
  // "2026-10-04T08:30:00.000Z" → "2026-10-04 08:30 UTC"
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Escaped Sonderzeichen für die Verwendung in einem RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Zählt, wie oft `needle` als eigenständiges Wort in `haystack` vorkommt.
 * Nutzt Unicode-Wortgrenzen, damit "Anna" nicht in "Ananas" matcht.
 */
function countWordOccurrences(haystack: string, needle: string): number {
  if (!isNonEmptyString(haystack) || !isNonEmptyString(needle)) return 0;
  const escaped = escapeRegExp(normalize(needle).trim());
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "gu");
  const matches = normalize(haystack).match(pattern);
  return matches ? matches.length : 0;
}

// --- 1) createVoiceMemo -------------------------------------------------------------

/**
 * Erstellt ein Voice-Memo-Objekt.
 *
 * Defensive Fallbacks:
 * - `transcript` wird auf einen getrimmten String abgebildet (nicht-String → "").
 * - `durationSec` wird auf eine nicht-negative, endliche Zahl begrenzt
 *   (NaN/negativ/Infinity → 0).
 * - `recordedAt` fällt auf `Date.now()` zurück, wenn nicht endlich.
 * - `wordCount` wird aus dem Transkript berechnet.
 * - `id` wird inhaltsbasiert gehasht → gleiche Eingabe ergibt dieselbe ID.
 */
export function createVoiceMemo(
  transcript: string,
  durationSec: number,
  recordedAt?: number,
): VoiceMemo {
  const safeTranscript = isNonEmptyString(transcript) ? transcript.trim() : "";

  const safeDuration = Number.isFinite(durationSec)
    ? Math.max(0, durationSec)
    : 0;

  const safeRecordedAt = Number.isFinite(recordedAt)
    ? (recordedAt as number)
    : Date.now();

  const wordCount = countWords(safeTranscript);

  const id = `vm_${fnv1aHex(
    `${safeTranscript}\u0000${safeDuration}\u0000${safeRecordedAt}\u0000${wordCount}`,
  )}`;

  return {
    id,
    transcript: safeTranscript,
    durationSec: safeDuration,
    recordedAt: safeRecordedAt,
    wordCount,
  };
}

// --- 2) analyzeMemoContent (Smart-Tagger) -------------------------------------------

/** Berechnet einen Chapter-Target-Kandidaten (Titel zählt doppelt). */
function scoreChapter(
  memoKeywords: readonly string[],
  chapter: MemoChapter,
): MemoTarget | null {
  if (!chapter || typeof chapter !== "object") return null;

  const titleSet = new Set(extractKeywords(isNonEmptyString(chapter.title) ? chapter.title : ""));
  const contentSet = new Set(extractKeywords(isNonEmptyString(chapter.content) ? chapter.content : ""));

  if (titleSet.size === 0 && contentSet.size === 0) return null;

  const matched: string[] = [];
  let score = 0;

  for (const keyword of memoKeywords) {
    if (titleSet.has(keyword)) {
      score += 2;
      matched.push(keyword);
    } else if (contentSet.has(keyword)) {
      score += 1;
      matched.push(keyword);
    }
  }

  if (matched.length === 0) return null;

  const maxScore = memoKeywords.length * 2;
  const confidence = maxScore > 0 ? score / maxScore : 0;

  const targetId = isNonEmptyString(chapter.id) ? chapter.id.trim() : `chapter_${matched[0]}`;
  const targetLabel = isNonEmptyString(chapter.title) ? chapter.title.trim() : targetId;

  return {
    kind: "chapter",
    targetId,
    targetLabel,
    confidence: roundConfidence(confidence),
    reason: `Keyword-Übereinstimmung mit Kapitel „${targetLabel}“: ${matched.join(", ")}`,
  };
}

/** Berechnet einen Character-Target-Kandidaten via Figurennamen-Erkennung. */
function scoreCharacter(transcript: string, character: string): MemoTarget | null {
  if (!isNonEmptyString(character)) return null;
  const name = character.trim();

  const occurrences = countWordOccurrences(transcript, name);
  if (occurrences <= 0) return null;

  // Starke Signale: Name im Memo genannt. Mehr Nennungen → höhere Konfidenz.
  const confidence = clamp(0.8 + 0.05 * (occurrences - 1), 0, 0.99);

  return {
    kind: "character",
    targetId: name,
    targetLabel: name,
    confidence: roundConfidence(confidence),
    reason: `Figurenname „${name}“ ${occurrences}× im Memo genannt`,
  };
}

/** Berechnet einen Codex-Target-Kandidaten via Keyword-Overlap. */
function scoreCodexTopic(
  memoKeywords: readonly string[],
  topic: string,
): MemoTarget | null {
  if (!isNonEmptyString(topic)) return null;
  const label = topic.trim();

  const topicSet = new Set(extractKeywords(label));
  if (topicSet.size === 0) return null;

  const matched = memoKeywords.filter((keyword) => topicSet.has(keyword));
  if (matched.length === 0) return null;

  const confidence = memoKeywords.length > 0 ? matched.length / memoKeywords.length : 0;

  return {
    kind: "codex",
    targetId: label,
    targetLabel: label,
    confidence: roundConfidence(confidence),
    reason: `Keyword-Übereinstimmung mit Codex-Thema „${label}“: ${matched.join(", ")}`,
  };
}

/** Stabile Rangfolge für den deterministischen Tie-Break. */
const KIND_ORDER: Record<MemoTargetKind, number> = {
  character: 0,
  chapter: 1,
  codex: 2,
};

/**
 * Semantischer Smart-Tagger: schlägt anhand von Keyword-Overlap und
 * Figurennamen-Erkennung Ziele vor — rein lokal, ohne LLM.
 *
 * - Kapitel: gewichteter Overlap (Titel zählt doppelt gegenüber Inhalt).
 * - Figuren: eigenständige Wort-Treffer des Namens im Memo (starkes Signal).
 * - Codex: Keyword-Overlap zwischen Memo und Thema.
 *
 * Ergebnis ist nach Konfidenz absteigend sortiert; bei Gleichstand gilt die
 * feste Reihenfolge character → chapter → codex, dann `targetId`. Nur Ziele
 * mit Konfidenz > 0 werden zurückgegeben.
 */
export function analyzeMemoContent(
  memo: VoiceMemo,
  context: MemoContext,
): MemoTarget[] {
  if (!memo || typeof memo !== "object") return [];

  const transcript = isNonEmptyString(memo.transcript) ? memo.transcript : "";
  const memoKeywords = extractKeywords(transcript);

  if (memoKeywords.length === 0) return [];

  const safeContext = context && typeof context === "object" ? context : ({} as MemoContext);
  const chapters = Array.isArray(safeContext.chapters) ? safeContext.chapters : [];
  const characters = Array.isArray(safeContext.characters) ? safeContext.characters : [];
  const codexTopics = Array.isArray(safeContext.codexTopics) ? safeContext.codexTopics : [];

  const targets: MemoTarget[] = [];

  for (const character of characters) {
    const target = scoreCharacter(transcript, character);
    if (target) targets.push(target);
  }

  for (const chapter of chapters) {
    const target = scoreChapter(memoKeywords, chapter);
    if (target) targets.push(target);
  }

  for (const topic of codexTopics) {
    const target = scoreCodexTopic(memoKeywords, topic);
    if (target) targets.push(target);
  }

  return targets.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kindDiff !== 0) return kindDiff;
    return a.targetId.localeCompare(b.targetId);
  });
}

// --- 3) formatMemoForChapter --------------------------------------------------------

/**
 * Formatiert ein Memo als Randnotiz für ein Kapitel (Blockquote-Stil).
 */
export function formatMemoForChapter(memo: VoiceMemo): string {
  if (!memo || typeof memo !== "object") {
    return "> 🎙️ Voice-Memo — (keine Daten)";
  }

  const transcript = isNonEmptyString(memo.transcript) ? memo.transcript : "(leeres Memo)";
  const date = formatTimestamp(memo.recordedAt);
  const duration = Number.isFinite(memo.durationSec) ? Math.max(0, memo.durationSec) : 0;
  const words = Number.isFinite(memo.wordCount) ? Math.max(0, memo.wordCount) : 0;

  return [
    "> 🎙️ **Voice-Memo (Randnotiz)**",
    `> Aufgenommen: ${date}`,
    `> Dauer: ${duration}s · ${words} Wörter`,
    ">",
    `> ${transcript}`,
  ].join("\n");
}

// --- 4) formatMemoForCharacter ------------------------------------------------------

/**
 * Formatiert ein Memo als Eintrag im Figurenprofil.
 */
export function formatMemoForCharacter(memo: VoiceMemo, characterName: string): string {
  const name = isNonEmptyString(characterName) ? characterName.trim() : "Unbekannt";

  if (!memo || typeof memo !== "object") {
    return `### ${name}\n_Voice-Memo — (keine Daten)_`;
  }

  const transcript = isNonEmptyString(memo.transcript) ? memo.transcript : "(leeres Memo)";
  const date = formatTimestamp(memo.recordedAt);

  return [
    `### ${name}`,
    `**Voice-Memo** — ${date}`,
    "",
    transcript,
  ].join("\n");
}

// --- 5) formatMemoForCodex ----------------------------------------------------------

/**
 * Formatiert ein Memo als Codex-Eintrag.
 */
export function formatMemoForCodex(memo: VoiceMemo): string {
  if (!memo || typeof memo !== "object") {
    return "**[Voice-Memo]** _(keine Daten)_";
  }

  const transcript = isNonEmptyString(memo.transcript) ? memo.transcript : "(leeres Memo)";
  const date = formatTimestamp(memo.recordedAt);

  return [
    `**[Voice-Memo · ${date}]**`,
    "",
    transcript,
  ].join("\n");
}

// --- 6) sortMemosByDate -------------------------------------------------------------

/**
 * Sortiert Memos chronologisch aufsteigend (älteste zuerst).
 *
 * - Defensiv: kein Array → leeres Array; ungültige Einträge werden verworfen.
 * - Stabil: bei gleichem Zeitstempel bleibt die Eingabereihenfolge erhalten.
 * - Das Eingabe-Array wird nicht mutiert.
 */
export function sortMemosByDate(memos: VoiceMemo[]): VoiceMemo[] {
  if (!Array.isArray(memos)) return [];

  return memos
    .filter((memo): memo is VoiceMemo => !!memo && typeof memo === "object")
    .map((memo, index) => ({ memo, index }))
    .sort((a, b) => {
      const aTime = Number.isFinite(a.memo.recordedAt) ? a.memo.recordedAt : 0;
      const bTime = Number.isFinite(b.memo.recordedAt) ? b.memo.recordedAt : 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.index - b.index;
    })
    .map((entry) => entry.memo);
}
