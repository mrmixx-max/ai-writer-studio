// Tests für den Ghost-Text-Service (WP2.2).
//
// Kernaussage: Der Vorschlag muss ANSCHLIESSEN. Das häufigste Modellproblem ist
// nicht schlechter Stil, sondern Wiederholung — ein Vorschlag, der den Kontext
// nochmal erzählt, erzeugt beim Einfügen doppelten Text.

import { describe, it, expect, vi } from "vitest";
import {
  suggestContinuation,
  buildGhostPrompt,
  isUsableSuggestion,
  GHOST_CONTEXT_CHARS,
  GHOST_MAX_CHARS,
} from "./ghostText";

const CONTEXT =
  "Anna trat an das Fenster. Der Nebel lag tief über dem Fluss, und die Lichter " +
  "der Stadt verschwanden darin. Sie legte die Hand an die Scheibe.";

describe("buildGhostPrompt", () => {
  it("grenzt den bisherigen Text klar ab", () => {
    const p = buildGhostPrompt(CONTEXT);
    expect(p).toContain("--- BISHERIGER TEXT (Anfang) ---");
    expect(p).toContain("--- BISHERIGER TEXT (Ende) ---");
  });

  it("verbietet Wiederholung ausdrücklich", () => {
    const p = buildGhostPrompt(CONTEXT);
    expect(p).toContain("Wiederhole NICHTS");
    expect(p).toContain("Fasse den bisherigen Text NICHT zusammen");
  });

  it("begrenzt den Kontext auf das Ende", () => {
    const long = "Satz. ".repeat(2000); // deutlich > GHOST_CONTEXT_CHARS
    const p = buildGhostPrompt(long);
    // Der Anfang darf nicht im Prompt stehen.
    expect(p.length).toBeLessThan(long.length);
  });

  it("nimmt eine Zusatzvorgabe auf", () => {
    expect(buildGhostPrompt(CONTEXT, "Deutsch", "spannender")).toContain("spannender");
  });

  it("nimmt die Sprache auf", () => {
    expect(buildGhostPrompt(CONTEXT, "Englisch")).toContain("Englisch");
  });
});

describe("isUsableSuggestion", () => {
  it("akzeptiert eine echte Fortsetzung", () => {
    expect(isUsableSuggestion("Dann drehte sie sich um und ging.", CONTEXT)).toBe(true);
  });

  it("lehnt einen Vorschlag ab, der den Kontext wiederholt", () => {
    // Genau der Fehler, der beim Einfügen doppelten Text erzeugt.
    const repeat = CONTEXT.slice(-100);
    expect(isUsableSuggestion(repeat, CONTEXT)).toBe(false);
  });

  it("lehnt einen Vorschlag ab, der den ganzen Kontext enthält", () => {
    expect(isUsableSuggestion(CONTEXT + " Und dann.", CONTEXT)).toBe(false);
  });

  it("lehnt zu kurze Vorschläge ab", () => {
    expect(isUsableSuggestion("Ja.", CONTEXT)).toBe(false);
    expect(isUsableSuggestion("", CONTEXT)).toBe(false);
  });

  it("ist unempfindlich gegen Groß-/Kleinschreibung", () => {
    const repeat = CONTEXT.slice(-100).toUpperCase();
    expect(isUsableSuggestion(repeat, CONTEXT)).toBe(false);
  });

  it("ist unempfindlich gegen Whitespace-Unterschiede", () => {
    const repeat = CONTEXT.slice(-100).replace(/ /g, "  ");
    expect(isUsableSuggestion(repeat, CONTEXT)).toBe(false);
  });
});

describe("suggestContinuation", () => {
  it("liefert den Vorschlag aus dem JSON-Feld", async () => {
    const complete = vi.fn(async () => '{"text":"Dann drehte sie sich um."}');
    const r = await suggestContinuation(CONTEXT, complete);
    expect(r?.text).toBe("Dann drehte sie sich um.");
    expect(r?.attempts).toBe(1);
  });

  it("akzeptiert nackten Text", async () => {
    const complete = vi.fn(async () => "Dann drehte sie sich um und ging.");
    const r = await suggestContinuation(CONTEXT, complete);
    expect(r?.text).toBe("Dann drehte sie sich um und ging.");
  });

  it("gibt null zurück, wenn der Vorschlag nur wiederholt", async () => {
    // Besser keine Vorschau als doppelter Text beim Übernehmen.
    const complete = vi.fn(async () => JSON.stringify({ text: CONTEXT.slice(-100) }));
    const r = await suggestContinuation(CONTEXT, complete);
    expect(r).toBeNull();
  });

  it("gibt null bei leerem Kontext (kein Modellaufruf)", async () => {
    const complete = vi.fn();
    expect(await suggestContinuation("   ", complete)).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it("gibt null, wenn das Modell nichts liefert", async () => {
    const complete = vi.fn(async () => "  ");
    expect(await suggestContinuation(CONTEXT, complete)).toBeNull();
  });

  it("kürzt einen überlangen Vorschlag", async () => {
    const long = "Ein langer Satz mit vielen Wörtern. ".repeat(100);
    const complete = vi.fn(async () => JSON.stringify({ text: long }));
    const r = await suggestContinuation(CONTEXT, complete);
    expect(r!.text.length).toBeLessThanOrEqual(GHOST_MAX_CHARS);
  });

  it("entfernt Floskeln und Anführungszeichen", async () => {
    const complete = vi.fn(async () => '"Hier ist meine Überarbeitung: Dann ging sie."');
    const r = await suggestContinuation(CONTEXT, complete);
    expect(r?.text).toBe("Dann ging sie.");
  });

  it("reicht die Zusatzvorgabe an den Prompt weiter", async () => {
    const complete = vi.fn(async (_prompt: string) => '{"text":"Dann ging sie."}');
    await suggestContinuation(CONTEXT, complete, { instruction: "knapper Dialog" });
    expect(complete.mock.calls[0][0]).toContain("knapper Dialog");
  });

  it("respektiert die Kontextgrenze", () => {
    // Sicherstellen, dass die Konstante wirklich begrenzt (Regression).
    expect(GHOST_CONTEXT_CHARS).toBeGreaterThan(100);
    expect(GHOST_MAX_CHARS).toBeLessThan(GHOST_CONTEXT_CHARS);
  });
});
