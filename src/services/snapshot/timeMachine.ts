// Time-Machine: Micro-Snapshots & Visual Diff.
//
// Lokale, deterministische Versionierung auf Kapitelebene. Kein LLM,
// keine Netzwerk-Aufrufe — nur Text. Defensive Fallbacks bei fehlenden
// Daten: Jede Funktion gibt bei ungültigen Eingaben ein leeres,
// aber wohlgeformtes Ergebnis zurück.

import { uid } from "@/services/knowledge/util";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein komprimierter Text-Snapshot auf Kapitelebene. */
export interface MicroSnapshot {
  id: string;
  projectId: string;
  chapterId: string;
  /** Unix-Zeitstempel (ms) zum Zeitpunkt der Aufnahme. */
  timestamp: number;
  /** Wortzahl des Inhalts. */
  wordCount: number;
  /** Vollständiger Textinhalt. */
  content: string;
  /** Kurze Zusammenfassung (erste ~120 Zeichen). */
  summary: string;
}

/** Farblicher Diff zwischen zwei Micro-Snapshots. */
export interface MicroDiff {
  /** Wörter/Sätze, die im neuen Snapshot hinzugekommen sind. */
  added: string[];
  /** Wörter/Sätze, die im neuen Snapshot fehlen. */
  removed: string[];
  /** Wörter/Sätze, die in beiden Snapshots identisch sind. */
  unchanged: string[];
}

// ---------------------------------------------------------------------------
// Persistenz (localStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ai-writer-studio.timemachine.v1";

/**
 * Maximale Anzahl Micro-Snapshots pro Kapitel (FIFO).
 *
 * Ohne Grenze wächst die Historie unbegrenzt im localStorage. 50 Stände
 * reichen für ein Kapitel aus; ältere werden verworfen, weil die neuesten
 * die wertvollen sind.
 */
export const MAX_MICRO_SNAPSHOTS = 50;

/** Liest alle Micro-Snapshots aus dem localStorage. */
function readAll(): MicroSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSnapshot);
  } catch {
    return [];
  }
}

/** Schreibt alle Micro-Snapshots in den localStorage. */
function writeAll(snapshots: MicroSnapshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // localStorage kann voll sein oder blockiert — Service bleibt funktionsfähig
  }
}

