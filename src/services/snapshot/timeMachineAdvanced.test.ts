// Tests: Time-Machine & Rollback-Härtung (Advanced).
//
// Ergänzt timeMachine.test.ts um die harten Fälle: kompletter Textaustausch,
// reine Zeichensetzungs-Korrektur, FIFO-Rotation bei 50 Ständen, gesperrter
// Editor-State, leere Snapshots auf beiden Seiten, ungültige IDs, mehrere
// Stände desselben Kapitels und Sonderzeichen. Genau 10 Testfälle.
//
// Die getesteten Funktionen sind rein/deterministisch; localStorage wird im
// node-Setup (src/test/setup.ts) polyfilled. Gemockt wird nur der Editor-State
// in Testfall 4 — dort geht es um die Entkopplung von Persistenz und Editor.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMicroSnapshot,
  listMicroSnapshots,
  diffMicroSnapshots,
  restoreMicroSnapshot,
  clearMicroSnapshots,
  countMicroSnapshots,
  MAX_MICRO_SNAPSHOTS,
  type MicroSnapshot,
} from "@/services/snapshot/timeMachine";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const PROJECT_ID = "proj-advanced-1";
const CHAPTER_ID = "chap-advanced-1";

beforeEach(() => {
  localStorage.clear();
  clearMicroSnapshots(PROJECT_ID);
});

/** Baut einen Snapshot direkt (ohne Persistenz) für Diff-Tests. */
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
// Testfälle
// ---------------------------------------------------------------------------

