// Tests: Table-Read-Director-Service (WP 45.1 — Rollenverteilung & Sprech-Skript).
//
// Deckt ab: assignRoles, buildTableReadScript, getCurrentSpeaker,
// getSceneChangeCue, formatDirectorMarkup, colorFromName/hashString.
// Rein deterministisch, kein LLM, kein Netzwerkzugriff.
import { describe, it, expect } from "vitest";
import {
  assignRoles,
  buildTableReadScript,
  getCurrentSpeaker,
  getSceneChangeCue,
  formatDirectorMarkup,
  colorFromName,
  hashString,
} from "./tableReadDirector";
import type { TableReadLine } from "./tableReadDirector";
import type { ScreenplayDocument } from "./screenplayTransmuter";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Zweiszenen-Dokument mit zwei Figuren (MARA, JONAS). */
const sampleDoc = (): ScreenplayDocument => ({
  title: "Mein Film",
  scenes: [
    {
      slugline: "INT. KÜCHE - TAG",
      action: ["Mara steht am Herd."],
      dialogue: [
        { character: "MARA", parenthetical: "flüsternd", lines: ["Ich habe es satt."] },
        { character: "JONAS", lines: ["Dann geh doch.", "Niemand hält dich."] },
      ],
    },
    {
      slugline: "EXT. STRAND - NACHT",
      action: ["Mara läuft am Wasser entlang."],
      dialogue: [{ character: "MARA", lines: ["Es ist vorbei."] }],
    },
  ],
});

/** Drei-Figuren-Dokument für Round-Robin-Tests. */
const threeCharacterDoc = (): ScreenplayDocument => ({
  title: "Drei",
  scenes: [
    {
      slugline: "INT. RAUM - TAG",
      action: [],
      dialogue: [
        { character: "A", lines: ["eins"] },
        { character: "B", lines: ["zwei"] },
        { character: "C", lines: ["drei"] },
      ],
    },
  ],
});

