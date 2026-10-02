// Tests: Time-Machine Micro-Snapshots & Visual Diff.
//
// Lokale, deterministische Versionierung ohne LLM. Die Tests decken
// alle vier Kernfunktionen ab plus defensive Fallbacks und Edge Cases.

import { describe, it, expect, beforeEach } from "vitest";
import {
  createMicroSnapshot,
  listMicroSnapshots,
  diffMicroSnapshots,
  restoreMicroSnapshot,
  clearMicroSnapshots,
  countMicroSnapshots,
  type MicroSnapshot,
} from "@/services/snapshot/timeMachine";

// ---------------------------------------------------------------------------
// Test-Setup
// ---------------------------------------------------------------------------

const PROJECT_ID = "proj-test-1";
const CHAPTER_ID = "chap-test-1";

beforeEach(() => {
  localStorage.clear();
  clearMicroSnapshots(PROJECT_ID);
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function makeSnapshot(
  content: string,
  overrides: Partial<MicroSnapshot> = {},
): MicroSnapshot {
  return {
    id: `msnap_${Math.random().toString(36).slice(2, 10)}`,
    projectId: PROJECT_ID,
    chapterId: CHAPTER_ID,
    timestamp: Date.now(),
    wordCount: content.split(/\s+/).filter(Boolean).length,
    content,
    summary: content.slice(0, 120),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: createMicroSnapshot
// ---------------------------------------------------------------------------

describe("createMicroSnapshot", () => {
  it("erstellt einen Snapshot mit allen Pflichtfeldern", () => {
    const content = "Der Hund läuft durch den Park.";
    const snap = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, content);

    expect(snap.id).toBeTruthy();
    expect(snap.projectId).toBe(PROJECT_ID);
    expect(snap.chapterId).toBe(CHAPTER_ID);
    expect(snap.timestamp).toBeGreaterThan(0);
    expect(snap.wordCount).toBe(6);
    expect(snap.content).toBe(content);
    expect(snap.summary).toBeTruthy();
  });

  it("berechnet die Wortzahl korrekt bei leerem Inhalt", () => {
    const snap = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "");

    expect(snap.wordCount).toBe(0);
    expect(snap.content).toBe("");
    expect(snap.summary).toBe("");
  });

  it("erstellt eine Zusammenfassung aus dem Text", () => {
    const longText = "A".repeat(200);
    const snap = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, longText);

    expect(snap.summary.length).toBeLessThanOrEqual(121);
    expect(snap.summary).toContain("…");
  });

  it("behandelt fehlende Eingaben defensiv", () => {
    const snap = createMicroSnapshot("", "", "");

    expect(snap.projectId).toBe("");
    expect(snap.chapterId).toBe("");
    expect(snap.content).toBe("");
    expect(snap.wordCount).toBe(0);
  });

  it("erzeugt eindeutige IDs für mehrere Snapshots", () => {
    const s1 = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Eins");
    const s2 = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Zwei");

    expect(s1.id).not.toBe(s2.id);
  });
});

// ---------------------------------------------------------------------------
// Tests: listMicroSnapshots
// ---------------------------------------------------------------------------

describe("listMicroSnapshots", () => {
  it("gibt ein leeres Array zurück, wenn keine Snapshots existieren", () => {
    const result = listMicroSnapshots(PROJECT_ID, CHAPTER_ID);

    expect(result).toEqual([]);
  });

  it("listet alle Snapshots eines Kapitels auf", () => {
    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Erster Text");
    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Zweiter Text");
    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Dritter Text");

    const result = listMicroSnapshots(PROJECT_ID, CHAPTER_ID);

    expect(result).toHaveLength(3);
  });

  it("sortiert Snapshots nach Zeitstempel (neueste zuerst)", () => {
    const s1 = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Alt");
    const s2 = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Neu");

    const result = listMicroSnapshots(PROJECT_ID, CHAPTER_ID);

    expect(result[0].id).toBe(s2.id);
    expect(result[1].id).toBe(s1.id);
  });

  it("filtert Snapshots nach projectId und chapterId", () => {
    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Richtig");
    createMicroSnapshot(PROJECT_ID, "anderes-kapitel", "Falsch");
    createMicroSnapshot("anderes-projekt", CHAPTER_ID, "Auch falsch");

    const result = listMicroSnapshots(PROJECT_ID, CHAPTER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Richtig");
  });

  it("gibt ein leeres Array bei ungültigen Eingaben zurück", () => {
    const result = listMicroSnapshots("", "");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: diffMicroSnapshots
// ---------------------------------------------------------------------------

describe("diffMicroSnapshots", () => {
  it("erkennt hinzugefügte Sätze", () => {
    const old = makeSnapshot("Der Hund läuft.");
    const neu = makeSnapshot("Der Hund läuft. Die Katze schläft.");

    const diff = diffMicroSnapshots(old, neu);

    expect(diff.added).toContain("Die Katze schläft.");
    expect(diff.removed).toEqual([]);
  });

  it("erkennt entfernte Sätze", () => {
    const old = makeSnapshot("Der Hund läuft. Die Katze schläft.");
    const neu = makeSnapshot("Der Hund läuft.");

    const diff = diffMicroSnapshots(old, neu);

    expect(diff.removed).toContain("Die Katze schläft.");
    expect(diff.added).toEqual([]);
  });

  it("erkennt unveränderte Sätze", () => {
    const old = makeSnapshot("Der Hund läuft. Die Katze schläft.");
    const neu = makeSnapshot("Der Hund läuft. Die Katze schläft.");

    const diff = diffMicroSnapshots(old, neu);

    expect(diff.unchanged).toContain("Der Hund läuft.");
    expect(diff.unchanged).toContain("Die Katze schläft.");
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("behandelt leere Snapshots defensiv", () => {
    const old = makeSnapshot("");
    const neu = makeSnapshot("Neuer Text");

    const diff = diffMicroSnapshots(old, neu);

    expect(diff.added.length).toBeGreaterThan(0);
    expect(diff.removed).toEqual([]);
  });

  it("behandelt null/undefined Snapshots defensiv", () => {
    const diff = diffMicroSnapshots(null as any, undefined as any);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  it("arbeitet auf Wörterbene wenn keine Satzgrenzen vorhanden sind", () => {
    const old = makeSnapshot("Hund Katze Maus");
    const neu = makeSnapshot("Hund Katze Vogel");

    const diff = diffMicroSnapshots(old, neu);

    expect(diff.added).toContain("Vogel");
    expect(diff.removed).toContain("Maus");
    expect(diff.unchanged).toContain("Hund");
    expect(diff.unchanged).toContain("Katze");
  });
});

// ---------------------------------------------------------------------------
// Tests: restoreMicroSnapshot
// ---------------------------------------------------------------------------

describe("restoreMicroSnapshot", () => {
  it("stellt den Originalinhalt wieder her", () => {
    const original = "Der ursprüngliche Text des Kapitels.";
    const snap = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, original);

    const restored = restoreMicroSnapshot(snap);

    expect(restored).toBe(original);
  });

  it("gibt einen leeren String bei ungültigem Snapshot zurück", () => {
    const result = restoreMicroSnapshot(null as any);

    expect(result).toBe("");
  });

  it("gibt einen leeren String bei fehlendem Inhalt zurück", () => {
    const snap = makeSnapshot("");
    snap.content = undefined as any;

    const result = restoreMicroSnapshot(snap);

    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Tests: Hilfsfunktionen
// ---------------------------------------------------------------------------

describe("Hilfsfunktionen", () => {
  it("clearMicroSnapshots entfernt alle Snapshots eines Projekts", () => {
    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Eins");
    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Zwei");
    createMicroSnapshot("anderes-projekt", CHAPTER_ID, "Drei");

    clearMicroSnapshots(PROJECT_ID);

    expect(listMicroSnapshots(PROJECT_ID, CHAPTER_ID)).toHaveLength(0);
    expect(listMicroSnapshots("anderes-projekt", CHAPTER_ID)).toHaveLength(1);
  });

  it("countMicroSnapshots gibt die korrekte Anzahl zurück", () => {
    expect(countMicroSnapshots(PROJECT_ID, CHAPTER_ID)).toBe(0);

    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Eins");
    expect(countMicroSnapshots(PROJECT_ID, CHAPTER_ID)).toBe(1);

    createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Zwei");
    expect(countMicroSnapshots(PROJECT_ID, CHAPTER_ID)).toBe(2);
  });
});
