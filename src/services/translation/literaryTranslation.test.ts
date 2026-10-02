// Tests für den Literarischen-Übersetzungs-Service (WP 18.2, Dual-Editor).
// 0 LLM-Calls — der Service ist rein lokal/deterministisch.

import { describe, it, expect } from "vitest";

import {
  alignDualText,
  checkGlossaryCompliance,
  checkVoiceConsistency,
  splitSentences,
  type GlossaryEntry,
} from "./literaryTranslation";

// --- splitSentences ------------------------------------------------------------

describe("splitSentences", () => {
  it("zerlegt einen Absatz in Sätze", () => {
    expect(splitSentences("Der Hund bellt. Die Katze schläft! Wer gewinnt?")).toEqual([
      "Der Hund bellt.",
      "Die Katze schläft!",
      "Wer gewinnt?",
    ]);
  });

  it("trennt nicht an Abkürzungen wie „Dr.“", () => {
    expect(splitSentences("Dr. Müller kam. Er ging sofort.")).toEqual([
      "Dr. Müller kam.",
      "Er ging sofort.",
    ]);
  });
});

// --- alignDualText -------------------------------------------------------------

describe("alignDualText", () => {
  it("paart Sätze mit deterministischen IDs und markiert Absatzgrenzen", () => {
    const segments = alignDualText(
      ["Der Hund bellt. Die Katze schläft."],
      ["The dog barks. The cat sleeps."],
    );

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      id: "p1-s1",
      original: "Der Hund bellt.",
      translation: "The dog barks.",
      isParagraphBreak: true,
    });
    expect(segments[1]).toMatchObject({
      id: "p1-s2",
      original: "Die Katze schläft.",
      translation: "The cat sleeps.",
      isParagraphBreak: false,
    });
  });

  it("setzt für jeden Absatz einen Break am ersten Satz", () => {
    const segments = alignDualText(["A.", "B."], ["X.", "Y."]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ id: "p1-s1", isParagraphBreak: true });
    expect(segments[1]).toMatchObject({ id: "p2-s1", isParagraphBreak: true });
  });

  it("behält fehlende Sätze mit leerer Seite (nichts geht verloren)", () => {
    const segments = alignDualText(["Eins. Zwei. Drei."], ["One."]);

    expect(segments).toHaveLength(3);
    expect(segments[0].translation).toBe("One.");
    expect(segments[1].original).toBe("Zwei.");
    expect(segments[1].translation).toBe("");
    expect(segments[2].original).toBe("Drei.");
    expect(segments[2].translation).toBe("");
  });

  it("fügt überzählige Absätze der Übersetzung als Segmente an", () => {
    const segments = alignDualText(["A."], ["X.", "Y."]);

    expect(segments).toHaveLength(2);
    expect(segments[1]).toMatchObject({
      id: "p2-s1",
      original: "",
      translation: "Y.",
      isParagraphBreak: true,
    });
  });

  it("liefert bei leeren Arrays ein leeres Ergebnis", () => {
    expect(alignDualText([], [])).toEqual([]);
  });

  it("fängt ungültige Eingaben defensiv ab", () => {
    expect(alignDualText(null as unknown as string[], undefined as unknown as string[])).toEqual(
      [],
    );
  });
});

// --- checkGlossaryCompliance ---------------------------------------------------

