// Tests: Textqualitaets-Engine (Sprint 17, Agent 1) — reine Logik, kein LLM.
import { describe, it, expect } from "vitest";
import {
  analyzeReadability,
  analyzeSentenceVariety,
  dialogueRatioOf,
  analyzeDialogueRatio,
  analyzeAdverbDensity,
  detectCliches,
  analyzeCliches,
  analyzeTenseConsistency,
  analyzePovConsistency,
  analyzePacing,
  analyzeTextQuality,
  countGermanSyllables,
  splitQualitySentences,
  tokenizeQualityWords,
  GERMAN_CLICHES,
  ENGLISH_CLICHES,
} from "@/services/bookwriter/quality";

const GOOD_PROSE =
  "Anna öffnete die Tür. Der Flur war dunkel. " +
  "„Wer ist da?“, fragte sie leise in die Stille hinein. " +
  "„Bleib stehen!“, rief eine Stimme aus dem Dunkel. „Komm nicht näher!“ " +
  "Niemand antwortete ihr, und sie ging langsam weiter. " +
  "Er hatte den Brief auf den Tisch gelegt, bevor er das Haus verließ. " +
  "Sie nahm das Papier und las die wenigen Zeilen.";

describe("countGermanSyllables", () => {
  it("zaehlt Vokalgruppen (Haus=1, Lesbarkeit=4)", () => {
    expect(countGermanSyllables("Haus")).toBe(1);
    expect(countGermanSyllables("Lesbarkeit")).toBe(3);
    expect(countGermanSyllables("Abenteuer")).toBe(3); // „eue" = 1 Vokalgruppe
    expect(countGermanSyllables("unverständlich")).toBe(4);
  });
  it("gibt min. 1 fuer kurze Woerter und 0 fuer Leerstring", () => {
    expect(countGermanSyllables("ab")).toBe(1);
    expect(countGermanSyllables("")).toBe(0);
  });
});

describe("analyzeReadability", () => {
  it("bewertet einfache Saetze als gut", () => {
    const m = analyzeReadability("Der Hund bellt. Die Katze miaut. Der Vogel singt.");
    expect(m.level).toBe("good");
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.suggestions).toEqual([]);
  });
  it("meldet leeren Text als bad mit Hinweis", () => {
    const m = analyzeReadability("   ");
    expect(m.level).toBe("bad");
    expect(m.score).toBe(0);
    expect(m.suggestions.length).toBeGreaterThan(0);
  });
  it("erkennt Schachtelsaetze (lange Woerter + lange Saetze)", () => {
    const m = analyzeReadability(
      "Die Donaudampfschifffahrtsgesellschaftskapitänsmützenherstellungs complicationsunwahrscheinlichkeit " +
      "verdeutlicht die Unverständlichkeitsproblematik langatmiger Satzkonstruktionen ohne Punkt.",
    );
    expect(m.level).not.toBe("good");
    expect(m.suggestions.length).toBeGreaterThan(0);
  });
  it("nutzt injizierbaren Silbenzaehler", () => {
    const m = analyzeReadability("Eins zwei drei.", { countSyllables: () => 1 });
    expect(m.score).toBeGreaterThan(90);
  });
});

describe("analyzeSentenceVariety", () => {
  it("bewertet gemischte Satzlaengen als gut", () => {
    const m = analyzeSentenceVariety("Komm. Der alte Mann ging langsam über die lange Brücke am Fluss entlang. Halt!");
    expect(m.level).toBe("good");
  });
  it("meldet monotone Satzlaengen", () => {
    const m = analyzeSentenceVariety(
      "Der Mann geht heim. Die Frau kocht Suppe. Das Kind malt Bilder. Der Hund bellt laut.",
    );
    expect(m.level).not.toBe("good");
    expect(m.suggestions.length).toBeGreaterThan(0);
  });
  it("behandelt leeren Text und Einzelsatz", () => {
    expect(analyzeSentenceVariety("").level).toBe("bad");
    expect(analyzeSentenceVariety("Nur ein einziger Satz steht hier.").level).toBe("bad");
  });
});

describe("dialogue", () => {
  it("misst Dialoganteil (0 ohne Anfuehrung)", () => {
    expect(dialogueRatioOf("Ganz normale Erzählung ohne Rede.")).toBe(0);
    expect(dialogueRatioOf("„Hallo!“, sagte sie.")).toBeGreaterThan(0.3);
  });
  it("bewertet ausgewogenen Dialog als gut, Monolog als warn/bad", () => {
    expect(analyzeDialogueRatio(GOOD_PROSE).level).toBe("good");
    expect(analyzeDialogueRatio("Er ging. Er sah. Er nahm. Er legte.").score).toBeLessThan(70);
  });
  it("meldet leeren Text", () => {
    expect(analyzeDialogueRatio("  ").level).toBe("bad");
  });
});

describe("analyzeAdverbDensity", () => {
  it("bewertet adverbarmes Deutsch als gut", () => {
    const m = analyzeAdverbDensity("Anna öffnete die Tür und trat ein. Der Raum war leer.");
    expect(m.level).toBe("good");
  });
  it("flaggt adverbueberladenen Text", () => {
    const m = analyzeAdverbDensity(
      "Er ging sehr langsam und wirklich heimlich leise weiter, beinahe völlig lautlos, äußerst vorsichtig und unglaublich leise.",
    );
    expect(m.level).not.toBe("good");
    expect(m.suggestions.length).toBeGreaterThan(0);
  });
  it("meldet leeren Text", () => {
    expect(analyzeAdverbDensity("").level).toBe("bad");
  });
});

