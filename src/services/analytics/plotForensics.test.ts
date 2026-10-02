// Tests: Plot-Forensik & Wissens-Matrix (WP 22.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  buildKnowledgeMatrix,
  auditChronology,
  trackLooseEnds,
  detectInformationCycles,
} from "./plotForensics";
import type {
  ChapterInput,
  KnowledgeMatrix,
  KnowledgeState,
  KnownFact,
} from "./plotForensics";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

const ch = (
  id: string,
  content: string,
  characters: string[] = [],
): ChapterInput => ({ id, title: `Kapitel ${id}`, content, characters });

/** Matrix serialisierbar machen (Map → sortierte Einträge) für Determinismus. */
function serializeMatrix(matrix: KnowledgeMatrix): string {
  return JSON.stringify(
    Array.from(matrix.characters.entries())
      .map(([name, state]) => [name, state.knownFacts])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

/** Kleine Matrix von Hand bauen (für Zyklus-/Azyklus-Tests). */
function manualMatrix(entries: Array<[string, KnownFact[]]>): KnowledgeMatrix {
  const characters = new Map<string, KnowledgeState>();
  for (const [character, knownFacts] of entries) {
    characters.set(character, { character, knownFacts });
  }
  return { characters };
}

// ---------------------------------------------------------------------------
// buildKnowledgeMatrix
// ---------------------------------------------------------------------------

describe("buildKnowledgeMatrix", () => {
  it("erfasst einen 'von'-Fakt samt Quelle und Kapitel", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna erfährt von Ben, dass der Schlüssel versteckt ist.", [
        "Anna",
        "Ben",
      ]),
    ]);
    const anna = matrix.characters.get("Anna");
    expect(anna).toBeDefined();
    expect(anna?.knownFacts).toEqual([
      { fact: "der Schlüssel versteckt ist", learnedInChapter: 1, learnedFrom: "Ben" },
    ]);
  });

  it("erfasst die 'erzählt'-Form (Quelle nennt die Lernende)", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Ben erzählt Anna, dass er den Brief verbrannt hat.", ["Anna", "Ben"]),
    ]);
    const anna = matrix.characters.get("Anna");
    expect(anna?.knownFacts[0]).toEqual({
      fact: "er den Brief verbrannt hat",
      learnedInChapter: 1,
      learnedFrom: "Ben",
    });
  });

  it("erfasst Eigenbeobachtungen als Quelle 'selbst'", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna entdeckt, dass die Tür offen ist.", ["Anna"]),
    ]);
    expect(matrix.characters.get("Anna")?.knownFacts[0]).toEqual({
      fact: "die Tür offen ist",
      learnedInChapter: 1,
      learnedFrom: "selbst",
    });
  });

  it("erste Lernstufe gewinnt (kein Doppel-Eintrag für denselben Fakt)", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna entdeckt, dass die Tür offen ist.", ["Anna"]),
      ch("2", "Anna entdeckt, dass die Tür offen ist.", ["Anna"]),
    ]);
    const facts = matrix.characters.get("Anna")?.knownFacts ?? [];
    expect(facts).toHaveLength(1);
    expect(facts[0].learnedInChapter).toBe(1);
  });

  it("registriert benannte Quellen auch ohne eigene Fakten", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna erfährt von Ben, dass es regnet.", ["Anna", "Ben"]),
    ]);
    expect(matrix.characters.has("Anna")).toBe(true);
    expect(matrix.characters.get("Ben")?.knownFacts).toEqual([]);
  });

  it("leitet Lernende aus dem Text ab, wenn `characters` fehlt", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna erfährt von Ben, dass es regnet.", []),
    ]);
    expect(matrix.characters.get("Anna")?.knownFacts).toHaveLength(1);
    expect(matrix.characters.get("Anna")?.knownFacts[0].learnedFrom).toBe("Ben");
  });

  it("Kapitelnummern sind 1-basiert und folgen der Array-Reihenfolge", () => {
    const matrix = buildKnowledgeMatrix([
      ch("a", "Anna entdeckt, dass eins stimmt.", ["Anna"]),
      ch("b", "Anna entdeckt, dass zwei stimmt.", ["Anna"]),
    ]);
    const facts = matrix.characters.get("Anna")?.knownFacts ?? [];
    expect(facts.map((f) => f.learnedInChapter).sort()).toEqual([1, 2]);
  });

  it("Figuren ohne Fakten werden trotzdem mit leerer Liste geführt", () => {
    const matrix = buildKnowledgeMatrix([ch("1", "", ["Anna", "Ben"])]);
    expect(matrix.characters.get("Anna")?.knownFacts).toEqual([]);
    expect(matrix.characters.get("Ben")?.knownFacts).toEqual([]);
  });

  it("defensiv: leere Kapitelliste ergibt eine leere Matrix", () => {
    const matrix = buildKnowledgeMatrix([]);
    expect(matrix.characters.size).toBe(0);
  });

  it("defensiv: undefined/null wird wie leer behandelt", () => {
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(buildKnowledgeMatrix(undefined).characters.size).toBe(0);
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(buildKnowledgeMatrix(null).characters.size).toBe(0);
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    const input = [
      ch("1", "Anna erfährt von Ben, dass der Schlüssel versteckt ist.", [
        "Anna",
        "Ben",
      ]),
      ch("2", "Ben entdeckt, dass die Uhr stehen geblieben ist.", ["Ben"]),
    ];
    const a = buildKnowledgeMatrix(input);
    const b = buildKnowledgeMatrix(input);
    expect(serializeMatrix(a)).toBe(serializeMatrix(b));
  });
});

