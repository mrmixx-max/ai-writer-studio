// Tests: Beziehungs-Chemie & Funken-Matrix (WP 52.1).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  analyzeRelationshipChemistry,
  detectTensionDrop,
  trackPhaseProgression,
  PHASES,
  UNKNOWN_SPEAKER,
  BANTER_MAX_WORDS,
  PHASE_SATURATION_LINES,
  SCENES_PER_PHASE,
  TENSION_DROP_THRESHOLD,
} from "./relationshipChemistry";
import type {
  DialogueLine,
  ChapterScene,
  RelationshipChemistry,
  PhaseProgression,
} from "./relationshipChemistry";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Dialogzeile bauen. */
function line(speaker: string, text: string, chapter = 1): DialogueLine {
  return { speaker, text, chapter };
}

/** Kapitel-Szene bauen (Standard-Paar Anna/Ben). */
function scene(chapter: number, hasLoadedScene: boolean): ChapterScene {
  return { chapter, characterA: "Anna", characterB: "Ben", hasLoadedScene };
}

/** Kapitel 1..n als Szenen mit gesetztem Lade-Flag. */
function run(from: number, to: number, loaded: boolean): ChapterScene[] {
  const out: ChapterScene[] = [];
  for (let c = from; c <= to; c++) out.push(scene(c, loaded));
  return out;
}

/** Null-Ergebnis der Chemie-Analyse. */
const EMPTY_CHEMISTRY: RelationshipChemistry = {
  banterIndex: 0,
  banterRatio: 0,
  interruptions: 0,
  teasingCount: 0,
  phase: "hostility",
  phaseProgress: 0,
};

// ---------------------------------------------------------------------------
// 1) analyzeRelationshipChemistry
// ---------------------------------------------------------------------------

describe("analyzeRelationshipChemistry", () => {
  it("liefert ein Null-Ergebnis für leere oder ungültige Eingaben", () => {
    expect(analyzeRelationshipChemistry([])).toEqual(EMPTY_CHEMISTRY);
    expect(
      analyzeRelationshipChemistry(undefined as unknown as DialogueLine[]),
    ).toEqual(EMPTY_CHEMISTRY);
    expect(
      analyzeRelationshipChemistry(null as unknown as DialogueLine[]),
    ).toEqual(EMPTY_CHEMISTRY);
    expect(
      analyzeRelationshipChemistry(42 as unknown as DialogueLine[]),
    ).toEqual(EMPTY_CHEMISTRY);
  });

  it("zählt kurze Erwiderungen zwischen Sprechern als Schlagabtausch", () => {
    const lines = [
      line("Anna", "Hast du den Schlüssel"),
      line("Ben", "Nein"),
      line("Anna", "Doch"),
      line("Ben", "Nein"),
    ];
    const chem = analyzeRelationshipChemistry(lines);
    // 3 Erwiderungen von 4 Aussagen.
    expect(chem.banterRatio).toBe(0.75);
    // 0.6 * 0.75 + 0.4 * 0 = 0.45 → 45.0
    expect(chem.banterIndex).toBe(45);
    expect(chem.interruptions).toBe(0);
    expect(chem.teasingCount).toBe(0);
    expect(chem.phase).toBe("hostility");
    expect(chem.phaseProgress).toBe(0);
  });

  it("gewichtet Witz-Marker in den Banter-Index ein", () => {
    const lines = [
      line("Anna", "Na klar, das glaube ich dir"),
      line("Ben", "Haha"),
    ];
    const chem = analyzeRelationshipChemistry(lines);
    // retortDensity 1/2, witDensity 2/2 → 0.6*0.5 + 0.4*1 = 0.7 → 70
    expect(chem.banterIndex).toBe(70);
    expect(chem.banterRatio).toBe(0.5);
    expect(chem.teasingCount).toBe(1); // nur "Haha"
  });

  it("rundet die Schlagabtausch-Quote auf drei Nachkommastellen", () => {
    const lines = [line("Anna", "Hallo"), line("Ben", "Hi"), line("Anna", "Ja")];
    const chem = analyzeRelationshipChemistry(lines);
    expect(chem.banterRatio).toBe(0.667); // 2/3
  });

  it("erkennt Unterbrechungen an einem abschließenden Gedankenstrich", () => {
    const lines = [
      line("Anna", "Ich wollte nur—"),
      line("Ben", "Lass mich ausreden"),
      line("Anna", "Aber—"),
    ];
    const chem = analyzeRelationshipChemistry(lines);
    expect(chem.interruptions).toBe(2);
  });

  it("zählt Zeilen mit Neckerei-Markern", () => {
    const lines = [
      line("Anna", "Du bist so witzig"),
      line("Ben", "Hör auf zu necken"),
      line("Anna", "Ich scherze nur"),
    ];
    expect(analyzeRelationshipChemistry(lines).teasingCount).toBe(3);
  });

  it("erkennt die Phase hostility samt Ausprägung", () => {
    const lines = [
      line("Anna", "Ich hasse dich, du Idiot"),
      line("Ben", "Verschwinde"),
    ];
    const chem = analyzeRelationshipChemistry(lines);
    expect(chem.phase).toBe("hostility");
    expect(chem.phaseProgress).toBe(0.667); // 2 von 3 Marker-Zeilen
  });

  it("erkennt die Phase reluctant-respect", () => {
    const lines = [
      line("Anna", "Zugegeben, das war nicht schlecht"),
      line("Ben", "Du hast recht"),
    ];
    expect(analyzeRelationshipChemistry(lines).phase).toBe("reluctant-respect");
  });

  it("erkennt die Phase vulnerability", () => {
    const lines = [line("Anna", "Ich habe Angst"), line("Ben", "Ich vertraue dir")];
    expect(analyzeRelationshipChemistry(lines).phase).toBe("vulnerability");
  });

  it("erkennt die Phase devotion", () => {
    const lines = [
      line("Anna", "Ich liebe dich"),
      line("Ben", "Bleib bei mir, für immer"),
    ];
    expect(analyzeRelationshipChemistry(lines).phase).toBe("devotion");
  });

  it("entscheidet Gleichstand zwischen Phasen für die spätere Phase", () => {
    const lines = [line("Anna", "Ich hasse dich"), line("Ben", "Ich liebe dich")];
    const chem = analyzeRelationshipChemistry(lines);
    expect(chem.phase).toBe("devotion");
    expect(chem.phaseProgress).toBe(0.333); // 1 von 3
  });

  it("sättigt phaseProgress bei drei oder mehr Marker-Zeilen", () => {
    const lines = [
      line("Anna", "Ich liebe dich"),
      line("Ben", "Für immer"),
      line("Anna", "Bleib bei mir"),
      line("Ben", "Mein Herz gehört dir"),
    ];
    const chem = analyzeRelationshipChemistry(lines);
    expect(chem.phase).toBe("devotion");
    expect(chem.phaseProgress).toBe(1);
  });

  it("setzt fehlende oder leere Sprecher defensiv auf den Standardnamen", () => {
    const lines = [
      line("", "Hallo Welt"),
      { text: "Guten Tag" } as unknown as DialogueLine,
    ];
    const chem = analyzeRelationshipChemistry(lines);
    expect(chem).toEqual(
      expect.objectContaining({ banterRatio: 0, phase: "hostility" }),
    );
  });

  it("verwirft ungültige Einträge und wirft nicht", () => {
    const lines = [
      line("Anna", "Hallo Welt"),
      null as unknown as DialogueLine,
      42 as unknown as DialogueLine,
      { speaker: "Ben", text: "" } as unknown as DialogueLine,
      { speaker: "Ben", text: "   " } as unknown as DialogueLine,
    ];
    expect(() => analyzeRelationshipChemistry(lines)).not.toThrow();
    expect(analyzeRelationshipChemistry(lines).banterRatio).toBe(0);
  });

  it("liefert bei wiederholter Ausführung identische Ergebnisse", () => {
    const lines = [line("Anna", "Na klar"), line("Ben", "Haha"), line("Anna", "Pff")];
    expect(analyzeRelationshipChemistry(lines)).toEqual(
      analyzeRelationshipChemistry(lines),
    );
  });
});

