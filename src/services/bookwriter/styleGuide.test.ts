// Tests: Style-Guide-Engine (Sprint 17, Agent 3).
//
// Akzeptanzkriterien: Regel-Erstellung, Prüfung gegen den Guide,
// Fix-Anwendung, Persistenz-Roundtrip in den Projekt-Settings.
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import {
  createStyleGuide,
  checkAgainstGuide,
  applyFix,
  saveStyleGuide,
  loadStyleGuide,
  matchCapitalization,
  type StyleGuide,
} from "./styleGuide";

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  db.exec("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','Test',1,1)");
});

describe("createStyleGuide", () => {
  it("erstellt einen Guide mit ID und Zeitstempeln", () => {
    const guide = createStyleGuide({ tense: "past", pov: "third" }, "p1");
    expect(guide.id).toMatch(/^sg_/);
    expect(guide.projectId).toBe("p1");
    expect(guide.rules.tense).toBe("past");
    expect(guide.rules.pov).toBe("third");
    expect(guide.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("normalisiert und entdupliziert verbotene Wörter", () => {
    const guide = createStyleGuide({
      forbiddenWords: [
        { word: "  quasi " },
        { word: "Quasi" },
        { word: "" },
        { word: "eigentlich", suggestion: " " },
      ],
    });
    expect(guide.rules.forbiddenWords).toEqual([
      { word: "quasi" },
      { word: "eigentlich" },
    ]);
  });

  it("verwirft ungültige tense/pov-Werte", () => {
    const guide = createStyleGuide({ tense: "future" as never, pov: "second" as never });
    expect(guide.rules.tense).toBeNull();
    expect(guide.rules.pov).toBeNull();
  });

  it("verwirft leere preferredTerms und namenlose Figurenregeln", () => {
    const guide = createStyleGuide({
      preferredTerms: [{ wrong: "", preferred: "x" }, { wrong: "Email", preferred: "E-Mail" }],
      characterNames: [{ canonical: "", variants: ["x"] }, { canonical: "Anna", variants: [] }],
    });
    expect(guide.rules.preferredTerms).toEqual([{ wrong: "Email", preferred: "E-Mail" }]);
    expect(guide.rules.characterNames).toEqual([]);
  });
});

describe("checkAgainstGuide", () => {
  it("findet verbotene Wörter mit Offset und Vorschlag", () => {
    const guide = createStyleGuide({ forbiddenWords: [{ word: "quasi", suggestion: "gewissermaßen" }] });
    const text = "Das war quasi unmöglich.";
    const findings = checkAgainstGuide(text, guide);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("forbiddenWord");
    expect(findings[0].offset).toBe(text.indexOf("quasi"));
    expect(findings[0].suggestion).toBe("gewissermaßen");
  });

  it("findet bevorzugte Begriffe case-insensitiv", () => {
    const guide = createStyleGuide({ preferredTerms: [{ wrong: "email", preferred: "E-Mail" }] });
    const findings = checkAgainstGuide("Schreib mir eine Email bitte.", guide);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("preferredTerm");
    expect(findings[0].expected).toBe("E-Mail");
  });

  it("findet abweichende Figurennamen-Schreibweisen", () => {
    const guide = createStyleGuide({
      characterNames: [{ canonical: "Anna Weber", variants: ["Anna weber", "Ana Weber"] }],
    });
    const findings = checkAgainstGuide("Ana Weber ging nach Hause.", guide);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("characterName");
    expect(findings[0].expected).toBe("Anna Weber");
  });

  it("beanstandet die kanonische Schreibweise nicht", () => {
    const guide = createStyleGuide({
      characterNames: [{ canonical: "Anna Weber", variants: ["Anna Weber", "Ana Weber"] }],
    });
    expect(checkAgainstGuide("Anna Weber ging nach Hause.", guide)).toHaveLength(0);
  });

  it("meldet Präsens-Marker bei tense=past", () => {
    const guide = createStyleGuide({ tense: "past" });
    const findings = checkAgainstGuide("Er ist müde und geht nach Hause.", guide);
    expect(findings.some((f) => f.kind === "tense")).toBe(true);
  });

  it("meldet Präteritums-Marker bei tense=present", () => {
    const guide = createStyleGuide({ tense: "present" });
    const findings = checkAgainstGuide("Er ging nach Hause und sagte nichts.", guide);
    expect(findings.some((f) => f.kind === "tense")).toBe(true);
  });

  it("meldet dritte Person bei pov=first", () => {
    const guide = createStyleGuide({ pov: "first" });
    const findings = checkAgainstGuide("Ich sah, dass er schon wartete.", guide);
    const pov = findings.filter((f) => f.kind === "pov");
    expect(pov).toHaveLength(1);
    expect(pov[0].found.toLocaleLowerCase("de-DE")).toBe("er");
  });

  it("meldet Ich-Formen bei pov=third", () => {
    const guide = createStyleGuide({ pov: "third" });
    const findings = checkAgainstGuide("Ich ging nach Hause.", guide);
    expect(findings.some((f) => f.kind === "pov" && f.suggestion === null)).toBe(true);
  });

  it("liefert keine Befunde für sauberen Text und sortiert nach Offset", () => {
    const guide = createStyleGuide({
      forbiddenWords: [{ word: "quasi" }],
      preferredTerms: [{ wrong: "email", preferred: "E-Mail" }],
    });
    expect(checkAgainstGuide("Anna schrieb einen langen Brief.", guide)).toHaveLength(0);
    const multi = checkAgainstGuide("quasi eine email quasi", guide);
    const offsets = multi.map((f) => f.offset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });
});

describe("applyFix", () => {
  it("ersetzt ein verbotenes Wort durch den Vorschlag", () => {
    const guide = createStyleGuide({ forbiddenWords: [{ word: "quasi", suggestion: "sozusagen" }] });
    const text = "Das war quasi fertig.";
    const [finding] = checkAgainstGuide(text, guide);
    expect(applyFix(text, finding)).toBe("Das war sozusagen fertig.");
  });

  it("erhält Großschreibung bei preferredTerms (matchCapitalization)", () => {
    expect(matchCapitalization("Email", "E-Mail")).toBe("E-Mail");
    expect(matchCapitalization("email", "E-Mail")).toBe("E-Mail");
    const guide = createStyleGuide({ preferredTerms: [{ wrong: "email", preferred: "e-mail" }] });
    const text = "Die Email kam an.";
    const [finding] = checkAgainstGuide(text, guide);
    expect(applyFix(text, finding)).toBe("Die E-mail kam an.");
  });

  it("lässt Text bei Befunden ohne Vorschlag und bei Offset-Mismatch unverändert", () => {
    const guide = createStyleGuide({ pov: "third" });
    const text = "Ich ging nach Hause.";
    const [finding] = checkAgainstGuide(text, guide);
    expect(applyFix(text, finding)).toBe(text);
    const tampered: StyleGuide = createStyleGuide({
      forbiddenWords: [{ word: "quasi", suggestion: "x" }],
    });
    const f = checkAgainstGuide("quasi da", tampered)[0];
    expect(applyFix("völlig anderer Text hier", { ...f })).toBe("völlig anderer Text hier");
    expect(applyFix("quasi da", { ...f, offset: 99, length: 5 })).toBe("quasi da");
  });
});

describe("Persistenz (Projekt-Settings)", () => {
  it("Roundtrip: save + load erhält alle Regeln", async () => {
    const guide = createStyleGuide(
      {
        forbiddenWords: [{ word: "quasi", suggestion: "sozusagen" }],
        preferredTerms: [{ wrong: "Email", preferred: "E-Mail" }],
        characterNames: [{ canonical: "Anna Weber", variants: ["Ana Weber"] }],
        tense: "past",
        pov: "third",
      },
      "p1",
    );
    await saveStyleGuide("p1", guide);
    const loaded = loadStyleGuide("p1");
    expect(loaded).not.toBeNull();
    expect(loaded!.rules).toEqual(guide.rules);
    expect(loaded!.projectId).toBe("p1");
    // Geladener Guide ist sofort prüfbar.
    expect(checkAgainstGuide("Das war quasi fertig.", loaded!)).toHaveLength(1);
  });

  it("load ohne gespeicherten Guide liefert null, Überschreiben funktioniert", async () => {
    expect(loadStyleGuide("p1")).toBeNull();
    await saveStyleGuide("p1", createStyleGuide({ tense: "past" }, "p1"));
    await saveStyleGuide("p1", createStyleGuide({ tense: "present" }, "p1"));
    expect(loadStyleGuide("p1")!.rules.tense).toBe("present");
  });
});
