// Tests: Lesbarkeits-Metriken (Flesch DE, Ø-Satzlänge, Füllwörter, Passiv).
import { describe, it, expect } from "vitest";
import {
  computeReadability, splitSentences, countFillers, estimatePassiveSentences,
  fillerReduced, formatMetric, DEFAULT_THRESHOLDS,
} from "./readability";
import type { Chapter } from "@/types/project";

function chapter(content: string): Chapter {
  return {
    id: "ch1", projectId: "p1", title: "Test", content, orderIndex: 0,
    createdAt: 0, updatedAt: 0, status: "draft",
    targetWordCount: 2000, minimumWordCount: 1600, maximumWordCount: 2400,
    currentWordCount: 0,
  };
}

describe("splitSentences", () => {
  it("splittet an Satzenden", () => {
    const s = splitSentences("Erster Satz. Zweiter Satz! Dritter Satz?");
    expect(s).toHaveLength(3);
  });

  it("ignoriert Abkürzungspunkte nicht robust, aber leere Texte", () => {
    expect(splitSentences("")).toHaveLength(0);
    expect(splitSentences("   ")).toHaveLength(0);
  });
});

describe("countFillers", () => {
  it("zählt Füllwörter im Kontext", () => {
    const text = "Also das ist eigentlich irgendwie wichtig, halt wirklich.";
    const { count, total } = countFillers(text);
    // also, eigentlich, irgendwie, halt, wirklich
    expect(count).toBe(5);
    expect(total).toBe(8);
  });

  it("zählt Mehrwort-Phrasen", () => {
    const { count } = countFillers("Das ist, wie bereits erwähnt, ein Test.");
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("0 bei leerem Text", () => {
    expect(countFillers("").count).toBe(0);
  });
});

describe("estimatePassiveSentences", () => {
  it("erkennt werden-Periphrase", () => {
    const n = estimatePassiveSentences([
      "Das Haus wird gebaut.",
      "Er ging nach Hause.",
    ]);
    expect(n).toBe(1);
  });

  it("erkennt worden-Konstruktion", () => {
    expect(estimatePassiveSentences(["Es ist gemacht worden."])).toBe(1);
  });
});

describe("computeReadability", () => {
  it("produziert alle Metriken mit sinnvollen Werten", () => {
    const m = computeReadability("Der Hund bellt laut. Die Katze schläft gern.");
    expect(m.words).toBe(8);
    expect(m.sentences).toBe(2);
    expect(m.avgSentenceLength).toBeCloseTo(4, 1);
    expect(m.fleschReadingEase).toBeGreaterThan(0);
    expect(m.fleschReadingEase).toBeLessThanOrEqual(100);
  });

  it("kurze Sätze → hoher Flesch-Wert, lange Sätze niedriger", () => {
    const kurze = computeReadability("Der Hund bellt. Die Katze schläft. Es regnet.");
    const lange = computeReadability(
      "Der Hund, der gestern über die Straße gerannt ist und dabei laut gebellt hat, " +
      "verscheuchte die Katze, welche erschrocken unter das Auto flüchtete, " +
      "wo sie bis zum Abend blieb.",
    );
    expect(kurze.fleschReadingEase).toBeGreaterThan(lange.fleschReadingEase);
  });

  it("leerer Text: keine Division durch 0", () => {
    const m = computeReadability("");
    expect(m.words).toBe(0);
    expect(m.avgSentenceLength).toBe(0);
    expect(m.fillerRatio).toBe(0);
    expect(m.passiveRatio).toBe(0);
  });

  it("Schwellenwerte konfigurierbar", () => {
    const m = computeReadability("Test.", { avgSentenceLength: 5, fillerRatio: 0 });
    expect(m.thresholds.avgSentenceLength).toBe(5);
    expect(m.thresholds.fillerRatio).toBe(0);
  });

  it("entfernt Markdown vor der Analyse", () => {
    const plain = computeReadability("Kapitel Eins. Der Text läuft.");
    const md = computeReadability("# Kapitel Eins\n\nDer **Text** läuft.");
    expect(plain.words).toBe(metWords(md));
  });
});

function metWords(m: ReturnType<typeof computeReadability>): number {
  return m.words;
}

describe("fillerReduced", () => {
  it("true bei ≥ 10 % relativer Senkung", () => {
    expect(fillerReduced(0.30, 0.20)).toBe(true);
  });
  it("false bei kleiner Senkung", () => {
    expect(fillerReduced(0.30, 0.28)).toBe(false);
  });
  it("false bei 0 vorher", () => {
    expect(fillerReduced(0, 0)).toBe(false);
  });
});

describe("formatMetric", () => {
  it("formatiert Quoten als Prozent", () => {
    expect(formatMetric("fillerRatio", 0.305)).toBe("30.5%");
  });
  it("formatiert Satzlänge", () => {
    expect(formatMetric("avgSentenceLength", 12.34)).toBe("12.3 W/S");
  });
});

describe("metricBadges via computeReadability auf Kapitel", () => {
  it("30 % Füllwörter erzeugen eine Warnung bei Default-Schwelle 8 %", () => {
    const fillerWords = ["also", "eigentlich", "irgendwie", "halt", "sozusagen"];
    const fillerText = fillerWords
      .map((w) => `${w} etwas`)
      .join(" und auch so wurde das nichts, eigentlich, irgendwie, halt, also, sozusagen, wirklich, einfach, deutlich. ");
    const ch = chapter(fillerText);
    // Füllquote grob >= 30 % prüfen
    const m = computeReadability(ch.content);
    expect(m.fillerRatio).toBeGreaterThanOrEqual(0.30);
  });

  it("Default-Schwellen sind gesetzt", () => {
    expect(DEFAULT_THRESHOLDS.fillerRatio).toBe(0.08);
    expect(DEFAULT_THRESHOLDS.avgSentenceLength).toBe(18);
  });
});