// ---------------------------------------------------------------------------
// 2) detectTensionDrop
// ---------------------------------------------------------------------------

describe("detectTensionDrop", () => {
  it("liefert null für leere oder ungültige Eingaben", () => {
    expect(detectTensionDrop([])).toBeNull();
    expect(detectTensionDrop(undefined as unknown as ChapterScene[])).toBeNull();
    expect(detectTensionDrop(null as unknown as ChapterScene[])).toBeNull();
    expect(detectTensionDrop(42 as unknown as ChapterScene[])).toBeNull();
  });

  it("meldet keinen Abfall bei genau sechs Kapiteln ohne geladene Szene", () => {
    expect(detectTensionDrop(run(1, 6, false))).toBeNull();
  });

  it("warnt bei mehr als sechs Kapiteln ohne geladene Szene", () => {
    const warning = detectTensionDrop(run(1, 7, false));
    expect(warning).not.toBeNull();
    expect(warning!.startChapter).toBe(1);
    expect(warning!.endChapter).toBe(7);
    expect(warning!.reason).toContain("7");
  });

  it("wählt den längsten Lauf ohne geladene Szene", () => {
    const scenes = [...run(1, 4, false), scene(5, true), ...run(6, 13, false), scene(14, true)];
    const warning = detectTensionDrop(scenes);
    expect(warning!.startChapter).toBe(6);
    expect(warning!.endChapter).toBe(13);
  });

  it("wählt bei gleich langen Läufen den frühesten", () => {
    const scenes = [...run(1, 7, false), scene(8, true), ...run(9, 15, false)];
    const warning = detectTensionDrop(scenes);
    expect(warning!.startChapter).toBe(1);
    expect(warning!.endChapter).toBe(7);
  });

  it("setzt den Lauf bei einer geladenen Szene zurück", () => {
    const scenes = [scene(1, true), scene(2, false), scene(3, true), ...run(4, 10, false)];
    const warning = detectTensionDrop(scenes);
    expect(warning!.startChapter).toBe(4);
    expect(warning!.endChapter).toBe(10);
  });

  it("sortiert unsortierte Kapitel stabil nach Kapitelnummer", () => {
    const scenes = [scene(7, false), scene(1, false), scene(3, false), scene(2, false),
      scene(5, false), scene(4, false), scene(6, false)];
    const warning = detectTensionDrop(scenes);
    expect(warning!.startChapter).toBe(1);
    expect(warning!.endChapter).toBe(7);
  });

  it("behandelt nicht-boolesche Lade-Flags defensiv als false", () => {
    const scenes = run(1, 7, false).map(
      (s) => ({ ...s, hasLoadedScene: "yes" }) as unknown as ChapterScene,
    );
    expect(detectTensionDrop(scenes)).not.toBeNull();
  });

  it("verwirft ungültige Einträge und wirft nicht", () => {
    const scenes = [
      null as unknown as ChapterScene,
      42 as unknown as ChapterScene,
      { chapter: "x", hasLoadedScene: false } as unknown as ChapterScene,
      ...run(1, 7, false),
    ];
    expect(() => detectTensionDrop(scenes)).not.toThrow();
    expect(detectTensionDrop(scenes)!.startChapter).toBe(1);
  });

  it("liefert bei wiederholter Ausführung identische Ergebnisse", () => {
    const scenes = run(1, 8, false);
    expect(detectTensionDrop(scenes)).toEqual(detectTensionDrop(scenes));
  });
});