describe("checkGlossaryCompliance", () => {
  it("meldet einen unübersetzten Begriff mit Erwartung, Fund und Position", () => {
    const glossary: GlossaryEntry[] = [
      { source: "König", target: "King", category: "rank" },
    ];
    const violations = checkGlossaryCompliance("Der König ritt davon.", glossary);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
      source: "König",
      expected: "King",
      found: "König",
      position: 4,
    });
  });

  it("meldet nichts, wenn der Begriff korrekt übersetzt wurde", () => {
    const glossary: GlossaryEntry[] = [
      { source: "König", target: "King", category: "rank" },
    ];
    expect(checkGlossaryCompliance("The King rode away.", glossary)).toEqual([]);
  });

  it("findet mehrere Vorkommen und sortiert nach Position", () => {
    const glossary: GlossaryEntry[] = [
      { source: "König", target: "King", category: "rank" },
    ];
    const violations = checkGlossaryCompliance("König und König", glossary);

    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.position)).toEqual([0, 10]);
  });

  it("findet Begriffe case-insensitiv und gibt den Original-Fund zurück", () => {
    const glossary: GlossaryEntry[] = [
      { source: "König", target: "King", category: "rank" },
    ];
    const violations = checkGlossaryCompliance("der KÖNIG rief", glossary);

    expect(violations).toHaveLength(1);
    expect(violations[0].found).toBe("KÖNIG");
  });

  it("matcht keine Wortteile (Wortgrenze)", () => {
    const glossary: GlossaryEntry[] = [
      { source: "König", target: "King", category: "rank" },
    ];
    expect(checkGlossaryCompliance("Das Königreich ist groß.", glossary)).toEqual([]);
  });

  it("überspringt Einträge ohne Quelle/Ziel sowie Identitätseinträge", () => {
    const glossary: GlossaryEntry[] = [
      { source: "", target: "X", category: "term" },
      { source: "Aldoria", target: "Aldoria", category: "name" },
    ];
    expect(checkGlossaryCompliance("Aldoria liegt weit.", glossary)).toEqual([]);
  });

  it("liefert bei leerem Text oder leerem Glossar nichts", () => {
    const glossary: GlossaryEntry[] = [
      { source: "König", target: "King", category: "rank" },
    ];
    expect(checkGlossaryCompliance("", glossary)).toEqual([]);
    expect(checkGlossaryCompliance("Der König", [])).toEqual([]);
  });
});

// --- checkVoiceConsistency -----------------------------------------------------

describe("checkVoiceConsistency", () => {
  it("meldet konsistenten Stil als unauffällig", () => {
    const result = checkVoiceConsistency("Komm her!", "Come here!", "Anna");

    expect(result.consistent).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("erkennt verlorene Intensität (Ausrufezeichen)", () => {
    const result = checkVoiceConsistency(
      "Halt! Nein! Bleib stehen!",
      "Stop. No. Stay there.",
      "Anna",
    );

    expect(result.consistent).toBe(false);
    expect(result.issues.some((i) => /Ausrufezeichen/.test(i))).toBe(true);
  });

  it("erkennt einen verlorenen Figurennamen", () => {
    const result = checkVoiceConsistency("Anna ging. Anna lachte.", "She went. She laughed.", "Anna");

    expect(result.consistent).toBe(false);
    expect(result.issues.some((i) => i.includes("Anna"))).toBe(true);
  });

  it("erkennt einen Registerwechsel formell → informell", () => {
    const result = checkVoiceConsistency("Können Sie helfen?", "Kannst du helfen?", "Butler");

    expect(result.consistent).toBe(false);
    expect(result.issues.some((i) => /Register/.test(i))).toBe(true);
  });

  it("erkennt Kontraktionen, die das formelle Register senken", () => {
    const result = checkVoiceConsistency(
      "Sie werden es tun.",
      "You'll do it, don't worry.",
      "Butler",
    );

    expect(result.consistent).toBe(false);
    expect(result.issues.some((i) => /Kontraktionen/.test(i))).toBe(true);
  });

  it("erkennt stark abweichende Satzlängen (Rhythmus)", () => {
    const result = checkVoiceConsistency(
      "Er ging langsam den langen dunklen Weg entlang und dachte über alles nach was geschehen war.",
      "He walked.",
      "Erzähler",
    );

    expect(result.consistent).toBe(false);
    expect(result.issues.some((i) => /Satzlänge/.test(i))).toBe(true);
  });

  it("meldet eine fehlende Übersetzung statt stillschweigend zu bestehen", () => {
    const result = checkVoiceConsistency("Halt! Nein!", "", "Anna");

    expect(result.consistent).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatch(/Übersetzung fehlt/);
  });

  it("liefert bei komplett leerer Eingabe ein neutrales Ergebnis", () => {
    expect(checkVoiceConsistency("", "", "")).toEqual({ consistent: true, issues: [] });
  });

  it("nutzt bei fehlendem Figurennamen ein neutrales Label", () => {
    const result = checkVoiceConsistency("Halt! Nein!", "Stop. No.", "");

    expect(result.consistent).toBe(false);
    expect(result.issues[0]).toContain("Figur");
  });
});
