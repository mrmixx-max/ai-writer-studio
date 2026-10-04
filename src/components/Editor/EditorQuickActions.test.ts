/**
 * Tests: EditorQuickActions (WP 40.1 — Kontextuelle Schwebe-Leiste)
 *
 * Prüft die Aktionslogik (`runBubbleAction`). Die BubbleMenu-Komponente
 * selbst braucht einen TipTap-Editor und wird über die Logik abgedeckt.
 */

import { describe, it, expect } from "vitest";
import { runBubbleAction, type BubbleActionId } from "./EditorQuickActions";

const PROSE = `Der Algorithmus implementierte eine komplexe Datenbank-Schnittstelle.
Es wurde beschlossen, dass die Middleware angepasst werden muss.
Die Implementierung erfolgte durch das Team.`;

const DIALOGUE = `Anna: „Hallo, wie geht es dir?"
Bert: „Mir geht es bestens", sagte er.
Anna: „Wirklich?"
Bert: „Natürlich", antwortete er.`;

const SCENE = `INT. CAFE - TAG

Anna sitzt am Fenster und trägt einen Kaffee.

Anna: „Ich habe den Brief gefunden."

Sie legt das Papier auf den Tisch.`;

describe("runBubbleAction — Stil & Sinne", () => {
  it("liefert Stil-Metriken", () => {
    const out = runBubbleAction("style", PROSE);
    expect(out).toContain("Stil-Check");
    expect(out).toContain("Kognitive Belastung");
  });

  it("zeigt die 5-Sinne-Balance", () => {
    const out = runBubbleAction("style", PROSE);
    expect(out).toContain("5-Sinne-Balance");
    expect(out).toContain("👁");
    expect(out).toContain("👂");
  });

  it("warnt bei fehlenden Geruchs-/Tast-Eindrücken", () => {
    const out = runBubbleAction("style", PROSE);
    expect(out).toContain("Keine Geruchs-");
  });

  it("liefert Lesezeit", () => {
    const out = runBubbleAction("style", PROSE);
    expect(out).toContain("Lesezeit");
  });

  it("kommt mit kurzem Text zurecht", () => {
    const out = runBubbleAction("style", "Kurzer Satz.");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("kommt mit leerem Text zurecht", () => {
    const out = runBubbleAction("style", "");
    expect(typeof out).toBe("string");
  });
});

describe("runBubbleAction — Dialog-Check", () => {
  it("liefert Dialog-Analyse", () => {
    const out = runBubbleAction("dialogue", DIALOGUE);
    expect(out).toContain("Dialog-Check");
  });

  it("zählt Sprechverben", () => {
    const out = runBubbleAction("dialogue", DIALOGUE);
    expect(out).toContain("Sprechverben");
  });

  it("prüft auf Infodumps", () => {
    const out = runBubbleAction("dialogue", DIALOGUE);
    expect(out).toMatch(/Expositions-Dumps|Keine Infodumps/);
  });

  it("weist auf Subtext-Tags hin wenn keine da sind", () => {
    const out = runBubbleAction("dialogue", DIALOGUE);
    expect(out).toContain("Subtext");
  });

  it("kommt mit leerem Text zurecht", () => {
    const out = runBubbleAction("dialogue", "");
    expect(typeof out).toBe("string");
  });
});

describe("runBubbleAction — Roman → Drehbuch", () => {
  it("liefert Drehbuch-Wandlung", () => {
    const out = runBubbleAction("screenplay", SCENE);
    expect(out).toContain("Drehbuch-Wandlung");
  });

  it("erkennt Sluglines", () => {
    const out = runBubbleAction("screenplay", SCENE);
    expect(out).toContain("INT.");
  });

  it("nennt Szenenanzahl", () => {
    const out = runBubbleAction("screenplay", SCENE);
    expect(out).toMatch(/\d+ Szene/);
  });

  it("kommt mit leerem Text zurecht", () => {
    const out = runBubbleAction("screenplay", "");
    expect(typeof out).toBe("string");
  });
});

describe("runBubbleAction — Robustheit", () => {
  it("unbekannte Aktion ergibt leeren String", () => {
    expect(runBubbleAction("unbekannt" as BubbleActionId, "Text")).toBe("");
  });

  it("alle drei Aktionen liefern String für denselben Text", () => {
    for (const action of ["style", "dialogue", "screenplay"] as BubbleActionId[]) {
      const out = runBubbleAction(action, PROSE);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
