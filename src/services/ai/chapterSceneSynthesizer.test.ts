/**
 * Tests: chapterSceneSynthesizer (WP 60.1 — Gesamt-Kapitel-Synthesizer)
 */

import { describe, it, expect } from "vitest";
import {
  synthesizeChapter,
  buildSceneBridge,
  analyzeChapterCadence,
  ROLE_LABELS,
  type SceneRole,
} from "./chapterSceneSynthesizer";

const INPUT = {
  number: 7,
  title: "Der Morgen danach",
  beats: [
    "Mira wacht im kalten Zimmer auf",
    "Der Wirt stellt die falsche Frage",
    "Die Tür fliegt auf und der Wächter steht darin",
    "Mira bleibt allein zurück",
  ],
  location: "Im Gasthaus am Kai",
  protagonist: "Mira",
  antagonist: "Der Wächter",
};

describe("chapterSceneSynthesizer — synthesizeChapter", () => {
  it("erzeugt ein Kapitel", () => {
    const c = synthesizeChapter(INPUT);
    expect(c.text.length).toBeGreaterThan(200);
    expect(c.wordCount).toBeGreaterThan(50);
  });

  it("erzeugt vier Szenen", () => {
    const c = synthesizeChapter(INPUT);
    expect(c.sceneCount).toBe(4);
    expect(c.scenes.length).toBe(4);
  });

  it("bildet die vier dramaturgischen Rollen ab", () => {
    const c = synthesizeChapter(INPUT);
    const roles: SceneRole[] = ["hook", "complication", "turning-point", "resolution"];
    expect(c.scenes.map((s) => s.role)).toEqual(roles);
  });

  it("benennt die Rollen", () => {
    const c = synthesizeChapter(INPUT);
    expect(c.scenes[0].roleLabel).toBe("Atmosphärischer Haken");
    expect(c.scenes[2].roleLabel).toBe("Unerwarteter Wendepunkt");
  });

  it("verwendet die Beats", () => {
    const c = synthesizeChapter(INPUT);
    expect(c.text).toContain("Mira wacht im kalten Zimmer auf");
    expect(c.text).toContain("Der Wirt stellt die falsche Frage");
  });

  it("übernimmt Nummer und Titel", () => {
    const c = synthesizeChapter(INPUT);
    expect(c.number).toBe(7);
    expect(c.title).toBe("Der Morgen danach");
  });

  it("folgt der Geschwindigkeits-Regel", () => {
    const c = synthesizeChapter(INPUT);
    expect(c.scenes[0].cadence).toBe("slow");
    expect(c.scenes[1].cadence).toBe("medium");
    expect(c.scenes[2].cadence).toBe("fast");
    expect(c.scenes[3].cadence).toBe("medium");
  });

  it("ist deterministisch", () => {
    const a = synthesizeChapter(INPUT);
    const b = synthesizeChapter(INPUT);
    expect(a.text).toBe(b.text);
  });

  it("trennt Szenen mit Leerzeile", () => {
    const c = synthesizeChapter(INPUT);
    expect(c.text.split("\n\n").length).toBe(4);
  });

  it("nennt den Ort in der Eröffnung", () => {
    const c = synthesizeChapter({ location: "Der Leuchtturm" });
    expect(c.scenes[0].prose).toContain("Der Leuchtturm");
  });

  it("nennt den Ort auch wenn Beats vorhanden sind", () => {
    const c = synthesizeChapter({ location: "Der Leuchtturm", beats: ["Ein Beat"] });
    expect(c.scenes[0].prose).toContain("Der Leuchtturm");
  });

  it("wiederholt keine Sinnesdetails in einer Szene", () => {
    const c = synthesizeChapter({ location: "X", beats: [] });
    const hook = c.scenes[0].prose;
    const sentences = hook.split(/(?<=\.)\s+/).filter((s) => s.trim().length > 0);
    // Kein Satz darf zweimal wörtlich vorkommen.
    const normalized = sentences.map((s) => s.trim());
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it("wiederholt keine Dialogzeilen in einer Szene", () => {
    const c = synthesizeChapter({ beats: [] });
    const complication = c.scenes[1].prose;
    const lines = complication.split(/(?<=[.!?"])\s+/).filter((s) => s.includes(":"));
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("nennt den Antagonisten bei der Auflösung", () => {
    const c = synthesizeChapter({ ...INPUT, antagonist: "Kessler" });
    expect(c.text).toContain("Kessler");
  });

  it("jede Szene endet mit Satzzeichen", () => {
    const c = synthesizeChapter(INPUT);
    c.scenes.forEach((s) => {
      expect(/[.!?»"]$/.test(s.prose.trim())).toBe(true);
    });
  });

  it("berechnet die Wortzahl je Szene", () => {
    const c = synthesizeChapter(INPUT);
    c.scenes.forEach((s) => {
      expect(s.wordCount).toBeGreaterThan(0);
    });
  });

  it("kommt ohne Beats zurecht", () => {
    const c = synthesizeChapter({ title: "Ohne Beats" });
    expect(c.sceneCount).toBe(4);
    expect(c.wordCount).toBeGreaterThan(40);
  });

  it("kommt ohne Optionen zurecht", () => {
    const c = synthesizeChapter();
    expect(c.sceneCount).toBe(4);
    expect(c.number).toBe(1);
    expect(c.title).toBe("Kapitel 1");
  });

  it("kommt mit null zurecht", () => {
    expect(synthesizeChapter(null).sceneCount).toBe(4);
    expect(synthesizeChapter(undefined).wordCount).toBeGreaterThan(30);
  });

  it("ignoriert ungültige Beats", () => {
    const c = synthesizeChapter({ beats: [null, 42, "  ", "Ein echter Beat"] as never });
    expect(c.text).toContain("Ein echter Beat");
  });

  it("begrenzt auf maximal 6 Beats", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const c = synthesizeChapter({ beats: many });
    expect(c.sceneCount).toBe(4);
  });

  it("mutiert die Eingabe nicht", () => {
    const copy = JSON.parse(JSON.stringify(INPUT));
    synthesizeChapter(INPUT);
    expect(INPUT).toEqual(copy);
  });

  it("exportiert die Rollen-Labels", () => {
    expect(ROLE_LABELS.hook).toBe("Atmosphärischer Haken");
    expect(ROLE_LABELS.resolution).toBe("Ausklang oder Cliffhanger");
  });
});

describe("chapterSceneSynthesizer — buildSceneBridge", () => {
  it("erzeugt eine Brücke", () => {
    const b = buildSceneBridge("Szene A", "Szene B", "time");
    expect(b.text.length).toBeGreaterThan(15);
    expect(b.kind).toBe("time");
  });

  it("unterstützt alle drei Brücken-Arten", () => {
    (["time", "place", "mood"] as const).forEach((k) => {
      expect(buildSceneBridge("A", "B", k).kind).toBe(k);
    });
  });

  it("unterschiedliche Arten erzeugen unterschiedlichen Text", () => {
    const a = buildSceneBridge("A", "B", "time");
    const b = buildSceneBridge("A", "B", "mood");
    expect(a.text).not.toBe(b.text);
  });

  it("ist deterministisch", () => {
    const a = buildSceneBridge("A", "B", "place");
    const b = buildSceneBridge("A", "B", "place");
    expect(a.text).toBe(b.text);
  });

  it("fällt bei unbekannter Art auf mood zurück", () => {
    expect(buildSceneBridge("A", "B", "unbekannt").kind).toBe("mood");
  });

  it("endet mit Satzzeichen", () => {
    expect(/[.!?]$/.test(buildSceneBridge("A", "B").text.trim())).toBe(true);
  });

  it("berechnet die Wortzahl", () => {
    expect(buildSceneBridge("A", "B").wordCount).toBeGreaterThan(3);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(buildSceneBridge().text.length).toBeGreaterThan(10);
    expect(buildSceneBridge(null, null).kind).toBe("mood");
  });
});

describe("chapterSceneSynthesizer — analyzeChapterCadence", () => {
  it("analysiert ein Kapitel", () => {
    const c = synthesizeChapter(INPUT);
    const a = analyzeChapterCadence(c.text);
    expect(a.values.length).toBe(4);
    expect(a.perScene.length).toBe(4);
  });

  it("erkennt hohes Tempo bei kurzen Sätzen", () => {
    const a = analyzeChapterCadence("Kein Ausweg. Zu spät. Jetzt.");
    expect(a.values[0]).toBeGreaterThan(0.5);
  });

  it("erkennt niedriges Tempo bei langen Sätzen", () => {
    const a = analyzeChapterCadence(
      "Der Wind trug den Geruch von nassem Holz über die Dächer und durch die offenen Fenster des alten Hauses am Kai.",
    );
    expect(a.values[0]).toBeLessThan(0.5);
  });

  it("Werte bleiben zwischen 0 und 1", () => {
    const c = synthesizeChapter(INPUT);
    analyzeChapterCadence(c.text).values.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it("findet die Kadenz-Spitze", () => {
    const a = analyzeChapterCadence("Ein langer Satz mit vielen Wörtern darin.\n\nKurz. Hart. Jetzt.");
    expect(a.peakIndex).toBe(1);
  });

  it("erkennt gute Pacing-Form", () => {
    const a = analyzeChapterCadence(
      "Ein langer Satz mit vielen Wörtern und reichlich Details darin, der sich hinzieht.\n\nKurz. Hart. Jetzt.",
    );
    expect(a.wellPaced).toBe(true);
  });

  it("meldet schlechtes Pacing bei sofortiger Spitze", () => {
    const a = analyzeChapterCadence(
      "Kurz. Hart.\n\nEin langer Satz mit vielen Wörtern und reichlich Details darin, der sich hinzieht.",
    );
    expect(a.wellPaced).toBe(false);
  });

  it("kommt mit leerem Input zurecht", () => {
    const a = analyzeChapterCadence("");
    expect(a.values).toEqual([]);
    expect(a.wellPaced).toBe(false);
    expect(analyzeChapterCadence(null).perScene).toEqual([]);
    expect(analyzeChapterCadence(undefined).peakIndex).toBe(0);
  });
});
