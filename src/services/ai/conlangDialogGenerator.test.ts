/**
 * Tests: conlangDialogGenerator (WP 59.1 — Conlang- & Kunstsprachen-Generator)
 */

import { describe, it, expect } from "vitest";
import {
  createConlang,
  translateToConlang,
  lookupWord,
  formatLexicon,
  lexiconSize,
  phraseWordCount,
  PROFILE_LABELS,
  type PhonologyProfile,
} from "./conlangDialogGenerator";

describe("conlangDialogGenerator — createConlang", () => {
  it("erzeugt eine Sprache", () => {
    const c = createConlang("Aelith");
    expect(c.name).toBe("Aelith");
    expect(c.lexicon.length).toBeGreaterThan(10);
  });

  it("unterstützt alle drei Phonologie-Profile", () => {
    const profiles: PhonologyProfile[] = ["guttural", "melodic", "mechanical"];
    profiles.forEach((p) => {
      const c = createConlang("Test", p);
      expect(c.profile).toBe(p);
      expect(c.consonants.length).toBeGreaterThan(0);
      expect(c.vowels.length).toBeGreaterThan(0);
    });
  });

  it("unterschiedliche Profile erzeugen unterschiedliche Wörter", () => {
    const a = createConlang("Test", "guttural");
    const b = createConlang("Test", "mechanical");
    expect(a.lexicon[0].word).not.toBe(b.lexicon[0].word);
  });

  it("ist deterministisch", () => {
    const a = createConlang("Aelith", "melodic");
    const b = createConlang("Aelith", "melodic");
    expect(a.lexicon.map((e) => e.word)).toEqual(b.lexicon.map((e) => e.word));
  });

  it("jede Bedeutung hat ein eigenes Wort", () => {
    const c = createConlang("Aelith");
    const words = c.lexicon.map((e) => e.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it("deckt die Kern-Bedeutungen ab", () => {
    const c = createConlang("Aelith");
    const meanings = c.lexicon.map((e) => e.meaning);
    expect(meanings).toContain("Blut");
    expect(meanings).toContain("kämpfen");
    expect(meanings).toContain("möge");
  });

  it("vergibt Kategorien", () => {
    const c = createConlang("Aelith");
    const categories = new Set(c.lexicon.map((e) => e.category));
    expect(categories.has("noun")).toBe(true);
    expect(categories.has("verb")).toBe(true);
  });

  it("fällt bei unbekanntem Profil auf melodic zurück", () => {
    expect(createConlang("Test", "unbekannt" as never).profile).toBe("melodic");
  });

  it("nutzt einen Standardnamen", () => {
    expect(createConlang().name).toBe("Aelith");
    expect(createConlang(null).name).toBe("Aelith");
    expect(createConlang(undefined).name).toBe("Aelith");
    expect(createConlang("   ").name).toBe("Aelith");
  });

  it("exportiert die Profil-Labels", () => {
    expect(PROFILE_LABELS.guttural).toBe("Kehlig / Kriegerisch");
    expect(PROFILE_LABELS.mechanical).toBe("Maschinell / Prägnant");
  });
});

describe("conlangDialogGenerator — translateToConlang", () => {
  const LANG = createConlang("Aelith", "guttural");

  it("übersetzt einen Satz", () => {
    const p = translateToConlang("Blut und Asche", LANG);
    expect(p.foreign.length).toBeGreaterThan(3);
    expect(p.words.length).toBeGreaterThan(0);
  });

  it("liefert eine wörtliche Übersetzung", () => {
    const p = translateToConlang("Blut Asche", LANG);
    expect(p.literal.toLowerCase()).toContain("blut");
  });

  it("bettet narrativ mit Übersetzung ein", () => {
    const p = translateToConlang("Blut", LANG);
    expect(p.narrative).toContain("Es bedeutete wörtlich");
  });

  it("übernimmt Verb und Sprecher", () => {
    const p = translateToConlang("Blut", LANG, { verb: "zischte", speaker: "sie" });
    expect(p.narrative).toContain("zischte");
    expect(p.narrative).toContain("sie");
  });

  it("ist deterministisch", () => {
    const a = translateToConlang("Blut und Asche", LANG);
    const b = translateToConlang("Blut und Asche", LANG);
    expect(a.foreign).toBe(b.foreign);
    expect(a.narrative).toBe(b.narrative);
  });

  it("unbekannte Wörter bleiben über Aufrufe konsistent", () => {
    const a = translateToConlang("Xylophon", LANG);
    const b = translateToConlang("Xylophon", LANG);
    expect(a.foreign).toBe(b.foreign);
  });

  it("nutzt das Lexikon für bekannte Bedeutungen", () => {
    const p = translateToConlang("Schwert", LANG);
    const entry = LANG.lexicon.find((e) => e.meaning === "Schwert");
    expect(p.words[0]).toBe(entry?.word);
  });

  it("übernimmt das Profil der Sprache", () => {
    expect(translateToConlang("Blut", LANG).profile).toBe("guttural");
  });

  it("erzeugt eine Sprache, wenn keine übergeben wird", () => {
    const p = translateToConlang("Blut");
    expect(p.foreign.length).toBeGreaterThan(3);
  });

  it("kommt mit leerem Satz zurecht", () => {
    const p = translateToConlang("", LANG);
    expect(p.foreign).toBe("");
    expect(p.narrative).toBe("");
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(translateToConlang(null, LANG).foreign).toBe("");
    expect(translateToConlang(undefined, LANG).words).toEqual([]);
    expect(translateToConlang("Blut", null).foreign.length).toBeGreaterThan(3);
  });
});

describe("conlangDialogGenerator — lookupWord", () => {
  const LANG = createConlang("Aelith", "melodic");

  it("findet ein fremdes Wort", () => {
    const entry = LANG.lexicon[0];
    const r = lookupWord(LANG, entry.word);
    expect(r.known).toBe(true);
    expect(r.meaning).toBe(entry.meaning);
  });

  it("findet über die deutsche Bedeutung", () => {
    const r = lookupWord(LANG, "Blut");
    expect(r.known).toBe(true);
    expect(r.meaning).toBeTruthy();
  });

  it("Bedeutung bleibt über den Roman stabil", () => {
    const a = lookupWord(LANG, "Schwert");
    const b = lookupWord(LANG, "Schwert");
    expect(a.meaning).toBe(b.meaning);
  });

  it("meldet unbekannte Wörter", () => {
    const r = lookupWord(LANG, "Xyzzy");
    expect(r.known).toBe(false);
    expect(r.meaning).toBeNull();
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(lookupWord(null, "Blut").known).toBe(false);
    expect(lookupWord(undefined, "Blut").meaning).toBeNull();
    expect(lookupWord(LANG, "").known).toBe(false);
    expect(lookupWord(LANG, null).known).toBe(false);
  });
});

describe("conlangDialogGenerator — Hilfsfunktionen", () => {
  const LANG = createConlang("Aelith");

  it("formatiert das Lexikon", () => {
    const text = formatLexicon(LANG);
    expect(text).toContain("Aelith");
    expect(text).toContain("Blut");
  });

  it("kommt mit leerer Sprache zurecht", () => {
    expect(formatLexicon(null)).toBe("");
    expect(formatLexicon(undefined)).toBe("");
  });

  it("zählt die Lexikon-Größe", () => {
    expect(lexiconSize(LANG)).toBeGreaterThan(10);
    expect(lexiconSize(null)).toBe(0);
  });

  it("zählt die Wörter einer Phrase", () => {
    const p = translateToConlang("Blut und Asche", LANG);
    expect(phraseWordCount(p)).toBeGreaterThan(0);
    expect(phraseWordCount(null)).toBe(0);
  });
});
