// Tests: CLI-Flags der Prompt-Library (Sprint 6, Agent 2).
//
// --genre=, --audience=, --tone=, --length=, --prompts= — Parsing,
// Formatierung und Validierung des Library-Overrides.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  parsePromptArgs,
  formatPromptFlags,
  loadPromptLibraryOverride,
} from "./promptArgs";

describe("parsePromptArgs", () => {
  it("liest alle fünf Flags", () => {
    const flags = parsePromptArgs([
      "node", "cli",
      "--genre=fiction-thriller",
      "--audience=Thriller-Leser",
      "--tone=temporeich",
      "--length=10x2200",
      "--prompts=/tmp/custom.json",
    ]);
    expect(flags.genre).toBe("fiction-thriller");
    expect(flags.audience).toBe("Thriller-Leser");
    expect(flags.tone).toBe("temporeich");
    expect(flags.chapterCount).toBe(10);
    expect(flags.wordsPerChapter).toBe(2200);
    expect(flags.promptsPath).toBe("/tmp/custom.json");
  });

  it("ohne Flags → alles null (neutral, keine Breaking Changes)", () => {
    const flags = parsePromptArgs(["node", "cli"]);
    expect(flags).toEqual({
      genre: null, audience: null, tone: null,
      chapterCount: null, wordsPerChapter: null, promptsPath: null,
    });
  });

  it("--length ohne gültiges Muster wird ignoriert (kein Crash)", () => {
    expect(parsePromptArgs(["--length=12 Kapitel"]).chapterCount).toBeNull();
    expect(parsePromptArgs(["--length=12"]).wordsPerChapter).toBeNull();
    expect(parsePromptArgs(["--length=xAy"]).genre).toBeNull();
  });

  it("Werte mit Leerzeichen und Bindestrichen", () => {
    const flags = parsePromptArgs(["--genre=sachbuch-it", "--tone=sachlich-nah"]);
    expect(flags.genre).toBe("sachbuch-it");
    expect(flags.tone).toBe("sachlich-nah");
  });
});

describe("formatPromptFlags", () => {
  it("formatiert gesetzte Flags als Zeile", () => {
    const line = formatPromptFlags({
      genre: "sachbuch-it", audience: "DevOps", tone: "präzise",
      chapterCount: 12, wordsPerChapter: 2500, promptsPath: null,
    });
    expect(line).toContain("Genre-Profil: sachbuch-it");
    expect(line).toContain("Zielgruppe: DevOps");
    expect(line).toContain("Tonalität: präzise");
    expect(line).toContain("Umfang: 12 Kapitel à 2500 Wörter");
  });

  it("leer bei keinen Flags (neutral)", () => {
    expect(formatPromptFlags({
      genre: null, audience: null, tone: null,
      chapterCount: null, wordsPerChapter: null, promptsPath: null,
    })).toBe("");
  });
});

describe("loadPromptLibraryOverride", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aiws-prompts-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("ohne Pfad → eingebaute Library", () => {
    const lib = loadPromptLibraryOverride(null);
    expect(lib.version).toBe("2.0");
    expect(Object.keys(lib.genres)).toContain("sachbuch-it");
  });

  it("liefert eingebaute Library bei Pfad", () => {
    const lib = loadPromptLibraryOverride(null);
    expect(lib.defaultGenre).toBe("sachbuch");
  });

  it("fehlende Datei wirft sprechenden Fehler", () => {
    expect(() => loadPromptLibraryOverride("/gibts/nicht.json")).toThrow(/nicht gefunden/);
  });

  it("ungültiges JSON wirft sprechenden Fehler", () => {
    const p = path.join(tmp, "broken.json");
    fs.writeFileSync(p, "{ kein json");
    expect(() => loadPromptLibraryOverride(p)).toThrow(/valides JSON/);
  });

  it("fehlende 'version' wirft", () => {
    const p = path.join(tmp, "noversion.json");
    fs.writeFileSync(p, JSON.stringify({ genres: { sachbuch: { systemRole: "R", systemRules: ["a"], prompts: { t: "T" } } } }));
    expect(() => loadPromptLibraryOverride(p)).toThrow(/version/);
  });

  it("leere 'genres' wirft", () => {
    const p = path.join(tmp, "nogenres.json");
    fs.writeFileSync(p, JSON.stringify({ version: "1.0", genres: {} }));
    expect(() => loadPromptLibraryOverride(p)).toThrow(/genres/);
  });

  it("Genre ohne systemRole wirft", () => {
    const p = path.join(tmp, "norole.json");
    fs.writeFileSync(p, JSON.stringify({
      version: "1.0",
      genres: { x: { systemRules: ["r"], prompts: { t: "T" } } },
    }));
    expect(() => loadPromptLibraryOverride(p)).toThrow(/systemRole/);
  });

  it("Genre ohne systemRules wirft", () => {
    const p = path.join(tmp, "norules.json");
    fs.writeFileSync(p, JSON.stringify({
      version: "1.0",
      genres: { x: { systemRole: "R", prompts: { t: "T" } } },
    }));
    expect(() => loadPromptLibraryOverride(p)).toThrow(/systemRules/);
  });

  it("Genre ohne prompts wirft", () => {
    const p = path.join(tmp, "noprompts.json");
    fs.writeFileSync(p, JSON.stringify({
      version: "1.0",
      genres: { x: { systemRole: "R", systemRules: ["r"] } },
    }));
    expect(() => loadPromptLibraryOverride(p)).toThrow(/prompts/);
  });

  it("gültige externe Library wird geladen", () => {
    const p = path.join(tmp, "ok.json");
    fs.writeFileSync(p, JSON.stringify({
      version: "9.9",
      defaultGenre: "test",
      genres: {
        test: {
          label: "Test", systemRole: "Rolle", systemRules: ["Regel 1"],
          prompts: { hello: "Hallo {{name}}!" },
        },
      },
    }));
    const lib = loadPromptLibraryOverride(p);
    expect(lib.version).toBe("9.9");
    expect(lib.genres.test.prompts.hello).toBe("Hallo {{name}}!");
  });

  it("eingebaute prompts.json besteht die eigene Validierung", () => {
    const libPath = path.resolve(__dirname, "..", "bookwriter", "prompts", "prompts.json");
    const lib = loadPromptLibraryOverride(libPath);
    expect(Object.keys(lib.genres).length).toBeGreaterThanOrEqual(11);
  });
});