const dialogueLine = (overrides: Partial<TableReadLine> = {}): TableReadLine => ({
  index: 0,
  kind: "dialogue",
  character: "MARA",
  speaker: "Anna",
  color: "#AABBCC",
  text: "Ich habe es satt.",
  parenthetical: "flüsternd",
  isSceneChange: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// colorFromName / hashString
// ---------------------------------------------------------------------------

describe("hashString", () => {
  it("ist deterministisch (gleicher Input -> gleicher Hash)", () => {
    expect(hashString("MARA")).toBe(hashString("MARA"));
    expect(hashString("")).toBe(hashString(""));
  });

  it("liefert einen nicht-negativen 32-Bit-Integer", () => {
    const h = hashString("JONAS");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("colorFromName", () => {
  it("liefert eine gültige Hex-Farbe im Format #RRGGBB", () => {
    expect(colorFromName("MARA")).toMatch(/^#[0-9A-F]{6}$/);
    expect(colorFromName("JONAS")).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("ist deterministisch (gleicher Name -> gleiche Farbe)", () => {
    expect(colorFromName("MARA")).toBe(colorFromName("MARA"));
  });

  it("ist case-insensitiv (Groß-/Kleinschreibung egal)", () => {
    expect(colorFromName("mara")).toBe(colorFromName("MARA"));
  });

  it("verteilt unterschiedliche Namen auf unterschiedliche Farben", () => {
    const names = ["MARA", "JONAS", "LEA", "TOM", "ANNA", "BEN", "CLARA", "DAVID"];
    const colors = new Set(names.map(colorFromName));
    // Bei 8 Namen dürfen nicht alle identisch sein.
    expect(colors.size).toBeGreaterThanOrEqual(4);
  });

  it("fällt bei leerem Namen defensiv auf UNBEKANNT zurück", () => {
    expect(colorFromName("")).toBe(colorFromName("UNBEKANNT"));
    expect(colorFromName("   ")).toBe(colorFromName("UNBEKANNT"));
  });
});

// ---------------------------------------------------------------------------
// assignRoles
// ---------------------------------------------------------------------------

describe("assignRoles", () => {
  it("weist jeder Figur eine Farbe und einen Sprecher zu", () => {
    const roles = assignRoles(sampleDoc(), ["Anna", "Ben"]);
    expect(roles.assignments).toHaveLength(2);
    expect(roles.assignments[0]).toEqual({
      character: "MARA",
      speaker: "Anna",
      color: colorFromName("MARA"),
    });
    expect(roles.assignments[1]).toEqual({
      character: "JONAS",
      speaker: "Ben",
      color: colorFromName("JONAS"),
    });
  });

  it("erhält die Erscheinungsreihenfolge der Figuren", () => {
    const roles = assignRoles(threeCharacterDoc(), ["S1", "S2", "S3"]);
    expect(roles.assignments.map((a) => a.character)).toEqual(["A", "B", "C"]);
  });

  it("verteilt Sprecher round-robin bei mehr Figuren als Sprechern", () => {
    const roles = assignRoles(threeCharacterDoc(), ["Anna", "Ben"]);
    expect(roles.assignments.map((a) => a.speaker)).toEqual(["Anna", "Ben", "Anna"]);
  });

  it("ignoriert leere Sprecher-Einträge", () => {
    const roles = assignRoles(threeCharacterDoc(), ["Anna", "  ", "", "Ben"]);
    expect(roles.assignments.map((a) => a.speaker)).toEqual(["Anna", "Ben", "Anna"]);
  });

  it("fällt ohne Sprecher auf den Figurennamen als Sprecher zurück", () => {
    const roles = assignRoles(sampleDoc(), []);
    expect(roles.assignments.map((a) => a.speaker)).toEqual(["MARA", "JONAS"]);
  });

  it("liefert bei leerem Dokument eine leere Zuweisung", () => {
    expect(assignRoles({ title: "X", scenes: [] }, ["Anna"])).toEqual({ assignments: [] });
  });

  it("ist defensiv bei null/undefined-Eingaben", () => {
    expect(assignRoles(null as unknown as ScreenplayDocument, ["Anna"])).toEqual({
      assignments: [],
    });
    expect(
      assignRoles({ title: "X", scenes: null } as unknown as ScreenplayDocument, null as never),
    ).toEqual({ assignments: [] });
  });
});

// ---------------------------------------------------------------------------
// buildTableReadScript
// ---------------------------------------------------------------------------

describe("buildTableReadScript", () => {
  const roles = () => assignRoles(sampleDoc(), ["Anna", "Ben"]);

  it("erzeugt ein lineares Skript mit fortlaufenden Indizes ab 0", () => {
    const script = buildTableReadScript(sampleDoc(), roles());
    expect(script.lines.map((l) => l.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("erzeugt pro Szene eine Szenenzeile mit isSceneChange=true", () => {
    const script = buildTableReadScript(sampleDoc(), roles());
    const sceneLines = script.lines.filter((l) => l.kind === "scene");
    expect(sceneLines).toHaveLength(2);
    expect(sceneLines[0]).toMatchObject({
      index: 0,
      kind: "scene",
      text: "INT. KÜCHE - TAG",
      isSceneChange: true,
    });
    expect(sceneLines[1]).toMatchObject({
      index: 5,
      kind: "scene",
      text: "EXT. STRAND - NACHT",
      isSceneChange: true,
    });
  });

  it("übernimmt Action-Zeilen als kind='action'", () => {
    const script = buildTableReadScript(sampleDoc(), roles());
    const actions = script.lines.filter((l) => l.kind === "action");
    expect(actions.map((l) => l.text)).toEqual([
      "Mara steht am Herd.",
      "Mara läuft am Wasser entlang.",
    ]);
    expect(actions.every((l) => l.isSceneChange === false)).toBe(true);
  });

  it("trägt Figur, Sprecher und Farbe an Dialogzeilen", () => {
    const script = buildTableReadScript(sampleDoc(), roles());
    const mara = script.lines.find((l) => l.index === 2)!;
    expect(mara).toMatchObject({
      kind: "dialogue",
      character: "MARA",
      speaker: "Anna",
      color: colorFromName("MARA"),
      text: "Ich habe es satt.",
    });
    const jonas = script.lines.find((l) => l.index === 3)!;
    expect(jonas).toMatchObject({ character: "JONAS", speaker: "Ben", color: colorFromName("JONAS") });
  });

  it("setzt das Parenthetical nur an die erste Zeile eines Blocks", () => {
    const script = buildTableReadScript(sampleDoc(), roles());
    expect(script.lines[2].parenthetical).toBe("flüsternd");
    expect(script.lines[3].parenthetical).toBeUndefined();
    expect(script.lines[4].parenthetical).toBeUndefined();
  });

  it("zählt Szenen und Figuren korrekt", () => {
    const script = buildTableReadScript(sampleDoc(), roles());
    expect(script.sceneCount).toBe(2);
    expect(script.characterCount).toBe(2);
  });

  it("fällt bei fehlender Rollenzuweisung auf Figurenname/Farbe zurück", () => {
    const script = buildTableReadScript(sampleDoc(), { assignments: [] });
    const line = script.lines.find((l) => l.index === 2)!;
    expect(line.speaker).toBe("MARA");
    expect(line.color).toBe(colorFromName("MARA"));
  });

  it("liefert bei leerem Dokument ein leeres Skript", () => {
    const script = buildTableReadScript({ title: "X", scenes: [] }, { assignments: [] });
    expect(script.lines).toEqual([]);
    expect(script.sceneCount).toBe(0);
    expect(script.characterCount).toBe(0);
  });

  it("ist defensiv bei null/undefined-Eingaben", () => {
    expect(buildTableReadScript(null as unknown as ScreenplayDocument, null as never)).toEqual({
      lines: [],
      sceneCount: 0,
      characterCount: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// getCurrentSpeaker
// ---------------------------------------------------------------------------

describe("getCurrentSpeaker", () => {
  const script = () => buildTableReadScript(sampleDoc(), assignRoles(sampleDoc(), ["Anna", "Ben"]));

  it("liefert die Dialogzeile am Index", () => {
    const line = getCurrentSpeaker(script(), 2);
    expect(line).not.toBeNull();
    expect(line!.speaker).toBe("Anna");
    expect(line!.character).toBe("MARA");
  });

  it("liefert null an einer Nicht-Dialogzeile (Szene/Action)", () => {
    expect(getCurrentSpeaker(script(), 0)).toBeNull();
    expect(getCurrentSpeaker(script(), 1)).toBeNull();
  });

  it("liefert null außerhalb des gültigen Bereichs", () => {
    expect(getCurrentSpeaker(script(), 999)).toBeNull();
    expect(getCurrentSpeaker(script(), -1)).toBeNull();
  });

  it("ist defensiv bei ungültigem Skript", () => {
    expect(getCurrentSpeaker(null as never, 0)).toBeNull();
    expect(getCurrentSpeaker({ lines: null } as never, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSceneChangeCue
// ---------------------------------------------------------------------------

describe("getSceneChangeCue", () => {
  const script = () => buildTableReadScript(sampleDoc(), assignRoles(sampleDoc(), ["Anna", "Ben"]));

  it("erkennt den Szenenwechsel an einer Szenenzeile", () => {
    expect(getSceneChangeCue(script(), 0)).toBe(true);
    expect(getSceneChangeCue(script(), 5)).toBe(true);
  });

  it("liefert false an Action- und Dialogzeilen", () => {
    expect(getSceneChangeCue(script(), 1)).toBe(false);
    expect(getSceneChangeCue(script(), 2)).toBe(false);
  });

  it("liefert false außerhalb des gültigen Bereichs", () => {
    expect(getSceneChangeCue(script(), -1)).toBe(false);
    expect(getSceneChangeCue(script(), 999)).toBe(false);
  });

  it("ist defensiv bei ungültigem Skript", () => {
    expect(getSceneChangeCue(null as never, 0)).toBe(false);
    expect(getSceneChangeCue({ lines: null } as never, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatDirectorMarkup
// ---------------------------------------------------------------------------

describe("formatDirectorMarkup", () => {
  it("hebt eine Szenenzeile hervor", () => {
    const out = formatDirectorMarkup({
      index: 0,
      kind: "scene",
      text: "INT. KÜCHE - TAG",
      isSceneChange: true,
    });
    expect(out).toBe("### INT. KÜCHE - TAG ###");
  });

  it("hebt eine Action-Zeile (Regieanweisung) hervor", () => {
    const out = formatDirectorMarkup({
      index: 1,
      kind: "action",
      text: "Mara steht am Herd.",
      isSceneChange: false,
    });
    expect(out).toBe("*Mara steht am Herd.*");
  });

  it("markiert das Parenthetical als Regieanweisung und nennt den Sprecher", () => {
    const out = formatDirectorMarkup(dialogueLine());
    expect(out).toBe("Anna (als MARA) [[REGIE: flüsternd]]: Ich habe es satt.");
  });

  it("lässt den Regie-Zusatz ohne Parenthetical weg", () => {
    const out = formatDirectorMarkup(dialogueLine({ parenthetical: undefined }));
    expect(out).toBe("Anna (als MARA): Ich habe es satt.");
  });

  it("nennt nur den Sprecher, wenn dieser der Figur entspricht", () => {
    const out = formatDirectorMarkup(
      dialogueLine({ speaker: "MARA", character: "MARA", parenthetical: undefined }),
    );
    expect(out).toBe("MARA: Ich habe es satt.");
  });

  it("ist defensiv bei null/undefined", () => {
    expect(formatDirectorMarkup(null as never)).toBe("");
    expect(formatDirectorMarkup(undefined as never)).toBe("");
  });
});
