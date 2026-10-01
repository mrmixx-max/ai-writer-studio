// Tests: Multi-Agent Writer's Room (WP 7.1)
import { describe, expect, it } from "vitest";
import {
  buildPersonaPrompt,
  getWriterPersonas,
  synthesizeDiscussion,
  type PersonaResponse,
  type WriterPersona,
} from "./writersRoom";

// ---------------------------------------------------------------------------
// getWriterPersonas
// ---------------------------------------------------------------------------

describe("getWriterPersonas", () => {
  it("genau 4 Personas", () => {
    const personas = getWriterPersonas();
    expect(personas).toHaveLength(4);
  });

  it("enthält Dramaturg, Psychologe, Worldbuilder, Teufelsadvokat", () => {
    const ids = getWriterPersonas().map((p) => p.id);
    expect(ids).toContain("dramaturg");
    expect(ids).toContain("psychologe");
    expect(ids).toContain("worldbuilder");
    expect(ids).toContain("teufelsadvokat");
  });

  it("jede Persona hat id, name, role, systemPrompt, icon", () => {
    for (const p of getWriterPersonas()) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.role).toBeTruthy();
      expect(p.systemPrompt).toBeTruthy();
      expect(p.icon).toBeTruthy();
    }
  });

  it("Personas sind unabhängig vom internen Array (Kopie)", () => {
    const a = getWriterPersonas();
    const b = getWriterPersonas();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// buildPersonaPrompt
// ---------------------------------------------------------------------------

describe("buildPersonaPrompt", () => {
  const samplePersona: WriterPersona = {
    id: "dramaturg",
    name: "Dramaturg",
    role: "Struktur & Kausalität",
    systemPrompt: "Du bist der Dramaturg.",
    icon: "🎭",
  };

  it("enthält System-Prompt und Kontext", () => {
    const prompt = buildPersonaPrompt(samplePersona, "Der Held findet eine Karte.");
    expect(prompt).toContain("Du bist der Dramaturg.");
    expect(prompt).toContain("Der Held findet eine Karte.");
  });

  it("leerer Kontext → Platzhalter", () => {
    const prompt = buildPersonaPrompt(samplePersona, "");
    expect(prompt).toContain("(Kein Kontext angegeben)");
  });

  it("Whitespace-only Kontext → Platzhalter", () => {
    const prompt = buildPersonaPrompt(samplePersona, "   \n  ");
    expect(prompt).toContain("(Kein Kontext angegeben)");
  });

  it("enthält Kontext-Trennmarker", () => {
    const prompt = buildPersonaPrompt(samplePersona, "Test");
    expect(prompt).toContain("--- KONTEXT ---");
    expect(prompt).toContain("--- ENDE KONTEXT ---");
  });
});

// ---------------------------------------------------------------------------
// synthesizeDiscussion
// ---------------------------------------------------------------------------

describe("synthesizeDiscussion", () => {
  it("leeres Array → leere Synthese", () => {
    const result = synthesizeDiscussion([]);
    expect(result.summary).toBe("Keine Diskussion verfügbar.");
    expect(result.bestOptions).toEqual([]);
    expect(result.actionItems).toEqual([]);
  });

  it("null/undefined → leere Synthese", () => {
    const result = synthesizeDiscussion(undefined as unknown as PersonaResponse[]);
    expect(result.summary).toBe("Keine Diskussion verfügbar.");
  });

  it("extrahiert bestOptions aus suggestions", () => {
    const responses: PersonaResponse[] = [
      {
        personaId: "dramaturg",
        content: "Die Kausalität hält.",
        suggestions: ["Füge einen Wendepunkt in Akt 2 hinzu"],
      },
      {
        personaId: "psychologe",
        content: "Motivation ist glaubwürdig.",
        suggestions: ["Vertiefe den inneren Konflikt"],
      },
    ];
    const result = synthesizeDiscussion(responses);
    expect(result.bestOptions).toHaveLength(2);
    expect(result.bestOptions[0].description).toBe("Füge einen Wendepunkt in Akt 2 hinzu");
    expect(result.bestOptions[0].source).toBe("Dramaturg");
    expect(result.bestOptions[1].source).toBe("Psychologe");
  });

  it("extrahiert actionItems aus content", () => {
    const responses: PersonaResponse[] = [
      {
        personaId: "worldbuilder",
        content: "Die Welt-Regel muss präziser formuliert werden. Sonst bricht die Logik.",
        suggestions: [],
      },
    ];
    const result = synthesizeDiscussion(responses);
    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0]).toContain("Worldbuilder");
    expect(result.actionItems[0]).toContain("Welt-Regel");
  });

  it("leere suggestions → keine bestOptions", () => {
    const responses: PersonaResponse[] = [
      { personaId: "teufelsadvokat", content: "Das ist ein Klischee.", suggestions: [] },
    ];
    const result = synthesizeDiscussion(responses);
    expect(result.bestOptions).toEqual([]);
  });

  it("unbekannte personaId → Fallback als source", () => {
    const responses: PersonaResponse[] = [
      {
        personaId: "unbekannt",
        content: "Test",
        suggestions: ["Vorschlag"],
      },
    ];
    const result = synthesizeDiscussion(responses);
    expect(result.bestOptions[0].source).toBe("unbekannt");
  });

  it("summary enthält alle Persona-Namen und Inhalte", () => {
    const responses: PersonaResponse[] = [
      { personaId: "dramaturg", content: "Struktur ok.", suggestions: [] },
      { personaId: "psychologe", content: "Motivation schwach.", suggestions: [] },
    ];
    const result = synthesizeDiscussion(responses);
    expect(result.summary).toContain("Dramaturg");
    expect(result.summary).toContain("Struktur ok.");
    expect(result.summary).toContain("Psychologe");
    expect(result.summary).toContain("Motivation schwach.");
  });

  it("mehrere Antworten → alle bestOptions gesammelt", () => {
    const responses: PersonaResponse[] = [
      { personaId: "dramaturg", content: "A", suggestions: ["S1", "S2"] },
      { personaId: "psychologe", content: "B", suggestions: ["S3"] },
      { personaId: "worldbuilder", content: "C", suggestions: ["S4", "S5"] },
      { personaId: "teufelsadvokat", content: "D", suggestions: ["S6"] },
    ];
    const result = synthesizeDiscussion(responses);
    expect(result.bestOptions).toHaveLength(6);
  });
});
