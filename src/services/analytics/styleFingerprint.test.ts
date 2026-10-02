// Tests: Stil-Fingerprint & Floskel-Scanner (WP 15.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  analyzeStyleFingerprint,
  findOverusedPhrases,
  calculateBurstiness,
  suggestAlternatives,
} from "./styleFingerprint";
import type { StyleFingerprint, OverusedPhrase } from "./styleFingerprint";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_TEXT = "";
const WHITESPACE_TEXT = "   \n\t  ";

const REPETITIVE_TEXT =
  "Der Hund läuft. Der Hund läuft. Der Hund läuft.";

const VARIED_TEXT =
  "Ein schneller Fuchs springt über den trägen Hund während die Katze schläft.";

const EQUAL_SENTENCES =
  "Der Hund läuft schnell. Die Katze schläft tief.";

const BURSTY_TEXT =
  "Kurz. Dies ist ein deutlich längerer Satz mit vielen Wörtern.";

const PHRASE_TEXT =
  "Am Ende des Tages zählt nur eines. " +
  "Am Ende des Tages zählt nur Mut. " +
  "Am Ende des Tages zählt nur Kraft.";

const STOPWORD_TEXT =
  "In der Küche ist es warm. In der Stube ist es kalt. In der Halle ist es still.";

const UNIQUE_TEXT =
  "Der schnelle braune Fuchs springt über den faulen Hund. " +
  "Eine müde Katze schläft auf dem warmen Sofa.";

// ---------------------------------------------------------------------------
// analyzeStyleFingerprint
// ---------------------------------------------------------------------------

