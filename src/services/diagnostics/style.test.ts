// Tests: Stilprüfung, vollständig offline.
//
// Die Testtexte sind absichtlich fehlerhaft geschrieben. Sie prüfen, dass die
// Regeln greifen — und ebenso wichtig: dass sauberer Text KEINE Befunde
// erzeugt. Ein Werkzeug, das überall anschlägt, wird ignoriert.

import { describe, it, expect } from "vitest";
import { analyzeText } from "@/services/diagnostics/textmodel";
import { checkStyle, computeMetrics } from "@/services/diagnostics/style";

/** Kürzel: Text analysieren und prüfen. */
function check(text: string) {
  return checkStyle(analyzeText(text));
}

function kinds(text: string): string[] {
  return check(text).issues.map((i) => i.kind);
}

describe("Kennwerte", () => {
  it("berechnet Satzlänge und Wortzahl", () => {
    const m = computeMetrics(analyzeText("Ein Satz mit fünf Wörtern. Noch einer hier."));
    expect(m.sentenceCount).toBe(2);
    expect(m.wordCount).toBe(8);
    expect(m.avgSentenceWords).toBeGreaterThan(3);
  });

  it("misst den Dialoganteil", () => {
    const text = [
      "Marta ging durch den Raum und sah sich um.",
      "",
      "„Wo ist der Brief?“, fragte sie ihn leise.",
    ].join("\n");
    const m = computeMetrics(analyzeText(text));
    expect(m.dialogueRatio).toBeGreaterThan(0.3);
    expect(m.dialogueRatio).toBeLessThan(0.7);
  });

  it("misst lexikalische Vielfalt", () => {
    const eintoenig = computeMetrics(
      analyzeText("Archiv Archiv Archiv Archiv Archiv Archiv."),
    );
    const vielfaeltig = computeMetrics(
      analyzeText("Archiv Brief Fenster Tisch Papier Regen."),
    );
    expect(vielfaeltig.lexicalVariety).toBeGreaterThan(eintoenig.lexicalVariety);
  });

  it("liefert bei leerem Text keine NaN-Werte", () => {
    const m = computeMetrics(analyzeText(""));
    for (const v of Object.values(m)) {
      expect(Number.isNaN(v)).toBe(false);
    }
  });
});

describe("Sauberer Text erzeugt keine Befunde", () => {
  // Nüchterne Prosa, wechselnde Satzlängen, kein Passiv, keine Klischees.
  const clean = [
    "Der Brief lag zwischen zwei Buchseiten. Marta hob ihn ans Licht.",
    "Das Papier war dünn geworden.",
    "Sie las die erste Zeile, dann setzte sie sich auf den Stuhl am Fenster",
    "und wartete, bis ihr Puls sich beruhigt hatte.",
    "Draußen fiel Regen. Ein Auto fuhr vorbei.",
    "Der Name auf dem Umschlag stimmte. Die Adresse gab es nicht mehr.",
    "Ihre Großmutter hatte das geschrieben, drei Wochen vor Martas Geburt.",
    "Marta faltete den Bogen und legte ihn zurück in das Buch.",
  ].join(" ");

  it("meldet keine Auffälligkeiten", () => {
    const found = kinds(clean);
    expect(found).toHaveLength(0);
  });
});

describe("Füllwörter", () => {
  it("erkennt Häufung", () => {
    const text =
      "Es war eigentlich irgendwie ganz sehr schon auch etwas relativ " +
      "ziemlich durchaus natürlich vielleicht wohl eben halt praktisch. " +
      "Das war eigentlich irgendwie ganz sehr auch etwas ziemlich schon. " +
      "Er ging eigentlich irgendwie einfach mal noch etwas weiter fort.";
    expect(kinds(text)).toContain("filler");
  });

  it("nennt die häufigsten Füllwörter in der Erklärung", () => {
    const text =
      "Eigentlich war es eigentlich eigentlich ganz eigentlich schon so. " +
      "Irgendwie irgendwie ganz sehr auch etwas relativ ziemlich durchaus. " +
      "Eigentlich blieb eigentlich alles eigentlich beim Alten dort drüben. " +
      "Noch etwas mehr Text hier damit die Mindestlänge erreicht wird jetzt.";
    const issue = check(text).issues.find((i) => i.kind === "filler");
    expect(issue?.explanation).toContain("eigentlich");
  });
});

describe("Passiv", () => {
  it("erkennt Häufung", () => {
    const text =
      "Der Brief wurde gefunden. Das Buch wurde geöffnet. " +
      "Die Seite wurde umgeblättert. Der Name wurde gelesen. " +
      "Die Adresse wurde gesucht. Das Haus wurde abgerissen. " +
      "Die Straße wurde umbenannt. Der Fall wurde geschlossen.";
    expect(kinds(text)).toContain("passive");
  });

  it("meldet aktiven Text nicht", () => {
    const text =
      "Marta fand den Brief. Sie öffnete das Buch. " +
      "Sie blätterte die Seite um und las den Namen. " +
      "Dann suchte sie die Adresse, aber das Haus stand nicht mehr. " +
      "Die Stadt hatte die Straße umbenannt, den Fall längst geschlossen.";
    expect(kinds(text)).not.toContain("passive");
  });
});

