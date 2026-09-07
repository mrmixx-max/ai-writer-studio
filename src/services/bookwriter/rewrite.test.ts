// Tests: LLM-Rewrite-Engine — `complete` ist in allen Tests gemockt,
// kein Netzwerk, keine Seiteneffekte.

import { describe, it, expect, vi } from "vitest";
import {
  buildRewritePrompt,
  createOllamaComplete,
  normalizeFindings,
  resolveRewriteOptions,
  rewritePassage,
  stripOuterQuotes,
  type CompleteFn,
  type RewriteFinding,
} from "@/services/bookwriter/rewrite";

const PASSAGE = "Der Detektiv betrat eigentlich irgendwie den dunklen Raum.";
const FINDINGS: RewriteFinding[] = [
  { issue: "Viele Füllwörter: eigentlich, irgendwie.", suggestion: "Füllwörter streichen." },
  { issue: "Sehr lange Sätze (über 40 Wörter)." },
];

function mockComplete(returnValue: string): { fn: CompleteFn; calls: string[] } {
  const calls: string[] = [];
  const fn: CompleteFn = async (prompt: string) => {
    calls.push(prompt);
    return returnValue;
  };
  return { fn, calls };
}

describe("rewritePassage — Erfolg", () => {
  it("gibt den verbesserten Text getrimmt zurück", async () => {
    const { fn, calls } = mockComplete("  Der Detektiv betrat den dunklen Raum.  ");
    const out = await rewritePassage(PASSAGE, FINDINGS, undefined, fn);
    expect(out).toBe("Der Detektiv betrat den dunklen Raum.");
    expect(calls).toHaveLength(1);
  });

  it("übergibt Befunde und Passage im Prompt an das LLM", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(PASSAGE, FINDINGS, undefined, fn);
    expect(calls[0]).toContain("Viele Füllwörter");
    expect(calls[0]).toContain("Füllwörter streichen");
    expect(calls[0]).toContain(PASSAGE);
  });

  it("akzeptiert reine String-Befunde", async () => {
    const { fn, calls } = mockComplete("neu");
    const out = await rewritePassage(PASSAGE, ["Füllwörter entfernen."], undefined, fn);
    expect(out).toBe("neu");
    expect(calls[0]).toContain("Füllwörter entfernen.");
  });

  it("akzeptiert ein ChapterQualityResult-artiges Objekt (issues + suggestions)", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(
      PASSAGE,
      { issues: ["Wortwiederholung: Raum (5×)."], suggestions: ["Synonyme nutzen."] },
      undefined,
      fn,
    );
    expect(calls[0]).toContain("Wortwiederholung");
    expect(calls[0]).toContain("Synonyme nutzen.");
  });

  it("funktioniert ohne explizite Optionen (Defaults preserve/same)", async () => {
    const { fn, calls } = mockComplete("neu");
    const out = await rewritePassage(PASSAGE, FINDINGS, undefined, fn);
    expect(out).toBe("neu");
    expect(calls[0]).toContain("Tonalitaet");
    expect(calls[0]).toContain("gleiche Laenge");
  });
});

describe("rewritePassage — leere Befunde", () => {
  it("gibt die Passage unverändert zurück und ruft das LLM NICHT", async () => {
    const spy = vi.fn(async (_p: string) => "sollte nie kommen");
    const out = await rewritePassage(PASSAGE, [], undefined, spy);
    expect(out).toBe(PASSAGE);
    expect(spy).not.toHaveBeenCalled();
  });

  it("verwirft Whitespace-Befunde wie leere Befunde", async () => {
    const spy = vi.fn(async (_p: string) => "sollte nie kommen");
    const out = await rewritePassage(PASSAGE, ["   ", { issue: "  " }], undefined, spy);
    expect(out).toBe(PASSAGE);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("rewritePassage — Ton-Optionen", () => {
  it("tone=formal verlangt formellere Formulierung", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(PASSAGE, FINDINGS, { tone: "formal" }, fn);
    expect(calls[0]).toContain("formeller");
  });

  it("tone=casual verlangt lockerere Formulierung", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(PASSAGE, FINDINGS, { tone: "casual" }, fn);
    expect(calls[0]).toContain("lockerer");
  });

  it("tone=preserve behält die Tonalität bei", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(PASSAGE, FINDINGS, { tone: "preserve" }, fn);
    expect(calls[0]).toContain("Tonalitaet");
  });
});

describe("rewritePassage — Längen-Optionen", () => {
  it("length=shorter verlangt Kürzung", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(PASSAGE, FINDINGS, { length: "shorter" }, fn);
    expect(calls[0]).toContain("Kuerze");
  });

  it("length=longer verlangt Ausbau", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(PASSAGE, FINDINGS, { length: "longer" }, fn);
    expect(calls[0]).toContain("Baue die Stelle aus");
  });

  it("length=same hält die Länge", async () => {
    const { fn, calls } = mockComplete("neu");
    await rewritePassage(PASSAGE, FINDINGS, { length: "same" }, fn);
    expect(calls[0]).toContain("gleiche Laenge");
  });
});