// ---------------------------------------------------------------------------
// detectInformationCycles
// ---------------------------------------------------------------------------

describe("detectInformationCycles", () => {
  it("erkennt einen 2er-Zyklus (A weiß von B, B weiß von A)", () => {
    const matrix = manualMatrix([
      ["Anna", [{ fact: "X", learnedInChapter: 1, learnedFrom: "Ben" }]],
      ["Ben", [{ fact: "X", learnedInChapter: 1, learnedFrom: "Anna" }]],
    ]);
    const cycles = detectInformationCycles(matrix);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toContain("Anna");
    expect(cycles[0].path).toContain("Ben");
  });

  it("azyklische Kette (Carla → Ben → Anna) liefert keine Zyklen", () => {
    const matrix = manualMatrix([
      ["Anna", [{ fact: "X", learnedInChapter: 3, learnedFrom: "Ben" }]],
      ["Ben", [{ fact: "X", learnedInChapter: 2, learnedFrom: "Carla" }]],
      ["Carla", [{ fact: "X", learnedInChapter: 1, learnedFrom: "selbst" }]],
    ]);
    expect(detectInformationCycles(matrix)).toEqual([]);
  });

  it("defensiv: leere/ungültige Matrix liefert ein leeres Array", () => {
    expect(detectInformationCycles({ characters: new Map() })).toEqual([]);
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(detectInformationCycles(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// auditChronology
// ---------------------------------------------------------------------------

describe("auditChronology", () => {
  it("konsequente azyklische Kette liefert keine Verletzung", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna entdeckt, dass die Tür offen ist.", ["Anna"]),
      ch("2", "Anna erzählt Ben, dass die Tür offen ist.", ["Anna", "Ben"]),
    ]);
    expect(auditChronology(matrix)).toEqual([]);
  });

  it("meldet, wenn die Quelle den Fakt erst später kennt", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna erzählt Ben, dass das Geheimnis wahr ist.", ["Anna", "Ben"]),
      ch("2", "Anna entdeckt, dass das Geheimnis wahr ist.", ["Anna"]),
    ]);
    const violations = auditChronology(matrix);
    expect(violations).toHaveLength(1);
    expect(violations[0].character).toBe("Ben");
    expect(violations[0].chapter).toBe(1);
    expect(violations[0].reason).toContain("Quelle Anna");
  });

  it("meldet eine unbegründete Quelle (Quelle kennt den Fakt nie)", () => {
    const matrix = buildKnowledgeMatrix([
      ch("1", "Anna erfährt von Ben, dass der Schlüssel versteckt ist.", [
        "Anna",
        "Ben",
      ]),
    ]);
    const violations = auditChronology(matrix);
    expect(violations).toHaveLength(1);
    expect(violations[0].character).toBe("Anna");
    expect(violations[0].reason).toContain("kennt diesen Fakt an keiner Stelle");
  });

  it("meldet einen zirkulären Informationsfluss als Verletzung", () => {
    const matrix = manualMatrix([
      ["Anna", [{ fact: "X", learnedInChapter: 1, learnedFrom: "Ben" }]],
      ["Ben", [{ fact: "X", learnedInChapter: 1, learnedFrom: "Anna" }]],
    ]);
    const violations = auditChronology(matrix);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("Zirkulärer Informationsfluss");
    expect(violations[0].reason).toContain("Anna");
    expect(violations[0].reason).toContain("Ben");
  });

  it("ist deterministisch sortiert (Kapitel, dann Figur)", () => {
    const matrix = manualMatrix([
      ["Zoe", [{ fact: "P", learnedInChapter: 5, learnedFrom: "Niemand" }]],
      ["Anna", [{ fact: "Q", learnedInChapter: 2, learnedFrom: "Niemand" }]],
    ]);
    const violations = auditChronology(matrix);
    expect(violations.map((v) => v.chapter)).toEqual([2, 5]);
    expect(violations.map((v) => v.character)).toEqual(["Anna", "Zoe"]);
  });

  it("defensiv: leere/ungültige Matrix liefert ein leeres Array", () => {
    expect(auditChronology({ characters: new Map() })).toEqual([]);
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(auditChronology(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// trackLooseEnds
// ---------------------------------------------------------------------------

describe("trackLooseEnds", () => {
  it("findet eine eingeführte Waffe, die nie aufgelöst wird", () => {
    const ends = trackLooseEnds([
      ch("1", "Anna zog ein Messer.", ["Anna"]),
      ch("2", "Sie gingen weiter.", ["Anna"]),
    ]);
    const weapon = ends.find((e) => e.type === "weapon");
    expect(weapon).toBeDefined();
    expect(weapon?.introducedInChapter).toBe(1);
    expect(weapon?.resolved).toBe(false);
    expect(weapon?.description.toLowerCase()).toContain("messer");
  });

  it("markiert eine Requisite als aufgelöst, wenn sie später eingelöst wird", () => {
    const ends = trackLooseEnds([
      ch("1", "Anna zog ein Messer.", ["Anna"]),
      ch("2", "Später benutzte Anna das Messer.", ["Anna"]),
    ]);
    const weapon = ends.find((e) => e.description.toLowerCase().includes("messer"));
    expect(weapon?.resolved).toBe(true);
  });

  it("erkennt einen Hinweis, der im Einführungskapitel NICHT als aufgelöst gilt", () => {
    const ends = trackLooseEnds([
      ch("1", "Am Tatort fand sie einen mysteriösen Hinweis.", ["Anna"]),
      ch("2", "Nichts geschah.", ["Anna"]),
    ]);
    const hint = ends.find((e) => e.type === "hint");
    expect(hint).toBeDefined();
    expect(hint?.resolved).toBe(false);
  });

  it("unterstützt den expliziten Marker [[aufgelöst: …]] in einem späteren Kapitel", () => {
    const ends = trackLooseEnds([
      ch("1", "Ein geheimnisvolles Rätsel.", ["Anna"]),
      ch("2", "Die Wahrheit: [[aufgelöst: rätsel]]", ["Anna"]),
    ]);
    const hint = ends.find((e) => e.type === "hint");
    expect(hint?.resolved).toBe(true);
  });

  it("zählt unaufgelöste Einträge als Alarm", () => {
    const ends = trackLooseEnds([
      ch("1", "Ein Messer und ein Hinweis lagen dort.", ["Anna"]),
      ch("2", "Nichts weiter.", ["Anna"]),
    ]);
    expect(ends.filter((e) => !e.resolved).length).toBeGreaterThanOrEqual(2);
  });

  it("sortiert nach Einführungskapitel, dann Typ", () => {
    const ends = trackLooseEnds([
      ch("1", "Ein Hinweis.", ["Anna"]),
      ch("2", "Ein Messer.", ["Anna"]),
    ]);
    expect(ends.map((e) => e.introducedInChapter)).toEqual([1, 2]);
  });

  it("defensiv: leere/ungültige Eingabe liefert ein leeres Array", () => {
    expect(trackLooseEnds([])).toEqual([]);
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(trackLooseEnds(undefined)).toEqual([]);
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(trackLooseEnds(null)).toEqual([]);
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    const input = [
      ch("1", "Ein Messer und ein Brief.", ["Anna"]),
      ch("2", "Der Brief wurde verbrannt.", ["Anna"]),
    ];
    expect(JSON.stringify(trackLooseEnds(input))).toBe(
      JSON.stringify(trackLooseEnds(input)),
    );
  });
});
