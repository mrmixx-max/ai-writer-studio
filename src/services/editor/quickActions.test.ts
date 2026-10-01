// Tests für die Schnellaktionen (WP2.2).
//
// Kernaussage: Die drei Aktionen sind inhaltlich verschieden — nicht dieselbe
// Anweisung mit anderer Temperatur. Sonst wären sie austauschbar.

import { describe, it, expect, vi } from "vitest";
import {
  runQuickAction,
  buildQuickActionPrompt,
  cleanPassage,
  QUICK_ACTIONS,
  quickActionSchema,
  type QuickActionId,
} from "./quickActions";

describe("QUICK_ACTIONS", () => {
  it("bietet genau die drei geforderten Aktionen", () => {
    expect(QUICK_ACTIONS.map((a) => a.id)).toEqual([
      "show-dont-tell",
      "atmosphere",
      "sharpen-dialogue",
    ]);
  });

  it("hat deutsche Beschriftungen und Hinweise", () => {
    for (const a of QUICK_ACTIONS) {
      expect(a.label.length).toBeGreaterThan(3);
      expect(a.hint.length).toBeGreaterThan(10);
    }
  });
});

describe("buildQuickActionPrompt — die Aktionen sind verschieden", () => {
  const passage = "Sie war wütend.";

  it("erzeugt für jede Aktion einen eigenen Prompt", () => {
    const prompts = QUICK_ACTIONS.map((a) => buildQuickActionPrompt(a.id, passage));
    const unique = new Set(prompts);
    expect(unique.size).toBe(3);
  });

  it("'show-dont-tell' verlangt Konkretes statt Benennung", () => {
    const p = buildQuickActionPrompt("show-dont-tell", passage);
    expect(p).toContain("Zeige, statt zu erzählen");
    expect(p).toContain("Handlung, Körperreaktion");
    // Das Beispiel ist der Kern der Anweisung.
    expect(p).toContain("Tischkante");
  });

  it("'atmosphere' verlangt Sinneseindrücke und verbietet Benennung", () => {
    const p = buildQuickActionPrompt("atmosphere", passage);
    expect(p).toContain("Sinneseindrücke");
    expect(p).toContain("unheimlich");
  });

  it("'sharpen-dialogue' verlangt unterscheidbare Stimmen", () => {
    const p = buildQuickActionPrompt("sharpen-dialogue", passage);
    expect(p).toContain("Stimme");
    expect(p).toContain("Subtext");
  });

  it("verbietet in allen Aktionen das Erfinden neuer Handlung", () => {
    for (const a of QUICK_ACTIONS) {
      const p = buildQuickActionPrompt(a.id, passage);
      expect(p).toMatch(/Erfinde KEINE/);
    }
  });

  it("grenzt die Textstelle klar ab", () => {
    const p = buildQuickActionPrompt("atmosphere", "Ein Satz.");
    expect(p).toContain("--- TEXTSTELLE (Anfang) ---");
    expect(p).toContain("--- TEXTSTELLE (Ende) ---");
    expect(p).toContain("Ein Satz.");
  });

  it("nimmt Kapiteltitel und Sprache auf", () => {
    const p = buildQuickActionPrompt("atmosphere", "X", { title: "Kapitel 3", language: "Englisch" });
    expect(p).toContain("Kapitel 3");
    expect(p).toContain("Englisch");
  });
});

describe("runQuickAction", () => {
  it("liest die Antwort aus dem JSON-Feld", async () => {
    const complete = vi.fn(async () => '{"text":"Ihre Finger krallten sich in die Tischkante."}');
    const r = await runQuickAction("show-dont-tell", "Sie war wütend.", complete);
    expect(r.text).toBe("Ihre Finger krallten sich in die Tischkante.");
    expect(r.action).toBe("show-dont-tell");
  });

  it("akzeptiert nackten Text ohne JSON-Hülle", async () => {
    const complete = vi.fn(async () => "Ein ganz normaler überarbeiteter Satz.");
    const r = await runQuickAction("atmosphere", "Der Raum war kalt.", complete);
    expect(r.text).toBe("Ein ganz normaler überarbeiteter Satz.");
  });

  it("entfernt einleitende Floskeln", async () => {
    const complete = vi.fn(async () => "Hier ist meine Überarbeitung: Der neue Satz.");
    const r = await runQuickAction("atmosphere", "Alt.", complete);
    expect(r.text).toBe("Der neue Satz.");
  });

  it("entfernt Code-Fences", async () => {
    const complete = vi.fn(async () => "```\nDer neue Satz.\n```");
    const r = await runQuickAction("atmosphere", "Alt.", complete);
    expect(r.text).toBe("Der neue Satz.");
  });

  it("wirft bei leerer Textstelle", async () => {
    const complete = vi.fn();
    await expect(runQuickAction("atmosphere", "   ", complete)).rejects.toThrow("leer");
    expect(complete).not.toHaveBeenCalled();
  });

  it("wirft, wenn das Modell nichts Brauchbares liefert", async () => {
    const complete = vi.fn(async () => "   ");
    await expect(runQuickAction("atmosphere", "Alt.", complete)).rejects.toThrow("keine brauchbare");
  });

  it("ruft das Modell genau einmal", async () => {
    const complete = vi.fn(async () => '{"text":"Neu."}');
    await runQuickAction("sharpen-dialogue", "Alt.", complete);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe("cleanPassage", () => {
  it("entfernt umschließende Anführungszeichen", () => {
    expect(cleanPassage('"Ein Satz."')).toBe("Ein Satz.");
    expect(cleanPassage("„Ein Satz.“")).toBe("Ein Satz.");
  });

  it("entfernt Fences und Floskeln kombiniert", () => {
    expect(cleanPassage('```json\n{"text":"x"}\n```')).toBe('{"text":"x"}');
  });

  it("lässt normalen Text unverändert", () => {
    expect(cleanPassage("Ein einfacher Satz.")).toBe("Ein einfacher Satz.");
  });

  it("trimmt Whitespace", () => {
    expect(cleanPassage("  Ein Satz.  ")).toBe("Ein Satz.");
  });
});

describe("quickActionSchema", () => {
  it("verlangt einen nicht-leeren text", () => {
    expect(quickActionSchema.safeParse({ text: "ok" }).success).toBe(true);
    expect(quickActionSchema.safeParse({ text: "" }).success).toBe(false);
    expect(quickActionSchema.safeParse({}).success).toBe(false);
  });

  it("deckt alle Aktions-IDs ab", () => {
    // Jede ID muss einen Prompt haben — sonst crasht runQuickAction zur Laufzeit.
    const ids: QuickActionId[] = ["show-dont-tell", "atmosphere", "sharpen-dialogue"];
    for (const id of ids) {
      expect(() => buildQuickActionPrompt(id, "x")).not.toThrow();
    }
  });
});
