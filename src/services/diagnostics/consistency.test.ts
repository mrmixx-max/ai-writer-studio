// Tests: Konsistenzprüfung, vollständig offline.
//
// Wichtigster Prüfpunkt neben dem Finden von Widersprüchen: dass sauberer
// Text KEINE Befunde erzeugt und dass legitime literarische Mittel (Dialog,
// Rückblick) nicht als Fehler gemeldet werden.

import { describe, it, expect } from "vitest";
import { analyzeText } from "@/services/diagnostics/textmodel";
import {
  checkCharacters,
  checkWorld,
  checkPointOfView,
  checkTerminology,
  checkTimeline,
  levenshtein,
} from "@/services/diagnostics/consistency";
import type { CharacterProfile, LocationProfile } from "@/services/knowledge/profiles";

function character(over: Partial<CharacterProfile> = {}): CharacterProfile {
  return {
    id: "c1",
    projectId: "p1",
    name: "Marta",
    aliases: null,
    age: null,
    occupation: null,
    appearance: null,
    traits: null,
    relationships: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function location(over: Partial<LocationProfile> = {}): LocationProfile {
  return {
    id: "l1",
    projectId: "p1",
    name: "Grauwerd",
    aliases: null,
    region: null,
    description: null,
    rules: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("levenshtein", () => {
  it("liefert 0 bei Gleichheit", () => {
    expect(levenshtein("Archiv", "Archiv")).toBe(0);
  });

  it("zählt einzelne Änderungen", () => {
    expect(levenshtein("Archiv", "Archif")).toBe(1);
    expect(levenshtein("Archiv", "Archief")).toBe(2);
  });

  it("behandelt leere Zeichenketten", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
});

describe("Figurenkonsistenz", () => {
  it("findet widersprüchliche Altersangaben als harten Fehler", () => {
    const text =
      "Marta war 48 Jahre alt und trat in das Archiv. " +
      "Später erfuhr man, dass Marta 52 Jahre alt war.";
    const issues = checkCharacters(analyzeText(text), [character()]);
    const err = issues.find((i) => i.kind === "error");

    expect(err).toBeTruthy();
    expect(err?.message).toContain("48");
    expect(err?.message).toContain("52");
    expect(err?.category).toBe("character");
    expect(err?.subject).toBe("Marta");
  });

  it("meldet einheitliche Altersangaben nicht", () => {
    const text =
      "Marta war 48 Jahre alt. Auch Jahre später blieb Marta 48 Jahre alt.";
    const issues = checkCharacters(analyzeText(text), [character()]);
    expect(issues.filter((i) => i.kind === "error")).toHaveLength(0);
  });

  it("meldet Abweichung vom Profil als möglich, nicht als Fehler", () => {
    const text = "Marta war 60 Jahre alt, als sie den Brief fand.";
    const issues = checkCharacters(analyzeText(text), [
      character({ age: "48" }),
    ]);
    const dev = issues.find((i) => i.message.includes("Profil"));

    expect(dev).toBeTruthy();
    expect(dev?.kind).toBe("possible");
  });

  it("erkennt Zahlwörter als Altersangabe", () => {
    const text =
      "Marta war vierzig Jahre alt damals. Heute ist Marta 50 Jahre alt.";
    const issues = checkCharacters(analyzeText(text), [character()]);
    expect(issues.some((i) => i.kind === "error")).toBe(true);
  });

  it("wirft bei fehlenden Profilen nicht", () => {
    expect(() => checkCharacters(analyzeText("Ein Text."), [])).not.toThrow();
  });
});

describe("Weltkonsistenz", () => {
  it("erkennt abweichende Schreibweise eines Ortsnamens", () => {
    const text = "Sie fuhr nach Grauwert und blieb dort über Nacht.";
    const issues = checkWorld(analyzeText(text), [location()]);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Grauwerd");
    expect(issues[0].kind).toBe("possible");
    expect(issues[0].start).toBeTypeOf("number");
  });

  it("meldet korrekte Schreibweise nicht", () => {
    const text = "Sie fuhr nach Grauwerd und blieb dort über Nacht.";
    expect(checkWorld(analyzeText(text), [location()])).toHaveLength(0);
  });

  it("meldet nicht erwähnte Orte nicht", () => {
    const text = "Sie blieb zu Hause und las den Brief noch einmal durch.";
    expect(checkWorld(analyzeText(text), [location()])).toHaveLength(0);
  });
});

describe("Perspektivkonsistenz", () => {
  it("erkennt einen Wechsel von Er/Sie zu Ich", () => {
    const text = [
      "Sie ging durch den Flur. Ihre Schritte hallten auf den Fliesen.",
      "",
      "Sie öffnete die Tür. Ihre Hand zitterte dabei ein wenig.",
      "",
      "Ich sah mich um. Mein Blick fiel auf den Schrank neben mir.",
    ].join("\n");
    const issues = checkPointOfView(analyzeText(text));

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].category).toBe("pov");
    expect(issues[0].kind).toBe("possible");
  });

  it("meldet einheitliche Perspektive nicht", () => {
    const text = [
      "Sie ging durch den Flur. Ihre Schritte hallten laut.",
      "",
      "Sie öffnete die Tür. Ihre Hand lag auf der Klinke.",
      "",
      "Sie trat ein. Ihr Blick suchte den Schrank an der Wand.",
    ].join("\n");
    expect(checkPointOfView(analyzeText(text))).toHaveLength(0);
  });

  it("meldet Ich-Formen in wörtlicher Rede nicht", () => {
    // Der entscheidende Fall: Ohne Dialogausnahme wäre jeder Dialog ein Alarm.
    const text = [
      "Sie ging durch den Flur. Ihre Schritte hallten auf den Fliesen.",
      "",
      "„Ich habe mir das anders vorgestellt“, sagte sie zu ihm.",
      "",
      "Sie öffnete die Tür. Ihre Hand zitterte dabei ein wenig stark.",
    ].join("\n");
    expect(checkPointOfView(analyzeText(text))).toHaveLength(0);
  });

  it("meldet bei zu wenig Material nichts", () => {
    expect(checkPointOfView(analyzeText("Sie ging fort."))).toHaveLength(0);
  });
});

describe("Begriffsdrift", () => {
  it("erkennt ähnliche Begriffsvarianten", () => {
    const text =
      "Im Archiv war es still. Das Archiv hatte lange geöffnet. " +
      "Sie ging ins Archief und fragte nach. Im Archief war niemand.";
    const issues = checkTerminology(analyzeText(text));
    const drift = issues.find((i) => i.message.includes("Archiv"));

    expect(drift).toBeTruthy();
    expect(drift?.category).toBe("terminology");
    expect(drift?.kind).toBe("possible");
  });

  it("erkennt Bindestrich-Varianten", () => {
    const text =
      "Die Nachtwache begann um zehn. Die Nacht-Wache endete im Morgen. " +
      "Auch die Nachtwache am Sonntag war ruhig und ohne Zwischenfall.";
    const issues = checkTerminology(analyzeText(text));
    expect(issues.some((i) => i.message.includes("Bindestrich"))).toBe(true);
  });

  it("meldet einheitliche Begriffe nicht", () => {
    const text =
      "Im Archiv war es still. Das Archiv hatte lange geöffnet heute. " +
      "Sie ging ins Archiv und fragte dort nach dem alten Bestand.";
    const drift = checkTerminology(analyzeText(text)).filter((i) =>
      i.message.includes("Uneinheitlich"),
    );
    expect(drift).toHaveLength(0);
  });

  it("meldet einmalige Wörter nicht", () => {
    const text = "Ein Fenster, ein Fenstern, ein Tisch. Nur je einmal genannt.";
    const issues = checkTerminology(analyzeText(text));
    expect(issues.filter((i) => i.message.includes("Fenster"))).toHaveLength(0);
  });
});

describe("Zeitlinie", () => {
  it("erkennt rückwärts laufende Jahre ohne Rückblick-Signal", () => {
    const text =
      "Im Jahr 1998 zog sie fort und begann ein neues Leben in der Stadt. " +
      "Dann kam das Jahr 1985 und alles änderte sich wieder von Grund auf.";
    const issues = checkTimeline(analyzeText(text));
    const back = issues.find((i) => i.message.includes("zurück"));

    expect(back).toBeTruthy();
    expect(back?.category).toBe("timeline");
    expect(back?.start).toBeTypeOf("number");
  });

  it("meldet angekündigte Rückblicke nicht", () => {
    // Literatur springt ständig in der Zeit — ein Signalwort genügt.
    const text =
      "Im Jahr 1998 zog sie fort und begann ein neues Leben in der Stadt. " +
      "Sie erinnerte sich an 1985, als alles noch anders gewesen war.";
    const back = checkTimeline(analyzeText(text)).filter((i) =>
      i.message.includes("zurück"),
    );
    expect(back).toHaveLength(0);
  });

  it("meldet aufsteigende Jahre nicht", () => {
    const text =
      "Im Jahr 1985 begann alles. Im Jahr 1998 war es dann vorbei damit.";
    const back = checkTimeline(analyzeText(text)).filter((i) =>
      i.message.includes("zurück"),
    );
    expect(back).toHaveLength(0);
  });

  it("erkennt zwei Monate im selben Absatz", () => {
    const text = "Es war im November, aber im Dezember wusste sie mehr davon.";
    const issues = checkTimeline(analyzeText(text));
    expect(issues.some((i) => i.message.includes("Monatsangaben"))).toBe(true);
  });
});

describe("Fehler und Möglichkeit werden unterschieden", () => {
  it("nutzt error nur für harte Widersprüche", () => {
    // Deine Anforderung: Fehler, mögliche Inkonsistenz und bewusste
    // Abweichung müssen unterscheidbar sein.
    const text = "Marta war 48 Jahre alt. Marta war 60 Jahre alt.";
    const issues = checkCharacters(analyzeText(text), [character()]);
    const errors = issues.filter((i) => i.kind === "error");

    expect(errors).toHaveLength(1);
    // Zwei Altersangaben zur selben Figur sind ein echter Widerspruch.
    expect(errors[0].weight).toBeGreaterThan(0.8);
  });

  it("nutzt possible für alles Deutbare", () => {
    const text = [
      "Sie ging fort. Ihre Schritte hallten im leeren Flur laut nach.",
      "",
      "Ich blieb zurück. Mein Blick folgte ihr durch das Fenster hinaus.",
    ].join("\n");
    for (const i of checkPointOfView(analyzeText(text))) {
      expect(i.kind).toBe("possible");
    }
  });

  it("liefert zu jedem Befund eine Erklärung", () => {
    const text = "Marta war 48 Jahre alt. Marta war 60 Jahre alt.";
    for (const i of checkCharacters(analyzeText(text), [character()])) {
      expect(i.explanation.length).toBeGreaterThan(40);
      expect(i.message.length).toBeGreaterThan(10);
    }
  });
});