/** Validiert ein unbekanntes Objekt als MicroSnapshot. */
function isValidSnapshot(obj: unknown): obj is MicroSnapshot {
  if (typeof obj !== "object" || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.projectId === "string" &&
    typeof s.chapterId === "string" &&
    typeof s.timestamp === "number" &&
    typeof s.wordCount === "number" &&
    typeof s.content === "string" &&
    typeof s.summary === "string"
  );
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Zählt Wörter im Text (Unicode-freundlich). */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Erstellt eine kurze Zusammenfassung aus dem Text. */
function makeSummary(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 120) return trimmed;
  const cut = trimmed.slice(0, 120);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : 120)}…`;
}

/** Zerlegt Text in vergleichbare Einheiten (Sätze oder Wörter). */
function tokenize(text: string): string[] {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  // Nur wenn echte Satzgrenzen vorhanden sind, auf Satzebene zerlegen.
  // Sonst wären kurze Einzelsätze ("Der Hund läuft.") Wort-Token, während
  // mehrsätzige Texte Satz-Token liefern — der Diff verglich dann Äpfel
  // mit Birnen und meldete entfernte Wörter statt Sätze.
  if (/[.!?…]/.test(normalized)) {
    const sentences = normalized.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g);
    if (sentences && sentences.length > 0) {
      return sentences.map((s) => s.trim()).filter(Boolean);
    }
  }
  // Fallback: Wörter
  return normalized.split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Erstellt einen komprimierten Text-Snapshot für ein Kapitel.
 *
 * Der Snapshot wird sofort persistiert und kann später wiederhergestellt
 * werden. Bei leerem Inhalt wird ein leerer Snapshot angelegt — das ist
 * ein gültiger Zustand (z. B. nach dem Löschen eines Kapitels).
 */
export function createMicroSnapshot(
  projectId: string,
  chapterId: string,
  content: string,
): MicroSnapshot {
  const safeProjectId = String(projectId ?? "");
  const safeChapterId = String(chapterId ?? "");
  const safeContent = String(content ?? "");

  const snapshot: MicroSnapshot = {
    id: uid("msnap"),
    projectId: safeProjectId,
    chapterId: safeChapterId,
    timestamp: Date.now(),
    wordCount: countWords(safeContent),
    content: safeContent,
    summary: makeSummary(safeContent),
  };

  const all = readAll();
  all.push(snapshot);

  // FIFO-Bereinigung pro Kapitel: Nur die neuesten MAX_MICRO_SNAPSHOTS
  // behalten. Sekundär nach Einfüge-Index sortiert, damit Stände mit
  // identischem Millisekunden-Zeitstempel deterministisch behandelt werden.
  const sameChapter = all
    .map((s, index) => ({ s, index }))
    .filter(
      ({ s }) =>
        s.projectId === safeProjectId && s.chapterId === safeChapterId,
    )
    .sort((a, b) => b.s.timestamp - a.s.timestamp || b.index - a.index);
  const keepIds = new Set(
    sameChapter.slice(0, MAX_MICRO_SNAPSHOTS).map(({ s }) => s.id),
  );
  const pruned = all.filter(
    (s) =>
      s.projectId !== safeProjectId ||
      s.chapterId !== safeChapterId ||
      keepIds.has(s.id),
  );
  writeAll(pruned);

  return snapshot;
}

/**
 * Listet alle Micro-Snapshots für ein Kapitel, neueste zuerst.
 *
 * Gibt ein leeres Array zurück, wenn keine Snapshots existieren oder
 * die Eingaben ungültig sind.
 */
export function listMicroSnapshots(
  projectId: string,
  chapterId: string,
): MicroSnapshot[] {
  const safeProjectId = String(projectId ?? "");
  const safeChapterId = String(chapterId ?? "");

  if (!safeProjectId || !safeChapterId) return [];

  // Sekundär nach Einfüge-Reihenfolge (höherer Index = später angelegt),
  // damit Snapshots mit identischem Millisekunden-Zeitstempel dennoch
  // deterministisch neueste-zuerst sortiert werden.
  return readAll()
    .map((s, index) => ({ s, index }))
    .filter(
      ({ s }) => s.projectId === safeProjectId && s.chapterId === safeChapterId,
    )
    .sort((a, b) => b.s.timestamp - a.s.timestamp || b.index - a.index)
    .map(({ s }) => s);
}

/**
 * Vergleicht zwei Micro-Snapshots und zeigt die Unterschiede.
 *
 * Die Tokenisierung arbeitet auf Satzebene (oder Wörterbene als Fallback),
 * damit der Diff für den Menschen lesbar bleibt. Die Reihenfolge der
 * Token in den Arrays spiegelt die Reihenfolge im Text wider.
 */
export function diffMicroSnapshots(
  old: MicroSnapshot,
  newer: MicroSnapshot,
): MicroDiff {
  const oldTokens = tokenize(old?.content ?? "");
  const newTokens = tokenize(newer?.content ?? "");

  const oldSet = new Set(oldTokens);
  const newSet = new Set(newTokens);

  const added = newTokens.filter((t) => !oldSet.has(t));
  const removed = oldTokens.filter((t) => !newSet.has(t));
  const unchanged = oldTokens.filter((t) => newSet.has(t));

  return { added, removed, unchanged };
}

/**
 * Stellt den Inhalt eines Micro-Snapshots wieder her.
 *
 * Gibt den gespeicherten Inhalt zurück. Wenn der Snapshot ungültig
 * oder leer ist, wird ein leerer String zurückgegeben — das ist
 * der defensive Fallback.
 */
export function restoreMicroSnapshot(snapshot: MicroSnapshot): string {
  if (!snapshot || typeof snapshot.content !== "string") return "";
  return snapshot.content;
}

/**
 * Löscht alle Micro-Snapshots eines Projekts.
 * Nützlich für Tests und Bereinigung.
 */
export function clearMicroSnapshots(projectId: string): void {
  const safeProjectId = String(projectId ?? "");
  const all = readAll().filter((s) => s.projectId !== safeProjectId);
  writeAll(all);
}

/**
 * Gibt die Anzahl der Micro-Snapshots für ein Kapitel zurück.
 */
export function countMicroSnapshots(
  projectId: string,
  chapterId: string,
): number {
  return listMicroSnapshots(projectId, chapterId).length;
}