// ---------------------------------------------------------------------------
// 3) trackPhaseProgression
// ---------------------------------------------------------------------------

describe("trackPhaseProgression", () => {
  const EMPTY: PhaseProgression = {
    currentPhase: "hostility",
    progress: 0,
    nextPhase: "reluctant-respect",
  };

  it("liefert die Startphase für leere oder ungültige Eingaben", () => {
    expect(trackPhaseProgression([])).toEqual(EMPTY);
    expect(trackPhaseProgression(undefined as unknown as ChapterScene[])).toEqual(EMPTY);
    expect(trackPhaseProgression(null as unknown as ChapterScene[])).toEqual(EMPTY);
  });

  it("bleibt in hostility bei einer geladenen Szene", () => {
    const prog = trackPhaseProgression([scene(1, true)]);
    expect(prog.currentPhase).toBe("hostility");
    expect(prog.progress).toBe(0.333);
    expect(prog.nextPhase).toBe("reluctant-respect");
  });

  it("steigt nach drei geladenen Szenen in reluctant-respect", () => {
    const prog = trackPhaseProgression(run(1, 3, true));
    expect(prog.currentPhase).toBe("reluctant-respect");
    expect(prog.progress).toBe(0);
    expect(prog.nextPhase).toBe("vulnerability");
  });

  it("erreicht nach sechs geladenen Szenen vulnerability", () => {
    const prog = trackPhaseProgression(run(1, 6, true));
    expect(prog.currentPhase).toBe("vulnerability");
    expect(prog.nextPhase).toBe("devotion");
  });

  it("erreicht nach neun geladenen Szenen die Endphase devotion", () => {
    const prog = trackPhaseProgression(run(1, 9, true));
    expect(prog.currentPhase).toBe("devotion");
    expect(prog.progress).toBe(1);
    expect(prog.nextPhase).toBeNull();
  });

  it("begrenzt die Endphase auch bei vielen weiteren geladenen Szenen", () => {
    const prog = trackPhaseProgression(run(1, 12, true));
    expect(prog.currentPhase).toBe("devotion");
    expect(prog.progress).toBe(1);
    expect(prog.nextPhase).toBeNull();
  });

  it("zählt nur geladene Szenen, nicht die Gesamtzahl", () => {
    const scenes = [scene(1, true), scene(2, false), scene(3, true), scene(4, false), scene(5, true)];
    const prog = trackPhaseProgression(scenes);
    expect(prog.currentPhase).toBe("reluctant-respect");
    expect(prog.progress).toBe(0);
  });

  it("liefert bei wiederholter Ausführung identische Ergebnisse", () => {
    const scenes = [scene(1, true), scene(2, true)];
    expect(trackPhaseProgression(scenes)).toEqual(trackPhaseProgression(scenes));
  });
});

// ---------------------------------------------------------------------------
// Vertrag / Konstanten
// ---------------------------------------------------------------------------

describe("Vertrag", () => {
  it("führt die Phasen in fester Reihenfolge", () => {
    expect([...PHASES]).toEqual([
      "hostility",
      "reluctant-respect",
      "vulnerability",
      "devotion",
    ]);
  });

  it("setzt die dokumentierten Schwellen deterministisch", () => {
    expect(UNKNOWN_SPEAKER).toBe("Unbekannt");
    expect(BANTER_MAX_WORDS).toBe(8);
    expect(PHASE_SATURATION_LINES).toBe(3);
    expect(SCENES_PER_PHASE).toBe(3);
    expect(TENSION_DROP_THRESHOLD).toBe(6);
  });
});
