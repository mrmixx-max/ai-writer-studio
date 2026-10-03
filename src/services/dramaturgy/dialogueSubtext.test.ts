// Tests: Dialog-Subtext & Machtbalance (WP 37.1).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  detectExpositionDump,
  analyzePowerBalance,
  detectSubtextMarkers,
  UNKNOWN_SPEAKER,
  MIN_TOPIC_TOKEN_LENGTH,
} from "./dialogueSubtext";
import type { DialogueLine, PowerBalance } from "./dialogueSubtext";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Dialogzeile bauen (Sprechakte standardmäßig aus). */
function line(
  speaker: string,
  text: string,
  flags: Partial<Pick<DialogueLine, "isQuestion" | "isCommand" | "interrupts">> = {},
): DialogueLine {
  return {
    speaker,
    text,
    isQuestion: flags.isQuestion ?? false,
    isCommand: flags.isCommand ?? false,
    interrupts: flags.interrupts ?? false,
  };
}

// ---------------------------------------------------------------------------
// 1) detectExpositionDump
// ---------------------------------------------------------------------------

describe("detectExpositionDump", () => {
  it("liefert ein leeres Array für leere oder ungültige Eingaben", () => {
    expect(detectExpositionDump("")).toEqual([]);
    expect(detectExpositionDump("   ")).toEqual([]);
    expect(detectExpositionDump(undefined as unknown as string)).toEqual([]);
    expect(detectExpositionDump(null as unknown as string)).toEqual([]);
    expect(detectExpositionDump(42 as unknown as string)).toEqual([]);
  });

  it("erkennt einen klassischen „As you know, Bob\"-Marker mit Position", () => {
    const findings = detectExpositionDump("Wie du weißt, ist das Haus alt.");
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe("wie du weißt");
    expect(findings[0].position).toBe(0);
    expect(findings[0].reason).toContain("As you know");
  });

  it("wertet case-insensitiv aus", () => {
    const findings = detectExpositionDump("AS YOU KNOW, this is important.");
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe("as you know");
    expect(findings[0].position).toBe(0);
  });

  it("sortiert mehrere Treffer stabil nach Position", () => {
    const findings = detectExpositionDump("Wie du weißt, und wie gesagt, ist das so.");
    expect(findings.map((f) => f.phrase)).toEqual(["wie du weißt", "wie gesagt"]);
    expect(findings.map((f) => f.position)).toEqual([0, 18]);
  });

  it("meldet keine Treffer bei unauffälligem Dialog", () => {
    expect(detectExpositionDump("Der Hund läuft über die Wiese.")).toEqual([]);
  });

  it("ordnet Allgemeinwissen-Phrasen der passenden Begründung zu", () => {
    const findings = detectExpositionDump("Bekanntlich ist er der Chef.");
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe("bekanntlich");
    expect(findings[0].reason).toContain("Allgemeinwissen");
  });

  it("liefert bei wiederholter Ausführung identische Ergebnisse", () => {
    const text = "Wie bereits gesagt, das ist der Plan.";
    expect(detectExpositionDump(text)).toEqual(detectExpositionDump(text));
  });
});

// ---------------------------------------------------------------------------
// 2) analyzePowerBalance
// ---------------------------------------------------------------------------

