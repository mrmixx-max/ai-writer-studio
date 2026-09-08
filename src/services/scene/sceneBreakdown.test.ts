// Engine-Tests: Scene Breakdown (Sprint 23, Agent 3).
import { describe, it, expect } from "vitest";
import {
  analyzeBreakdown,
  detectConflict,
  exportToCSV,
  extractCharacters,
  parseScenes,
  suggestImprovements,
} from "./sceneBreakdown";

const SAMPLE = `INT. WOHNUNG - TAG

Anna betritt den Raum. Sie sieht sich um.

ANNA
Wo bist du gewesen?

PETER
Ich musste fliehen. Die Gefahr war zu gross.

EXT. STRASSE - NACHT

Peter rennt durch den Regen. Ein Streit eskaliert.

PETER
Lass mich in Ruhe!

ANNA
Der Kampf ist noch nicht vorbei.
`;

describe("parseScenes", () => {
  it("erkennt INT./EXT.-Headings", () => {
    const scenes = parseScenes(SAMPLE);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].heading).toBe("INT. WOHNUNG - TAG");
    expect(scenes[1].heading).toBe("EXT. STRASSE - NACHT");
  });

  it("extrahiert Ort und Tageszeit", () => {
    const scenes = parseScenes(SAMPLE);
    expect(scenes[0].location).toBe("WOHNUNG");
    expect(scenes[0].timeOfDay).toBe("day");
    expect(scenes[1].location).toBe("STRASSE");
    expect(scenes[1].timeOfDay).toBe("night");
  });

  it("ordnet Figuren und Dialoganteile zu", () => {
    const scenes = parseScenes(SAMPLE);
    expect(scenes[0].characters).toContain("ANNA");
    expect(scenes[0].characters).toContain("PETER");
    expect(scenes[0].dialogue).toBeGreaterThan(0);
    expect(scenes[0].dialogue + scenes[0].action + scenes[0].description).toBe(100);
  });

  it("gibt bei leerem Text keine Szenen zurueck", () => {
    expect(parseScenes("")).toEqual([]);
    expect(parseScenes("Nur Prosa ohne Headings.")).toEqual([]);
  });
});

describe("extractCharacters", () => {
  it("erkennt grossgeschriebene Woerter am Zeilenanfang", () => {
    expect(extractCharacters("ANNA\nHallo.\n\nPETER\nHi.\n\nANNA\nNochmal.")).toEqual(["ANNA", "PETER"]);
  });

  it("ignoriert Szenen-Headings und Saetze", () => {
    const chars = extractCharacters("INT. WOHNUNG - TAG\nAnna geht nach Hause.\nWas für ein Tag!");
    expect(chars).not.toContain("INT. WOHNUNG - TAG");
    expect(chars).not.toContain("Anna geht nach Hause.");
  });
});

describe("detectConflict", () => {
  it("erkennt Konflikt-Saetze", () => {
    expect(detectConflict("Alles ist ruhig. Dann eskaliert der Streit.")).toContain("Streit");
  });

  it("gibt undefined ohne Konfliktsignal zurueck", () => {
    expect(detectConflict("Alles ist ruhig und friedlich.")).toBeUndefined();
  });
});

describe("analyzeBreakdown", () => {
  it("berechnet Statistiken", () => {
    const scenes = parseScenes(SAMPLE);
    const b = analyzeBreakdown(scenes);
    expect(b.totalScenes).toBe(2);
    expect(b.locations).toHaveLength(2);
    expect(b.timeDistribution.day).toBe(1);
    expect(b.timeDistribution.night).toBe(1);
    expect(b.averageSceneLength).toBeGreaterThan(0);
    expect(["slow", "medium", "fast"]).toContain(b.pacing);
    const anna = b.characters.find((c) => c.name === "ANNA");
    expect(anna?.sceneCount).toBe(2);
  });

  it("behandelt leere Szenenlisten", () => {
    const b = analyzeBreakdown([]);
    expect(b.totalScenes).toBe(0);
    expect(b.averageSceneLength).toBe(0);
  });
});

describe("suggestImprovements", () => {
  it("gibt Hinweise bei leerem Breakdown", () => {
    expect(suggestImprovements(analyzeBreakdown([]))).toHaveLength(1);
  });

  it("warnt bei Location-Dominanz", () => {
    const b = analyzeBreakdown(parseScenes("INT. LOFT - TAG\nText.\n\nINT. LOFT - NACHT\nText.\n\nINT. LOFT - TAG\nText.\n"));
    const tips = suggestImprovements(b);
    expect(tips.some((t) => t.includes("LOFT"))).toBe(true);
  });
});

describe("exportToCSV", () => {
  it("exportiert Kopfzeile und Szenen", () => {
    const csv = exportToCSV(parseScenes(SAMPLE));
    const lines = csv.split("\n");
    expect(lines[0]).toContain("heading");
    expect(lines).toHaveLength(3);
    expect(csv).toContain("INT. WOHNUNG - TAG");
  });

  it("maskiert Sonderzeichen korrekt", () => {
    const csv = exportToCSV(parseScenes('INT. CAFÉ "CENTRAL" - TAG\nText.'));
    expect(csv).toContain('""CENTRAL""');
  });
});
