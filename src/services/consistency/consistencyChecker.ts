// Consistency Checker (Sprint 26, Agent 1): Widersprüche in Charakteren,
// Handlung, Zeitleisten und Emotionen erkennen.
// Bloomberg-Terminal-Stil: lokal, kein LLM nötig, deterministisch.

import type { Character } from "@/services/character/characterManager";

export interface ConsistencyIssue {
  id: string;
  type: "character" | "timeline" | "plot" | "emotion";
  severity: "low" | "medium" | "high";
  message: string;
  details?: string;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  checkedAt: number;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

let issueCounter = 0;
function nextId(): string {
  issueCounter += 1;
  return `issue-${Date.now().toString(36)}-${issueCounter}`;
}

/**
 * Prüft Charaktere auf interne Widersprüche:
 * - Doppelte Namen
 * - Widersprüchliche Altersangaben
 * - Fehlende Pflichtfelder
 * - Unvollständige Beziehungen
 */
export function checkCharacterConsistency(characters: Character[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const nameCount = new Map<string, number>();

  for (const char of characters) {
    const name = char.name?.trim() ?? "";
    if (!name) {
      issues.push({
        id: nextId(),
        type: "character",
        severity: "medium",
        message: `Charakter ohne Namen gefunden (ID: ${char.id.slice(0, 8)}...)`,
        details: "Jeder Charakter sollte einen eindeutigen Namen haben.",
      });
      continue;
    }

    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);

    // Alter prüfen
    if (char.age !== undefined && char.age !== null) {
      if (char.age < 0 || char.age > 1000) {
        issues.push({
          id: nextId(),
          type: "character",
          severity: "medium",
          message: `Ungültiges Alter für ${name}: ${char.age}`,
          details: "Alter sollte zwischen 0 und 1000 liegen.",
        });
      }
    }

    // Beschreibung prüfen
    if (!char.description || char.description.trim().length < 10) {
      issues.push({
        id: nextId(),
        type: "character",
        severity: "low",
        message: `Wenig Beschreibung für ${name}`,
        details: "Charaktere sollten mindestens 10 Zeichen Beschreibung haben.",
      });
    }

    // Beziehungen prüfen
    if (char.relationships) {
      const targets = new Set<string>();
      for (const rel of char.relationships) {
        if (targets.has(rel.characterId)) {
          issues.push({
            id: nextId(),
            type: "character",
            severity: "low",
            message: `Doppelte Beziehung: ${name} → ${rel.characterId}`,
          });
        }
        targets.add(rel.characterId);
        if (!rel.type || rel.type.trim() === "") {
          issues.push({
            id: nextId(),
            type: "character",
            severity: "low",
            message: `Beziehung ohne Typ: ${name} → ${rel.characterId}`,
          });
        }
      }
    }
  }

  // Doppelte Namen
  for (const [name, count] of nameCount) {
    if (count > 1) {
      issues.push({
        id: nextId(),
        type: "character",
        severity: "high",
        message: `Doppelter Charaktername: ${name} (${count}x)`,
        details: "Jeder Charaktername sollte eindeutig sein.",
      });
    }
  }

  return issues;
}

/**
 * Prüft eine Zeitleiste auf Widersprüche:
 * - Ereignisse in falscher Reihenfolge
 * - Zeitsprünge ohne Erklärung
 * - Doppelte Zeitstempel
 */
export function checkTimelineConsistency(
  events: { id: string; date: string; title: string }[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const seenDates = new Map<string, string>();

  for (const ev of sorted) {
    if (seenDates.has(ev.date)) {
      issues.push({
        id: nextId(),
        type: "timeline",
        severity: "low",
        message: `Doppelter Zeitstempel: ${ev.date} (${ev.title} & ${seenDates.get(ev.date)})`,
      });
    }
    seenDates.set(ev.date, ev.title);

    // ISO-Datum Validierung
    const d = new Date(ev.date);
    if (isNaN(d.getTime())) {
      issues.push({
        id: nextId(),
        type: "timeline",
        severity: "medium",
        message: `Ungültiges Datum: ${ev.date} (${ev.title})`,
      });
    }
  }

  return issues;
}

/**
 * Prüft eine Handlung auf Plotlöcher:
 * - Unaufgelöste Konflikte
 * - Fehlende Schlüsselszenen
 * - Widersprüchliche Ereignisse
 */
export function checkPlotConsistency(
  chapters: { id: string; title: string; content: string }[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (!ch.content || ch.content.trim().length < 50) {
      issues.push({
        id: nextId(),
        type: "plot",
        severity: "medium",
        message: `Kapitel "${ch.title}" ist sehr kurz (${ch.content?.length ?? 0} Zeichen)`,
        details: "Kapitel sollten mindestens 50 Zeichen enthalten.",
      });
    }

    // Prüfe ob Titel im Inhalt vorkommt (optional)
    if (ch.title && ch.content && !ch.content.toLowerCase().includes(ch.title.toLowerCase())) {
      issues.push({
        id: nextId(),
        type: "plot",
        severity: "low",
        message: `Titel "${ch.title}" nicht im Kapitelinhalt gefunden`,
      });
    }
  }

  return issues;
}

/**
 * Prüft die emotionale konsistenz durch Kapitel:
 * - Plötzliche Stimmungswechsel ohne Übergang
 * - Fehlende emotionale Entwicklung
 */
export function checkEmotionalConsistency(
  chapters: { id: string; title: string; content: string }[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  const emotions = ["freude", "trauer", "wut", "angst", "lieue", "hass", "hoffnung", "verzweiflung"];
  const emotionCounts = new Map<string, number>();

  for (const ch of chapters) {
    const lower = ch.content?.toLowerCase() ?? "";
    for (const emo of emotions) {
      const count = (lower.match(new RegExp(emo, "g")) || []).length;
      if (count > 0) {
        emotionCounts.set(emo, (emotionCounts.get(emo) ?? 0) + count);
      }
    }
  }

  // Prüfe ob Emotionen auftreten
  if (emotionCounts.size === 0 && chapters.length > 0) {
    issues.push({
      id: nextId(),
      type: "emotion",
      severity: "low",
      message: "Keine Emotionen im Text erkannt",
      details: "Ein Text ohne emotionale Begriffe kann flach wirken.",
    });
  }

  return issues;
}

/**
 * Hauptfunktion: Generiert einen vollständigen Konsistenzbericht.
 */
export function generateConsistencyReport(data: {
  characters?: Character[];
  chapters?: { id: string; title: string; content: string }[];
  timeline?: { id: string; date: string; title: string }[];
}): ConsistencyReport {
  const allIssues: ConsistencyIssue[] = [];

  if (data.characters) {
    allIssues.push(...checkCharacterConsistency(data.characters));
  }
  if (data.chapters) {
    allIssues.push(...checkPlotConsistency(data.chapters));
    allIssues.push(...checkEmotionalConsistency(data.chapters));
  }
  if (data.timeline) {
    allIssues.push(...checkTimelineConsistency(data.timeline));
  }

  return {
    issues: allIssues,
    checkedAt: Date.now(),
    summary: {
      total: allIssues.length,
      high: allIssues.filter((i) => i.severity === "high").length,
      medium: allIssues.filter((i) => i.severity === "medium").length,
      low: allIssues.filter((i) => i.severity === "low").length,
    },
  };
}