describe("Nominalstil", () => {
  it("erkennt Substantivierungen", () => {
    const text =
      "Die Durchführung der Prüfung erfolgte unter Berücksichtigung der " +
      "Gegebenheiten. Die Feststellung der Wahrheit war eine Herausforderung. " +
      "Die Bearbeitung der Anfrage erforderte Genauigkeit und Sorgfältigkeit. " +
      "Die Vollendung der Handlung brachte Erleichterung und Zufriedenheit.";
    expect(kinds(text)).toContain("nominal");
  });
});

describe("Satzlänge", () => {
  it("erkennt überlange Sätze mit Position", () => {
    const long =
      "Der Brief, der zwischen den Seiten eines Buches lag, das seit vierzig " +
      "Jahren niemand aufgeschlagen hatte, und der an eine Adresse gerichtet " +
      "war, die es längst nicht mehr gab, weil man die Straße umbenannt und " +
      "das Haus abgerissen hatte, trug einen Namen, der ihr eigener war, " +
      "was sie erst begriff, als sie ihn zum dritten Mal gelesen hatte.";
    const issue = check(long).issues.find((i) => i.kind === "sentenceLength");
    expect(issue).toBeTruthy();
    expect(issue?.start).toBeTypeOf("number");
    expect(issue?.snippet).toBeTruthy();
  });

  it("erkennt gleichförmigen Rhythmus", () => {
    // Zwölf Sätze, alle etwa gleich lang.
    const monoton = Array.from(
      { length: 14 },
      (_, i) => `Der Mann ging heute wieder in das Archiv hinein Nummer ${i}.`,
    ).join(" ");
    const found = kinds(monoton);
    expect(found).toContain("sentenceLength");
  });

  it("meldet Rhythmus bei zu wenigen Sätzen nicht", () => {
    // Drei gleich lange Sätze sind kein Muster.
    const kurz = "Der Mann ging fort. Die Frau blieb hier. Das Kind sah zu. " +
      "Ein weiterer Satz hier für die nötige Mindestlänge des Textes jetzt.";
    const rhythm = check(kurz).issues.filter(
      (i) => i.kind === "sentenceLength" && i.message.includes("Rhythmus"),
    );
    expect(rhythm).toHaveLength(0);
  });
});

describe("Klischees", () => {
  it("erkennt abgegriffene Wendungen mit Position", () => {
    const text =
      "Sein Herz schlug bis zum Hals, als er die Tür öffnete und hineinsah. " +
      "Danach ging er ruhig weiter, ohne sich noch einmal umzudrehen dabei. " +
      "Der Flur war leer und still, das Licht fiel schräg durch die Fenster.";
    const issue = check(text).issues.find((i) => i.kind === "cliche");
    expect(issue).toBeTruthy();
    expect(issue?.start).toBeTypeOf("number");
    expect(issue?.message).toContain("Herz");
  });
});

describe("Wiederholungen", () => {
  it("erkennt dasselbe Wort auf engem Raum", () => {
    const text =
      "Im Archiv war es still. Das Archiv hatte Öffnungszeiten und Formulare. " +
      "Im Archiv arbeitete ein Mann, der jede Frage mit einer Gegenfrage " +
      "beantwortete und dabei ruhig blieb, was Marta zunehmend ärgerte.";
    const issue = check(text).issues.find((i) => i.kind === "repetition");
    expect(issue).toBeTruthy();
    expect(issue?.snippet).toBe("archiv");
  });

  it("meldet weit verteilte Wiederholungen nicht", () => {
    const filler = " Ein weiterer Satz ohne besondere Merkmale steht hier auch. ";
    const text = "Archiv am Anfang." + filler.repeat(9) + "Archiv am Ende hier." +
      filler.repeat(9) + "Archiv zum Schluss.";
    const rep = check(text).issues.filter((i) => i.kind === "repetition");
    expect(rep.map((r) => r.snippet)).not.toContain("archiv");
  });

  it("ignoriert Funktionswörter", () => {
    const text =
      "Der Mann und die Frau und das Kind und der Hund gingen fort. " +
      "Und dann kamen sie zurück und setzten sich hin und schwiegen lange. " +
      "Und niemand sagte etwas und alle warteten auf ein Zeichen von ihm.";
    const rep = check(text).issues.filter((i) => i.kind === "repetition");
    expect(rep.map((r) => r.snippet)).not.toContain("und");
  });
});

describe("Robustheit", () => {
  it("meldet bei sehr kurzem Text nichts", () => {
    expect(check("Zu kurz.").issues).toHaveLength(0);
  });

  it("wirft bei leerem Text nicht", () => {
    expect(() => check("")).not.toThrow();
  });

  it("liefert bei jedem Befund eine verständliche Erklärung", () => {
    const text =
      "Es wurde eigentlich irgendwie ganz sehr schon gemacht und gesagt. " +
      "Das wurde eigentlich auch etwas relativ ziemlich durchaus getan. " +
      "Sein Herz schlug bis zum Hals und wurde dabei ganz sehr schnell.";
    for (const i of check(text).issues) {
      expect(i.message.length).toBeGreaterThan(10);
      expect(i.explanation.length).toBeGreaterThan(30);
      expect(i.weight).toBeGreaterThan(0);
      expect(i.weight).toBeLessThanOrEqual(1);
    }
  });
});