describe("analyzeStyleFingerprint", () => {
  it("leerer Text ergibt ein Null-Fingerprint", () => {
    const fp: StyleFingerprint = analyzeStyleFingerprint(EMPTY_TEXT);
    expect(fp).toEqual({
      perplexity: 0,
      burstiness: 0,
      sentenceVariance: 0,
      avgSentenceLength: 0,
      uniqueWordRatio: 0,
    });
  });

  it("Whitespace-only Text ergibt ein Null-Fingerprint", () => {
    const fp = analyzeStyleFingerprint(WHITESPACE_TEXT);
    expect(fp.perplexity).toBe(0);
    expect(fp.burstiness).toBe(0);
    expect(fp.uniqueWordRatio).toBe(0);
  });

  it("ein wiederholtes Wort ergibt Perplexity 1 und Ratio 1/3", () => {
    const fp = analyzeStyleFingerprint("Hallo Hallo Hallo");
    expect(fp.perplexity).toBe(1);
    expect(fp.avgSentenceLength).toBe(3);
    expect(fp.sentenceVariance).toBe(0);
    expect(fp.uniqueWordRatio).toBe(0.33);
  });

  it("vielfältiger Text hat höhere Perplexity als repetitiver", () => {
    const repetitive = analyzeStyleFingerprint(REPETITIVE_TEXT);
    const varied = analyzeStyleFingerprint(VARIED_TEXT);
    expect(varied.perplexity).toBeGreaterThan(repetitive.perplexity);
  });

  it("repetitiver Text ergibt Perplexity 3 (drei gleich häufige Wörter)", () => {
    const fp = analyzeStyleFingerprint(REPETITIVE_TEXT);
    expect(fp.perplexity).toBe(3);
  });

  it("Text mit nur eindeutigen Wörtern hat uniqueWordRatio 1", () => {
    const fp = analyzeStyleFingerprint(VARIED_TEXT);
    expect(fp.uniqueWordRatio).toBe(1);
  });

  it("alle Werte sind endlich und nicht-negativ", () => {
    const fp = analyzeStyleFingerprint(PHRASE_TEXT);
    for (const value of [
      fp.perplexity,
      fp.burstiness,
      fp.sentenceVariance,
      fp.avgSentenceLength,
      fp.uniqueWordRatio,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    const a = analyzeStyleFingerprint(PHRASE_TEXT);
    const b = analyzeStyleFingerprint(PHRASE_TEXT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("defensiv: undefined/null wird wie leerer Text behandelt", () => {
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(analyzeStyleFingerprint(undefined).perplexity).toBe(0);
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(analyzeStyleFingerprint(null).uniqueWordRatio).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateBurstiness
// ---------------------------------------------------------------------------

describe("calculateBurstiness", () => {
  it("gleich lange Sätze ergeben 0", () => {
    expect(calculateBurstiness(EQUAL_SENTENCES)).toBe(0);
  });

  it("stark unterschiedliche Satzlängen ergeben einen Wert > 0", () => {
    expect(calculateBurstiness(BURSTY_TEXT)).toBeGreaterThan(0.5);
  });

  it("einzelner Satz ergibt 0", () => {
    expect(calculateBurstiness("Nur ein einziger Satz hier.")).toBe(0);
  });

  it("leerer Text ergibt 0", () => {
    expect(calculateBurstiness(EMPTY_TEXT)).toBe(0);
  });

  it("Burstiness entspricht dem Variationskoeffizienten der Satzlängen", () => {
    // Längen [1, 9] → Mittel 5, Stdabw. 4 → CV = 0.8
    expect(calculateBurstiness(BURSTY_TEXT)).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// findOverusedPhrases
// ---------------------------------------------------------------------------

describe("findOverusedPhrases", () => {
  it("findet die dreifach wiederholte Phrase samt Positionen", () => {
    const phrases: OverusedPhrase[] = findOverusedPhrases(PHRASE_TEXT);
    const hit = phrases.find((p) => p.phrase === "am ende des tages");
    expect(hit).toBeDefined();
    expect(hit?.count).toBe(3);
    expect(hit?.positions).toEqual([0, 7, 14]);
  });

  it("liefert bei sehr kurzem Text (< 6 Wörter) ein leeres Array", () => {
    expect(findOverusedPhrases("Nur ein kurzer Satz.")).toEqual([]);
  });

  it("ignoriert reine Stoppwort-Kombinationen", () => {
    const phrases = findOverusedPhrases(STOPWORD_TEXT);
    expect(phrases.some((p) => p.phrase === "in der")).toBe(false);
    expect(phrases.some((p) => p.phrase === "ist es")).toBe(false);
  });

  it("findet nichts, wenn keine Phrase mehrfach vorkommt", () => {
    expect(findOverusedPhrases(UNIQUE_TEXT)).toEqual([]);
  });

  it("respektiert maxResults", () => {
    const phrases = findOverusedPhrases(PHRASE_TEXT, 1);
    expect(phrases.length).toBeLessThanOrEqual(1);
  });

  it("defensiv: ungültiges maxResults fällt auf den Default zurück", () => {
    const phrases = findOverusedPhrases(PHRASE_TEXT, 0);
    expect(phrases.length).toBeGreaterThanOrEqual(1);
  });

  it("leerer Text ergibt ein leeres Array", () => {
    expect(findOverusedPhrases(EMPTY_TEXT)).toEqual([]);
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    const a = findOverusedPhrases(PHRASE_TEXT);
    const b = findOverusedPhrases(PHRASE_TEXT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ---------------------------------------------------------------------------
// suggestAlternatives
// ---------------------------------------------------------------------------

describe("suggestAlternatives", () => {
  it("bekannte Phrase liefert kuratierte Alternativen", () => {
    const alts = suggestAlternatives("am Ende des Tages");
    expect(alts).toContain("letztlich");
    expect(alts.length).toBeGreaterThan(1);
  });

  it("ist case-insensitiv und whitespace-normalisierend", () => {
    const a = suggestAlternatives("  AM   Ende des Tages ");
    const b = suggestAlternatives("am ende des tages");
    expect(a).toEqual(b);
  });

  it("unbekannte Phrase liefert generische, nicht-leere Hinweise", () => {
    const alts = suggestAlternatives("quirlige Wortneuschöpfung");
    expect(alts.length).toBeGreaterThan(0);
    expect(alts[0]).toContain("quirlige Wortneuschöpfung");
  });

  it("leere oder ungültige Eingabe liefert ein leeres Array", () => {
    expect(suggestAlternatives("")).toEqual([]);
    expect(suggestAlternatives("   ")).toEqual([]);
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(suggestAlternatives(null)).toEqual([]);
  });

  it("Alternative ist in einem Satz enthalten, wenn die Phrase Teilstring ist", () => {
    const alts = suggestAlternatives("und letztlich am Ende des Tages doch");
    expect(alts).toContain("letztlich");
  });
});