describe("rewritePassage — Fehlverhalten", () => {
  it("wirft bei leerer Passage", async () => {
    const { fn } = mockComplete("neu");
    await expect(rewritePassage("   ", FINDINGS, undefined, fn)).rejects.toThrow(/leer/i);
  });

  it("wirft bei Whitespace-Antwort des LLM (malformed)", async () => {
    const { fn } = mockComplete("   \n  ");
    await expect(rewritePassage(PASSAGE, FINDINGS, undefined, fn)).rejects.toThrow(
      /keine brauchbare Umformulierung/i,
    );
  });

  it("wirft bei leerer String-Antwort des LLM (malformed)", async () => {
    const { fn } = mockComplete("");
    await expect(rewritePassage(PASSAGE, FINDINGS, undefined, fn)).rejects.toThrow(
      /keine brauchbare Umformulierung/i,
    );
  });

  it("gibt LLM-Fehler mit Kontext weiter", async () => {
    const failing: CompleteFn = async () => {
      throw new Error("Netzwerk weg");
    };
    await expect(rewritePassage(PASSAGE, FINDINGS, undefined, failing)).rejects.toThrow(
      /LLM-Aufruf fehlgeschlagen.*Netzwerk weg/,
    );
  });

  it("wirft bei ungültigem Ton", async () => {
    const { fn } = mockComplete("neu");
    await expect(
      // @ts-expect-error Absichtlich ungültig — Validierung muss greifen.
      rewritePassage(PASSAGE, FINDINGS, { tone: "shakespeare" }, fn),
    ).rejects.toThrow(/Unbekannter Ton/);
  });

  it("wirft bei ungültiger Länge", async () => {
    const { fn } = mockComplete("neu");
    await expect(
      // @ts-expect-error Absichtlich ungültig — Validierung muss greifen.
      rewritePassage(PASSAGE, FINDINGS, { length: "roman" }, fn),
    ).rejects.toThrow(/Unbekannte Laenge/);
  });

  it("streift äußere Anführungszeichen der LLM-Antwort", async () => {
    const { fn } = mockComplete("„Der Detektiv betrat den Raum.“");
    const out = await rewritePassage(PASSAGE, FINDINGS, undefined, fn);
    expect(out).toBe("Der Detektiv betrat den Raum.");
  });
});

describe("Helfer", () => {
  it("normalizeFindings paart issues mit suggestions", () => {
    expect(
      normalizeFindings({ issues: ["A", "  ", "C"], suggestions: ["a-fix"] }),
    ).toEqual([{ issue: "A", suggestion: "a-fix" }, { issue: "C" }]);
  });

  it("resolveRewriteOptions liefert Defaults", () => {
    expect(resolveRewriteOptions()).toEqual({ tone: "preserve", length: "same" });
    expect(resolveRewriteOptions({ tone: "casual", length: "longer" })).toEqual({
      tone: "casual",
      length: "longer",
    });
  });

  it("buildRewritePrompt nummeriert Befunde und enthält Ton+ Länge", () => {
    const prompt = buildRewritePrompt(PASSAGE, FINDINGS, { tone: "formal", length: "shorter" });
    expect(prompt).toContain("1. Viele Füllwörter");
    expect(prompt).toContain("2. Sehr lange Sätze");
    expect(prompt).toContain("formeller");
    expect(prompt).toContain("Kuerze");
    expect(prompt).toContain("NUR die ueberarbeitete Textstelle");
  });

  it("stripOuterQuotes lässt normalen Text unverändert", () => {
    expect(stripOuterQuotes("  Ein Satz ohne Quotes.  ")).toBe("Ein Satz ohne Quotes.");
    expect(stripOuterQuotes('"quoted"')).toBe("quoted");
  });

  it("createOllamaComplete liefert eine Funktion (Lazy, ohne Seiteneffekt)", () => {
    expect(typeof createOllamaComplete()).toBe("function");
  });
});