describe("Time-Machine & Rollback-Härtung", () => {
  // 1 --------------------------------------------------------------------
  it("1. Diff bei komplettem Textaustausch (100% Löschung + 100% Neuanlage)", () => {
    const old = makeSnapshot("Der alte Text steht hier.");
    const neu = makeSnapshot("Ein ganz anderer Inhalt.");

    const diff = diffMicroSnapshots(old, neu);

    // Nichts bleibt erhalten — alles alte weg, alles neue hinzu.
    expect(diff.removed).toEqual(["Der alte Text steht hier."]);
    expect(diff.added).toEqual(["Ein ganz anderer Inhalt."]);
    expect(diff.unchanged).toEqual([]);
  });

  // 2 --------------------------------------------------------------------
  it("2. Diff bei reiner Zeichensetzungs-Korrektur (Whitespace, Kommata)", () => {
    // Reine Whitespace-Änderung darf keinen Diff erzeugen (Normalisierung).
    const wsDiff = diffMicroSnapshots(
      makeSnapshot("Der  Hund   läuft."),
      makeSnapshot("Der Hund läuft."),
    );
    expect(wsDiff.added).toEqual([]);
    expect(wsDiff.removed).toEqual([]);
    expect(wsDiff.unchanged).toEqual(["Der Hund läuft."]);

    // Ein hinzugefügtes Komma ändert den Satz-Token.
    const commaDiff = diffMicroSnapshots(
      makeSnapshot("Der Hund läuft schnell."),
      makeSnapshot("Der Hund läuft, schnell."),
    );
    expect(commaDiff.removed).toEqual(["Der Hund läuft schnell."]);
    expect(commaDiff.added).toEqual(["Der Hund läuft, schnell."]);
    expect(commaDiff.unchanged).toEqual([]);
  });

  // 3 --------------------------------------------------------------------
  it("3. FIFO-Bereinigung: Älteste Snapshots werden bei Limit 50 gelöscht", () => {
    expect(MAX_MICRO_SNAPSHOTS).toBe(50);

    // 55 Stände anlegen — die ersten 5 müssen verworfen werden.
    for (let i = 0; i < 55; i++) {
      createMicroSnapshot(PROJECT_ID, CHAPTER_ID, `stand-${i}`);
    }

    const list = listMicroSnapshots(PROJECT_ID, CHAPTER_ID);
    expect(list).toHaveLength(MAX_MICRO_SNAPSHOTS);

    const contents = list.map((s) => s.content);
    // Die ältesten 5 sind weg …
    for (let i = 0; i < 5; i++) {
      expect(contents).not.toContain(`stand-${i}`);
    }
    // … die neuesten 50 (inkl. des jüngsten Stands) sind erhalten.
    for (let i = 5; i < 55; i++) {
      expect(contents).toContain(`stand-${i}`);
    }
    expect(list[0].content).toBe("stand-54");
  });

  // 4 --------------------------------------------------------------------
  it("4. Wiederherstellung bei gleichzeitig gesperrtem Editor-State", () => {
    const original = "Der Text, der trotz Sperre wiederherstellbar ist.";
    const snap = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, original);

    // Gemockter, gesperrter Editor-State: Das Schreiben wäre verboten.
    const lockedEditor = {
      locked: true,
      setContent: vi.fn(),
    };

    // Die Wiederherstellung liefert den Inhalt unabhängig vom Editor-State.
    const restored = restoreMicroSnapshot(snap);
    expect(restored).toBe(original);

    // Solange gesperrt, wird der Editor nicht beschrieben.
    if (!lockedEditor.locked) {
      lockedEditor.setContent(restored);
    }
    expect(lockedEditor.setContent).not.toHaveBeenCalled();

    // Nach Entsperren wird derselbe (bereits wiederhergestellte) Inhalt gesetzt.
    lockedEditor.locked = false;
    if (!lockedEditor.locked) {
      lockedEditor.setContent(restored);
    }
    expect(lockedEditor.setContent).toHaveBeenCalledWith(original);
  });

  // 5 --------------------------------------------------------------------
  it("5. Diff bei identischen Snapshots (keine Änderungen)", () => {
    const text = "Der Hund läuft. Die Katze schläft.";
    const diff = diffMicroSnapshots(makeSnapshot(text), makeSnapshot(text));

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual(["Der Hund läuft.", "Die Katze schläft."]);
  });

  // 6 --------------------------------------------------------------------
  it("6. Diff bei leerem altem Snapshot", () => {
    const diff = diffMicroSnapshots(
      makeSnapshot(""),
      makeSnapshot("Neuer Text."),
    );

    expect(diff.added).toEqual(["Neuer Text."]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  // 7 --------------------------------------------------------------------
  it("7. Diff bei leerem neuem Snapshot", () => {
    const diff = diffMicroSnapshots(
      makeSnapshot("Alter Text."),
      makeSnapshot(""),
    );

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(["Alter Text."]);
    expect(diff.unchanged).toEqual([]);
  });

  // 8 --------------------------------------------------------------------
  it("8. Restore mit ungültiger Snapshot-ID", () => {
    // Unbekannte ID + fehlender Inhalt → defensiver leerer String, kein Wurf.
    const bogus = {
      id: "msnap_gibt-es-nicht",
      projectId: PROJECT_ID,
      chapterId: CHAPTER_ID,
    } as unknown as MicroSnapshot;

    expect(() => restoreMicroSnapshot(bogus)).not.toThrow();
    expect(restoreMicroSnapshot(bogus)).toBe("");

    // Auch undefined/null bleiben robust.
    expect(restoreMicroSnapshot(undefined as unknown as MicroSnapshot)).toBe("");
    expect(restoreMicroSnapshot(null as unknown as MicroSnapshot)).toBe("");

    // Die ungültige ID hat nichts persistiert.
    expect(countMicroSnapshots(PROJECT_ID, CHAPTER_ID)).toBe(0);
  });

  // 9 --------------------------------------------------------------------
  it("9. Mehrere Snapshots desselben Kapitels", () => {
    const s1 = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Version eins.");
    const s2 = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Version zwei.");
    const s3 = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, "Version drei.");

    const list = listMicroSnapshots(PROJECT_ID, CHAPTER_ID);

    expect(list).toHaveLength(3);
    expect(countMicroSnapshots(PROJECT_ID, CHAPTER_ID)).toBe(3);

    // Alle gehören zu demselben Kapitel, sind aber eindeutig.
    expect(new Set(list.map((s) => s.id)).size).toBe(3);
    expect(list.every((s) => s.chapterId === CHAPTER_ID)).toBe(true);

    // Neueste zuerst (Einfüge-Reihenfolge als Tie-Breaker).
    expect(list.map((s) => s.id)).toEqual([s3.id, s2.id, s1.id]);

    // Rollback auf einen älteren Stand liefert dessen Inhalt exakt zurück.
    expect(restoreMicroSnapshot(list[2])).toBe("Version eins.");
  });

  // 10 -------------------------------------------------------------------
  it("10. Snapshot mit Sonderzeichen im Inhalt", () => {
    const special =
      "„Grüße“, sagte er — mit Ümläuten, ß, Emoji 🐺 und\nZeilenumbruch; 100 % & <tags>.";

    const snap = createMicroSnapshot(PROJECT_ID, CHAPTER_ID, special);

    // Inhalt bleibt byte-genau erhalten (inkl. Emoji und Newline).
    expect(snap.content).toBe(special);
    expect(restoreMicroSnapshot(snap)).toBe(special);

    // Persistierter Round-Trip über localStorage ist verlustfrei.
    const persisted = listMicroSnapshots(PROJECT_ID, CHAPTER_ID);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].content).toBe(special);

    // Unicode-Wortzählung erkennt Buchstaben trotz Sonderzeichen.
    expect(snap.wordCount).toBeGreaterThan(0);
  });
});
