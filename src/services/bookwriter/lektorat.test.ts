// Tests: Lektorats-Modus — reine Regel-Logik, zero network.
// `complete` wird grundsaetzlich gemockt; kein Test ruft createOllamaComplete auf.

import { describe, it, expect } from "vitest";
import {
  analyzeBook,
  analyzeChapter,
  checkDialogueTags,
  checkFillerWords,
  checkPassiveVoice,
  checkRepeatedWords,
  checkSentenceVariance,
  countFindingsByType,
  countWords,
  rephraseWithLlm,
  splitSentences,
  FILLER_WORDS,
  type LektoratFinding,
} from "@/services/bookwriter/lektorat";

const CH = "ch1";

describe("splitSentences / countWords", () => {
  it("teilt deutsche Sätze an . ! ? (inkl. direkter Rede)", () => {
    const parts = splitSentences(`Er ging heim. „Bleib!", rief sie. War das klug? Ja.`);
    expect(parts).toHaveLength(4);
  });

  it("leerer Text ergibt keine Sätze", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("zählt Wörter Umlaut-bewahrend", () => {
    expect(countWords("Die Tür öffnete sich stürmisch.")).toBe(5);
  });
});

describe("checkRepeatedWords", () => {
  it("flaggt dasselbe Inhaltswort im Fenster", () => {
    const text = "Der alte Leuchtturm blinkte hell. Der Leuchtturm warnte die Schiffe.";
    const findings = checkRepeatedWords(CH, text);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("repeated_word");
    expect(findings[0].chapterId).toBe(CH);
    expect(findings[0].suggestion).toContain("Leuchtturm");
    expect(findings[0].rationale.length).toBeGreaterThan(0);
  });

  it("ignoriert weit auseinanderliegende Wiederholungen", () => {
    const pool = ["Apfel", "Birke", "Dachs", "Eiche", "Falke", "Garten", "Harfe", "Insel", "Jacht", "Kiefer", "Lerche", "Mauer", "Nelke", "Ofen", "Pappel", "Quelle", "Rose", "Segel", "Tanne", "Ufer", "Vogel", "Wiese", "Zelt", "Anker", "Bucht", "Dorf", "Ernte", "Fluss", "Gipfel", "Hafen", "Klang", "Mond", "Nacht", "Osten", "Pfad", "Rat", "Stern", "Turm", "Wolke", "Zeit"];
    const filler = pool.join(" ");
    const text = `Leuchtturm am Horizont. ${filler} Endlich wieder der Leuchtturm.`;
    expect(checkRepeatedWords(CH, text)).toEqual([]);
  });

  it("ignoriert kurze Wörter und Stoppwörter", () => {
    expect(checkRepeatedWords(CH, "Der Mann sah den Hund und den Baum.")).toEqual([]);
  });
});

describe("checkSentenceVariance", () => {
  it("flaggt Sätze mit 30+ Wörtern", () => {
    const long = `Der ${Array.from({ length: 32 }, (_, i) => `lange${i}`).join(" ")} Satz endet hier.`;
    const findings = checkSentenceVariance(CH, long);
    expect(findings.some((f) => f.type === "sentence_variance")).toBe(true);
  });

  it("flaggt monotone Folgen gleichlanger Sätze", () => {
    const findings = checkSentenceVariance(CH, "Er ging heim. Sie kam mit. Das war gut.");
    expect(findings.some((f) => f.suggestion.includes("Monotone"))).toBe(true);
  });

  it("variierte Sätze bleiben ohne Befund", () => {
    const text = "Er ging nach Hause. Die lange Reise durch den dunklen und stürmischen Wald war endlich vorbei und alle atmeten auf. Gut.";
    expect(checkSentenceVariance(CH, text)).toEqual([]);
  });
});

describe("checkPassiveVoice", () => {
  it("erkennt Vorgangspassiv (wurde + Partizip)", () => {
    const findings = checkPassiveVoice(CH, "Die Tür wurde am Abend geöffnet. Er ging heim.");
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("passive_voice");
    expect(findings[0].suggestion).toContain("Aktiv");
  });

  it("aktive Sätze bleiben ohne Befund", () => {
    expect(checkPassiveVoice(CH, "Er öffnete die Tür. Sie trat ein.")).toEqual([]);
  });

  it("meldet zusätzlich Passivdichte ab 3 Treffern", () => {
    const text = [
      "Die Tür wurde geöffnet.",
      "Der Brief wurde gelesen.",
      "Das Fenster wurde geschlossen.",
    ].join(" ");
    const findings = checkPassiveVoice(CH, text);
    const density = findings.filter((f) => f.position === 0 && f.suggestion.includes("Passivdichte"));
    expect(density).toHaveLength(1);
    expect(findings).toHaveLength(4);
  });
});

describe("checkDialogueTags", () => {
  it("flaggt dominanten Tag (sagte 3x)", () => {
    const text = `„Komm", sagte er. „Geh", sagte sie. „Bleib", sagte er.`;
    const findings = checkDialogueTags(CH, text);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("dialogue_tag");
    expect(findings[0].suggestion).toContain("sagte");
  });

  it("weniger als 3 Tags bleiben ohne Befund", () => {
    expect(checkDialogueTags(CH, `„Komm", sagte er.`)).toEqual([]);
  });

  it("abwechslungsreiche Tags bleiben ohne Befund", () => {
    const text = `„Komm", sagte er. „Wohin?", fragte sie. „Leise", flüsterte er.`;
    expect(checkDialogueTags(CH, text)).toEqual([]);
  });
});

describe("checkFillerWords", () => {
  it("flaggt jedes Füllwort mit Position", () => {
    const text = "Das war eigentlich ganz nett, irgendwie quasi zauberhaft.";
    const findings = checkFillerWords(CH, text);
    // eigentlich, irgendwie, quasi (kein "ganz" mehr in der Liste)
    expect(findings).toHaveLength(3);
    expect(findings.every((f) => f.type === "filler_word")).toBe(true);
    const positions = [...findings.map((f) => f.position)].sort((a, b) => a - b);
    expect(findings.map((f) => f.position)).toEqual(positions);
    expect(findings[0].position).toBe(text.indexOf("eigentlich"));
  });

  it("matcht nur ganze Wörter (kein Teilwort-Treffer)", () => {
    expect(checkFillerWords(CH, "Das war uneigentlich gemeint.")).toEqual([]);
  });

  it("FILLER_WORDS enthält die geforderten deutschen Klassiker", () => {
    for (const w of ["eigentlich", "irgendwie", "quasi"]) {
      expect(FILLER_WORDS).toContain(w);
    }
  });
});

describe("analyzeChapter / analyzeBook", () => {
  it("leerer Text ergibt keine Befunde", () => {
    expect(analyzeChapter(CH, "")).toEqual([]);
    expect(analyzeChapter(CH, "   ")).toEqual([]);
  });

  it("sammelt alle Check-Typen mit chapterId und sortiert nach Position", () => {
    const text = `Die Tür wurde eigentlich geöffnet. Der alte Leuchtturm blinkte hell und der Leuchtturm warnte die Schiffe.`;
    const findings = analyzeChapter(CH, text);
    const types = new Set(findings.map((f) => f.type));
    expect(types.has("passive_voice")).toBe(true);
    expect(types.has("filler_word")).toBe(true);
    expect(types.has("repeated_word")).toBe(true);
    expect(findings.every((f) => f.chapterId === CH)).toBe(true);
    const positions = findings.map((f) => f.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("analyzeBook hält Kapitelreihenfolge ein", () => {
    const chapters = [
      { id: "ch2", content: "Das war eigentlich seltsam." },
      { id: "ch1", content: "Das war irgendwie seltsam." },
    ];
    const findings = analyzeBook(chapters);
    expect(findings).toHaveLength(2);
    expect(findings[0].chapterId).toBe("ch2");
    expect(findings[1].chapterId).toBe("ch1");
  });

  it("countFindingsByType zählt pro Typ", () => {
    const findings = analyzeChapter(CH, "Die Tür wurde eigentlich geöffnet.");
    const counts = countFindingsByType(findings);
    expect(counts.passive_voice).toBeGreaterThanOrEqual(1);
    expect(counts.filler_word).toBe(1);
    expect(counts.dialogue_tag).toBe(0);
  });
});

describe("rephraseWithLlm (complete injizierbar, gemockt)", () => {
  const finding: LektoratFinding = {
    type: "filler_word",
    chapterId: CH,
    position: 0,
    suggestion: "Füllwort streichen.",
    rationale: "Füllwörter schwächen die Aussage.",
  };

  it("ohne complete: Offline-Fallback auf suggestion", async () => {
    await expect(rephraseWithLlm(finding, "Das war eigentlich nett.")).resolves.toBe(
      "Füllwort streichen.",
    );
  });

  it("mit gemocktem complete: gibt LLM-Text zurück", async () => {
    const complete = async (prompt: string) => {
      expect(prompt).toContain("filler_word");
      return "Das war nett.";
    };
    await expect(rephraseWithLlm(finding, "Das war eigentlich nett.", complete)).resolves.toBe(
      "Das war nett.",
    );
  });

  it("leere LLM-Antwort fällt auf suggestion zurück", async () => {
    const complete = async () => "   ";
    await expect(rephraseWithLlm(finding, "Text.", complete)).resolves.toBe(
      "Füllwort streichen.",
    );
  });
});