describe("analyzePowerBalance", () => {
  const EMPTY: PowerBalance = { speakers: [], dominantSpeaker: "" };

  it("liefert ein Null-Ergebnis bei fehlenden Zeilen", () => {
    expect(analyzePowerBalance([])).toEqual(EMPTY);
    expect(analyzePowerBalance(undefined as unknown as DialogueLine[])).toEqual(EMPTY);
    expect(analyzePowerBalance(null as unknown as DialogueLine[])).toEqual(EMPTY);
  });

  it("misst Redezeit, Fragen-, Befehlsanteil und Themawechsel je Sprecher", () => {
    const lines: DialogueLine[] = [
      line("Anna", "Hast du den Schlüssel", { isQuestion: true }),
      line("Ben", "Nein"),
      line("Anna", "Gib mir den Schlüssel sofort", { isCommand: true, interrupts: true }),
    ];
    const balance = analyzePowerBalance(lines);

    expect(balance.speakers).toHaveLength(2);

    const anna = balance.speakers.find((s) => s.name === "Anna")!;
    expect(anna.talkRatio).toBe(0.9); // 9 von 10 Wörtern
    expect(anna.questionRatio).toBe(1); // einzige Frage
    expect(anna.commandRatio).toBe(1); // einziger Befehl
    expect(anna.topicChanges).toBe(1);

    const ben = balance.speakers.find((s) => s.name === "Ben")!;
    expect(ben.talkRatio).toBe(0.1);
    expect(ben.questionRatio).toBe(0);
    expect(ben.commandRatio).toBe(0);
    expect(ben.topicChanges).toBe(1);
  });

  it("bestimmt die dominierende Sprecherposition", () => {
    const lines: DialogueLine[] = [
      line("Anna", "Hast du den Schlüssel", { isQuestion: true }),
      line("Ben", "Nein"),
      line("Anna", "Gib mir den Schlüssel sofort", { isCommand: true }),
    ];
    expect(analyzePowerBalance(lines).dominantSpeaker).toBe("Anna");
  });

  it("sortiert Sprecher absteigend nach Redezeit", () => {
    const lines: DialogueLine[] = [
      line("Anna", "Hast du den Schlüssel", { isQuestion: true }),
      line("Ben", "Nein"),
      line("Anna", "Gib mir den Schlüssel sofort", { isCommand: true }),
    ];
    expect(analyzePowerBalance(lines).speakers.map((s) => s.name)).toEqual(["Anna", "Ben"]);
  });

  it("bricht Gleichstand bei der Redezeit alphabetisch", () => {
    const lines: DialogueLine[] = [line("Zoe", "Hallo Welt"), line("Anna", "Guten Tag")];
    const balance = analyzePowerBalance(lines);
    expect(balance.speakers.map((s) => s.name)).toEqual(["Anna", "Zoe"]);
    expect(balance.speakers[0].talkRatio).toBe(0.5);
    expect(balance.speakers[1].talkRatio).toBe(0.5);
    expect(balance.dominantSpeaker).toBe("Anna");
  });

  it("berechnet Fragen- und Befehlsanteile korrekt über mehrere Sprecher", () => {
    const lines: DialogueLine[] = [
      line("Anna", "Warum bist du hier", { isQuestion: true }),
      line("Ben", "Wer hat das gesagt", { isQuestion: true }),
      line("Anna", "Antworte mir jetzt", { isCommand: true }),
    ];
    const balance = analyzePowerBalance(lines);
    const anna = balance.speakers.find((s) => s.name === "Anna")!;
    const ben = balance.speakers.find((s) => s.name === "Ben")!;
    expect(anna.questionRatio).toBe(0.5);
    expect(ben.questionRatio).toBe(0.5);
    expect(anna.commandRatio).toBe(1);
    expect(ben.commandRatio).toBe(0);
  });

  it("setzt fehlende oder leere Sprecher auf den Standardnamen", () => {
    const lines = [
      line("", "Hallo Welt"),
      { text: "Guten Tag" } as unknown as DialogueLine,
    ];
    const balance = analyzePowerBalance(lines);
    expect(balance.speakers).toHaveLength(1);
    expect(balance.speakers[0].name).toBe(UNKNOWN_SPEAKER);
  });

  it("liefert 0-Anteile, wenn keine Frage und kein Befehl vorkommen", () => {
    const balance = analyzePowerBalance([line("Anna", "Hallo Welt")]);
    expect(balance.speakers[0].questionRatio).toBe(0);
    expect(balance.speakers[0].commandRatio).toBe(0);
  });

  it("behandelt nicht-boolesche Sprechakt-Flags defensiv als false", () => {
    const lines = [
      {
        speaker: "Anna",
        text: "Hallo Welt",
        isQuestion: "yes",
        isCommand: 1,
        interrupts: "x",
      } as unknown as DialogueLine,
    ];
    const balance = analyzePowerBalance(lines);
    expect(balance.speakers[0].questionRatio).toBe(0);
    expect(balance.speakers[0].commandRatio).toBe(0);
  });

  it("erkennt Themawechsel bei disjunkten signifikanten Tokens", () => {
    const lines: DialogueLine[] = [line("Anna", "Schlüssel"), line("Ben", "Garten")];
    const balance = analyzePowerBalance(lines);
    expect(balance.speakers.find((s) => s.name === "Ben")!.topicChanges).toBe(1);
  });

  it("zählt keinen Themawechsel, wenn eine Zeile kein signifikantes Token hat", () => {
    // Anna hat nur kurze Wörter/Stoppwörter → keine Basis für einen Wechsel.
    const lines: DialogueLine[] = [line("Anna", "Wo ist er"), line("Ben", "Dort am Fluss")];
    const balance = analyzePowerBalance(lines);
    expect(balance.speakers.find((s) => s.name === "Ben")!.topicChanges).toBe(0);
  });

  it("wirft nicht bei ungültigen Einträgen und liefert identische Ergebnisse", () => {
    const lines = [line("Anna", "Hallo Welt"), null as unknown as DialogueLine];
    expect(() => analyzePowerBalance(lines)).not.toThrow();
    expect(analyzePowerBalance(lines)).toEqual(analyzePowerBalance(lines));
  });
});