describe("cliches", () => {
  it("exportiert deutsche und englische Listen", () => {
    expect(GERMAN_CLICHES.length).toBeGreaterThan(10);
    expect(ENGLISH_CLICHES.length).toBeGreaterThan(10);
  });
  it("findet deutsche und englische Klischees", () => {
    expect(detectCliches("Am Ende des Tages blieb die Zeit stehen.")).toContain("am ende des tages");
    expect(detectCliches("It was a dark and stormy night.")).toContain("dark and stormy night");
  });
  it("bewertet klischeefreien Text als gut", () => {
    const m = analyzeCliches("Der Regen trommelte gegen das Fensterblech, während sie den Tee umrührte.");
    expect(m.level).toBe("good");
    expect(m.score).toBe(100);
  });
  it("straft Klischeehaeufung ab", () => {
    const m = analyzeCliches("Am Ende des Tages heilt Zeit alle Wunden, es war einmal, dark and stormy night, tip of the iceberg.");
    expect(m.level).toBe("bad");
    expect(m.suggestions.length).toBeGreaterThanOrEqual(3);
  });
});

describe("analyzeTenseConsistency", () => {
  it("bewertet reines Praeteritum als gut", () => {
    const m = analyzeTenseConsistency("Er ging nach Hause. Sie wartete dort. Er sagte nichts. Sie sah ihn an. Er nahm den Brief.");
    expect(m.level).toBe("good");
  });
  it("flaggt Tempuswechsel", () => {
    const m = analyzeTenseConsistency("Er geht nach Hause. Sie wartete dort. Er sagt nichts. Sie sah ihn an. Er nimmt den Brief.");
    expect(m.level).not.toBe("good");
  });
  it("ist tolerant bei wenig Signalen und leerem Text", () => {
    expect(analyzeTenseConsistency("Stille. Nur Staub.").level).toBe("good");
    expect(analyzeTenseConsistency("").level).toBe("bad");
  });
});

describe("analyzePovConsistency", () => {
  it("bewertet reine 3. Person als gut", () => {
    const m = analyzePovConsistency("Er ging heim. Sie wartete. Sein Hund bellte. Ihre Katze schlief.");
    expect(m.level).toBe("good");
  });
  it("flaggt Perspektivwechsel", () => {
    const m = analyzePovConsistency("Ich ging heim. Er wartete. Ich sah ihn. Sie sah mich. Wir gingen. Er blieb.");
    expect(m.level).not.toBe("good");
  });
  it("meldet leeren Text", () => {
    expect(analyzePovConsistency("").level).toBe("bad");
  });
});

describe("analyzePacing", () => {
  it("bewertet gemischte Passage als gut", () => {
    const m = analyzePacing(
      "Er rannte über den Hof und sprang über die Mauer. Der Garten war still und wunderschön, " +
      "die Rosen dufteten schwer. Plötzlich griff er nach dem Seil und schoss vorwärts.",
    );
    expect(m.level).toBe("good");
  });
  it("flaggt reine Beschreibung", () => {
    const m = analyzePacing(
      "Der Garten war wunderschön und malerisch. Die Rosen waren rot und duftend. " +
      "Das Licht schien sanft und warm. Alles wirkte still und friedlich.",
    );
    expect(m.level).not.toBe("good");
  });
  it("meldet leeren Text", () => {
    expect(analyzePacing("").level).toBe("bad");
  });
});

describe("analyzeTextQuality", () => {
  it("liefert Report mit allen 8 Metriken plus Gesamtbewertung", () => {
    const r = analyzeTextQuality(GOOD_PROSE);
    for (const k of ["readability", "sentenceVariety", "dialogueRatio", "adverbDensity",
      "cliches", "tenseConsistency", "povConsistency", "pacing"] as const) {
      expect(r[k].score).toBeGreaterThanOrEqual(0);
      expect(r[k].score).toBeLessThanOrEqual(100);
      expect(["good", "warn", "bad"]).toContain(r[k].level);
      expect(Array.isArray(r[k].suggestions)).toBe(true);
    }
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.overallScore).toBeLessThanOrEqual(100);
    expect(["good", "warn", "bad"]).toContain(r.overallLevel);
  });
  it("bewertet leeren Text ueberall als bad", () => {
    const r = analyzeTextQuality("");
    expect(r.overallLevel).toBe("bad");
    expect(r.overallScore).toBeLessThan(40);
  });
  it("verarbeitet gemischtsprachigen Text ohne Absturz", () => {
    const r = analyzeTextQuality("He ran quickly. „Lauf!“, schrie er. At the end of the day, er war müde.");
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.cliches.suggestions.length).toBeGreaterThan(0);
  });
  it("Helfer sind einzeln nutzbar (split/tokenize)", () => {
    expect(splitQualitySentences("Eins. Zwei!").length).toBe(2);
    expect(tokenizeQualityWords("Hällo WELT!")).toEqual(["hällo", "welt"]);
  });
});
