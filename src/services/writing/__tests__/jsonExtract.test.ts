// Tests: A1 — Robuste JSON-Extraktion (Fences, Strings, Repair, Truncation).
import { describe, it, expect } from "vitest";
import {
  stripFences,
  extractJsonObject,
  repairJson,
  capTruncatedJson,
  parseJsonLoose,
} from "../jsonExtract";

describe("A1: stripFences", () => {
  it("entfernt ```json-Fences", () => {
    const raw = '```json\n{"a": 1}\n```';
    expect(JSON.parse(stripFences(raw))).toEqual({ a: 1 });
  });

  it("entfernt ```-Fences ohne Sprachangabe", () => {
    const raw = '```\n{"a": 1}\n```';
    expect(JSON.parse(stripFences(raw))).toEqual({ a: 1 });
  });
});

describe("A1: extractJsonObject (Zustandsmaschine)", () => {
  it("'}' INNERHALB eines Strings beendet das Objekt nicht vorzeitig", () => {
    const raw = 'Hier: {"title": "Der Wendepunkt } und Ende", "n": 1} — Nachtext.';
    const json = extractJsonObject(raw);
    expect(json).toBe('{"title": "Der Wendepunkt } und Ende", "n": 1}');
    expect(JSON.parse(json!)).toEqual({ title: "Der Wendepunkt } und Ende", n: 1 });
  });

  it("Escape-Sequenzen in Strings werden korrekt übersprungen", () => {
    // Escaped Quote: \" endet den String NICHT; danach kommt eine echte }
    const raw = '{"s": "Zitat: \\" und } drumrum", "n": 2}';
    const json = extractJsonObject(raw);
    expect(JSON.parse(json!)).toEqual({ s: 'Zitat: " und } drumrum', n: 2 });
  });

  it("Escaped Backslash vor Quote: \\\\\" endet den String DOCH", () => {
    const raw = '{"s": "Backslash \\\\" , "n": 3}';
    const json = extractJsonObject(raw);
    expect(JSON.parse(json!)).toEqual({ s: "Backslash \\", n: 3 });
  });

  it("unbalanciertes JSON → null (Repair-Pass übernimmt)", () => {
    expect(extractJsonObject('{"a": {"b": 1}')).toBeNull();
  });

  it("verschachtelte Objekte werden korrekt balanciert", () => {
    const raw = 'Text {"o": {"i": "}"}, "n": 4} Ende';
    expect(JSON.parse(extractJsonObject(raw)!)).toEqual({ o: { i: "}" }, n: 4 });
  });
});

describe("A1: repairJson", () => {
  it("entfernt trailing commas vor } und ]", () => {
    const fixed = repairJson('{"a": [1, 2,], "b": {"c": 3,},}');
    expect(JSON.parse(fixed)).toEqual({ a: [1, 2], b: { c: 3 } });
  });

  it("normalisiert einfache Anführungszeichen als String-Delimiter", () => {
    const fixed = repairJson("{'title': 'Buch', 'n': 5}");
    expect(JSON.parse(fixed)).toEqual({ title: "Buch", n: 5 });
  });

  it("Apostrophe INNERHALB von Double-Quote-Strings bleiben Inhalt", () => {
    const fixed = repairJson('{"s": "geht\'s noch?"}');
    expect(JSON.parse(fixed)).toEqual({ s: "geht's noch?" });
  });
});

describe("A1: capTruncatedJson", () => {
  it("kappst abgeschnittenes JSON an letztem vollständigem Kapitel", () => {
    const truncated =
      '{"title": "T", "genre": "G", "chapters": [' +
      '{"number": 1, "title": "Eins", "summary": "Erstes vollständiges Kapitel mit Inhalt."},' +
      '{"number": 2, "title": "Zwei", "summary": "Zweites Kapitel, abgebrochen mitten im';
    const parsed = JSON.parse(capTruncatedJson(truncated)!) as { title?: string; chapters: unknown[] };
    expect(parsed.title).toBe("T");
    expect(parsed.chapters).toHaveLength(1);
    expect((parsed.chapters[0] as { number: number }).number).toBe(1);
  });

  it("alle Kapitel vollständig → alle bleiben erhalten", () => {
    const full =
      '{"chapters": [{"number": 1, "title": "A", "summary": "s1"}, {"number": 2, "title": "B", "summary": "s2"}]}';
    const parsed = JSON.parse(capTruncatedJson(full)!) as { chapters: unknown[] };
    expect(parsed.chapters).toHaveLength(2);
  });

  it("kein chapters-Array → null", () => {
    expect(capTruncatedJson('{"a": 1')).toBeNull();
  });

  it("trailing comma wird beim Rebuild mit repariert", () => {
    const truncated =
      '{"chapters": [{"number": 1, "title": "A", "summary": "s1"},';
    const parsed = JSON.parse(capTruncatedJson(truncated)!) as { chapters: unknown[] };
    expect(parsed.chapters).toHaveLength(1);
  });
});

describe("A1: parseJsonLoose (Gesamtpipeline)", () => {
  const valid =
    '{"title": "T", "genre": "G", "targetAudience": "Z", "chapters": [{"number": 1, "title": "A", "summary": "s"}]}';

  it("Fence-gewrapptes JSON wird geparst", () => {
    const wrapped = "Hier ist deine Gliederung:\n```json\n" + valid + "\n```\nViel Erfolg!";
    expect(parseJsonLoose<{ title: string }>(wrapped, "Test")).toEqual(JSON.parse(valid));
  });

  it("kaputtes JSON mit } im String wird geparst", () => {
    const broken =
      '{"title": "Krimi } Handlung", "chapters": [{"number": 1, "title": "A", "summary": "Der Fall } Wendepunkt"}]}';
    const parsed = parseJsonLoose<{ title: string; chapters: { summary: string }[] }>(broken, "Test");
    expect(parsed.title).toBe("Krimi } Handlung");
    expect(parsed.chapters[0].summary).toBe("Der Fall } Wendepunkt");
  });

  it("trailing commas werden geparst", () => {
    const broken =
      '{"title": "T", "chapters": [{"number": 1, "title": "A", "summary": "s",}],}';
    expect(parseJsonLoose<{ title: string }>(broken, "Test").title).toBe("T");
  });

  it("abgeschnittenes JSON wird am letzten vollständigen Kapitel gekappt", () => {
    const broken =
      '{"title": "T", "chapters": [' +
      '{"number": 1, "title": "A", "summary": "Erstes Kapitel, vollständig beschrieben hier."},' +
      '{"number": 2, "title": "B", "summary": "Zweites Kapitel das mitten in der Zusammen';
    const parsed = parseJsonLoose<{ title: string; chapters: { number: number }[] }>(broken, "Test");
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0].number).toBe(1);
  });

  it("einfache Anführungszeichen werden geparst", () => {
    const broken = "{'title': 'T', 'chapters': [{'number': 1, 'title': 'A', 'summary': 's'}]}";
    expect(parseJsonLoose<{ title: string }>(broken, "Test").title).toBe("T");
  });

  it("völlig unbrauchbare Antwort → sprechender Fehler mit Antwort-Anfang", () => {
    expect(() => parseJsonLoose("Ich kann leider keine Gliederung erstellen.", "Gliederung"))
      .toThrow(/^Gliederung: Kein gültiges JSON.*Ich kann leider keine Gliederung/);
  });

  it("leere Antwort → sprechender Fehler", () => {
    expect(() => parseJsonLoose("", "Gliederung")).toThrow(/^Gliederung: Kein gültiges JSON/);
  });
});