// ---------------------------------------------------------------------------
// 3) detectSubtextMarkers
// ---------------------------------------------------------------------------

describe("detectSubtextMarkers", () => {
  it("markiert eine beschwichtigende Aussage mit angespanntem Action-Tag", () => {
    const markers = detectSubtextMarkers("Mir geht es gut. Ich habe alles im Griff.", [
      "zittert",
      "nickt",
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0].statement).toBe("Mir geht es gut");
    expect(markers[0].actionTag).toBe("zittert");
    expect(markers[0].discrepancy).toContain("Diskrepanz");
  });

  it("markiert eine schroffe Aussage mit warmer Handlung", () => {
    const markers = detectSubtextMarkers("Ich hasse dich. Verschwinde.", ["lächelt"]);
    expect(markers).toHaveLength(1);
    expect(markers[0].statement).toBe("Ich hasse dich");
    expect(markers[0].actionTag).toBe("lächelt");
    expect(markers[0].discrepancy).toContain("Wärme");
  });

  it("meldet keine Diskrepanz, wenn Aussage und Handlung zusammenpassen", () => {
    expect(detectSubtextMarkers("Mir geht es gut.", ["lächelt"])).toEqual([]);
  });

  it("meldet keine Diskrepanz bei neutraler Aussage", () => {
    expect(detectSubtextMarkers("Der Zug fährt um acht.", ["zittert"])).toEqual([]);
  });

  it("liefert ein leeres Array bei fehlenden oder ungültigen Eingaben", () => {
    expect(detectSubtextMarkers("", ["zittert"])).toEqual([]);
    expect(detectSubtextMarkers("Mir geht es gut.", [])).toEqual([]);
    expect(detectSubtextMarkers(undefined as unknown as string, ["zittert"])).toEqual([]);
    expect(detectSubtextMarkers("Mir geht es gut.", undefined as unknown as string[])).toEqual([]);
  });

  it("paart nur so viele Elemente wie kürzere Liste (Index-Ausrichtung)", () => {
    const markers = detectSubtextMarkers("Mir geht es gut.", ["zittert", "weint", "lächelt"]);
    expect(markers).toHaveLength(1);
    expect(markers[0].actionTag).toBe("zittert");
  });

  it("ignoriert leere Action-Tags", () => {
    const markers = detectSubtextMarkers("Mir geht es gut. Ich freue mich.", ["   ", "zittert"]);
    expect(markers).toHaveLength(1);
    expect(markers[0].actionTag).toBe("zittert");
  });

  it("liefert bei wiederholter Ausführung identische Ergebnisse", () => {
    const dialogue = "Mir geht es gut.";
    const tags = ["zittert"];
    expect(detectSubtextMarkers(dialogue, tags)).toEqual(detectSubtextMarkers(dialogue, tags));
  });
});

// ---------------------------------------------------------------------------
// Vertrag / Konstanten
// ---------------------------------------------------------------------------

describe("Vertrag", () => {
  it("führt den Standardnamen für unbekannte Sprecher", () => {
    expect(UNKNOWN_SPEAKER).toBe("Unbekannt");
  });

  it("setzt die minimale Topic-Token-Länge deterministisch", () => {
    expect(MIN_TOPIC_TOKEN_LENGTH).toBe(4);
  });

  it("liefert die erwarteten Sprecher-Felder", () => {
    const balance = analyzePowerBalance([line("Anna", "Hallo Welt")]);
    expect(Object.keys(balance.speakers[0]).sort()).toEqual([
      "commandRatio",
      "name",
      "questionRatio",
      "talkRatio",
      "topicChanges",
    ]);
  });
});
