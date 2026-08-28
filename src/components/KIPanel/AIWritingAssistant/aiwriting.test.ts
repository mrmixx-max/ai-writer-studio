// Unit-Tests für die pure Logik des AI Writing Assistant.
import { describe, expect, it } from "vitest";
import { debounce, heuristicSuggestions } from "@/services/aiwriting/autocomplete";
import { buildStyleTransferPrompt, findStyle, LITERARY_STYLES } from "@/services/aiwriting/styletransfer";
import { buildDialogPrompt, parseDialogLines } from "@/services/aiwriting/dialoggen";
import { buildWritingPromptPrompt, localWritingPrompt } from "@/services/aiwriting/writingprompts";

describe("autocomplete", () => {
  it("debounce ruft fn erst nach der Wartezeit auf", async () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 30);
    fn(); fn(); fn();
    expect(calls).toBe(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toBe(1);
  });

  it("heuristicSuggestions liefert Fortsetzungen aus dem Text", () => {
    const prefix = "Sie öffnete die Tür. Sie öffnete die Tür langsam und";
    const out = heuristicSuggestions(prefix);
    expect(Array.isArray(out)).toBe(true);
  });

  it("heuristicSuggestions gibt leer zurück bei zu kurzem Prefix", () => {
    expect(heuristicSuggestions("Hallo du")).toEqual([]);
  });
});

describe("styletransfer", () => {
  it("alle Stile haben id, label und brief", () => {
    for (const s of LITERARY_STYLES) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.brief.length).toBeGreaterThan(20);
    }
  });

  it("findStyle fällt auf den ersten Stil zurück", () => {
    expect(findStyle("gibtsnicht").id).toBe(LITERARY_STYLES[0].id);
    expect(findStyle("hemingway").label).toBe("Ernest Hemingway");
  });

  it("Prompt enthält Zielstil und Text", () => {
    const p = buildStyleTransferPrompt({ text: "Es regnete.", styleId: "juenger" });
    expect(p).toContain("Ernst Jünger");
    expect(p).toContain("Es regnete.");
  });
});

describe("dialoggen", () => {
  it("parst 'NAME: Text' und 'NAME (Regie): Text'", () => {
    const lines = parseDialogLines(
      "ANNA (stellt die Tasse ab): Ich fahre morgen.\nBENNO: Und wenn nicht?\nKein Dialog hier\n",
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ speaker: "ANNA", text: "Ich fahre morgen.", stageDirection: "stellt die Tasse ab" });
    expect(lines[1].stageDirection).toBeUndefined();
  });

  it("Prompt enthält Figuren, Situation, Untertext-Flag", () => {
    const p = buildDialogPrompt({
      characters: [{ name: "Anna", description: "müde" }, { name: "Benno" }],
      situation: "Küche",
      goal: "Streit",
      withSubtext: true,
      lineCount: 6,
    });
    expect(p).toContain("Anna: müde");
    expect(p).toContain("Benno");
    expect(p).toContain("Küche");
    expect(p).toContain("UNTERRAST");
    expect(p).toContain("6");
  });
});

describe("writingprompts", () => {
  it("lokaler Würfel liefert count eindeutige Impulse", () => {
    const out = localWritingPrompt(4);
    expect(out).toHaveLength(4);
    expect(new Set(out).size).toBe(4);
    for (const t of out) expect(t).toMatch(/^Schreibe:/);
  });

  it("Prompt enthält Art und Kontext", () => {
    const p = buildWritingPromptPrompt({ kind: "szene", count: 3, context: "Ein Winternachmittag." });
    expect(p).toContain("Szene");
    expect(p).toContain("3");
    expect(p).toContain("Ein Winternachmittag.");
  });
});
