// Multi-Agent Writer's Room (WP 7.1)
// Lokaler, deterministischer Service — keine LLM-Aufrufe.
// Die Prompts sind reine Text-Vorlagen für spätere LLM-Integration.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface WriterPersona {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  icon: string;
}

export interface PersonaResponse {
  personaId: string;
  content: string;
  suggestions: string[];
}

export interface DiscussionSynthesis {
  summary: string;
  bestOptions: { description: string; source: string }[];
  actionItems: string[];
}

// ---------------------------------------------------------------------------
// Persona-Definitionen
// ---------------------------------------------------------------------------

export const WRITER_PERSONAS: WriterPersona[] = [
  {
    id: "dramaturg",
    name: "Dramaturg",
    role: "Struktur & Kausalität",
    systemPrompt: `Du bist der Dramaturg in einer Writer's Room.
Deine Aufgabe: Kausalitätsfehler, Plot-Lücken und Strukturprobleme finden.
Prüfe jede Idee auf logische Kette: Ursache → Wirkung → Konsequenz.
Frage immer: "Warum passiert das?" und "Was wäre, wenn nicht?"`,
    icon: "🎭",
  },
  {
    id: "psychologe",
    name: "Psychologe",
    role: "Motivation & Charakter",
    systemPrompt: `Du bist der Psychologe in einer Writer's Room.
Deine Aufgabe: Motivationen, Charakterpsychologie und emotionale Authentizität bewerten.
Prüfe: Warum handelt die Figur so? Ist das Motiv glaubwürdig?
Frage: "Was will die Figur wirklich — und warum gerade das?"`,
    icon: "🧠",
  },
  {
    id: "worldbuilder",
    name: "Worldbuilder",
    role: "Welt & Regeln",
    systemPrompt: `Du bist der Worldbuilder in einer Writer's Room.
Deine Aufgabe: Welt-Regeln, Setting-Konsistenz und Logik der Welt sicherstellen.
Prüfe: Bricht die Idee etablierte Regeln? Sind die Konsequenzen klar?
Frage: "Was passiert in dieser Welt, wenn das gilt?"`,
    icon: "🌍",
  },
  {
    id: "teufelsadvokat",
    name: "Teufelsadvokat",
    role: "Klischees & Konventionen",
    systemPrompt: `Du bist der Teufelsadvokat in einer Writer's Room.
Deine Aufgabe: Klischees, Vorhersehbarkeit und konventionelle Lösungen zerstören.
Prüfe: Ist das zu erwarten? Hast du das schon mal gesehen?
Frage: "Wie kann man das überraschender, ungewöhnlicher, besser machen?"`,
    icon: "😈",
  },
];

// ---------------------------------------------------------------------------
// Öffentliche Funktionen
// ---------------------------------------------------------------------------

/**
 * Gibt die vier Agenten-Personas zurück.
 */
export function getWriterPersonas(): WriterPersona[] {
  return [...WRITER_PERSONAS];
}

/**
 * Baut den vollständigen Prompt für einen Agenten.
 * Setzt System-Prompt, Kontext und Aufgabenstellung zusammen.
 */
export function buildPersonaPrompt(persona: WriterPersona, context: string): string {
  const safeContext = context.trim() || "(Kein Kontext angegeben)";
  return [
    persona.systemPrompt,
    "",
    "--- KONTEXT ---",
    safeContext,
    "--- ENDE KONTEXT ---",
    "",
    "Analysiere den Kontext aus deiner Perspektive und gib konkrete, umsetzbare Vorschläge.",
  ].join("\n");
}

/**
 * Fasst die Antworten aller Agenten zusammen.
 * Extrahiert die besten Optionen und Action Items deterministisch.
 */
export function synthesizeDiscussion(responses: PersonaResponse[]): DiscussionSynthesis {
  if (!responses || responses.length === 0) {
    return {
      summary: "Keine Diskussion verfügbar.",
      bestOptions: [],
      actionItems: [],
    };
  }

  // --- Zusammenfassung ---
  const summary = buildSummary(responses);

  // --- Beste Optionen ---
  const bestOptions = extractBestOptions(responses);

  // --- Action Items ---
  const actionItems = extractActionItems(responses);

  return { summary, bestOptions, actionItems };
}

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

function buildSummary(responses: PersonaResponse[]): string {
  const parts: string[] = [];
  for (const r of responses) {
    const persona = WRITER_PERSONAS.find((p) => p.id === r.personaId);
    const label = persona ? persona.name : r.personaId;
    const content = r.content.trim();
    if (content) {
      parts.push(`${label}: ${content}`);
    }
  }
  return parts.length > 0 ? parts.join("\n\n") : "Keine Inhalte vorhanden.";
}

function extractBestOptions(responses: PersonaResponse[]): { description: string; source: string }[] {
  const options: { description: string; source: string }[] = [];
  for (const r of responses) {
    const persona = WRITER_PERSONAS.find((p) => p.id === r.personaId);
    const source = persona ? persona.name : r.personaId;
    for (const suggestion of r.suggestions) {
      const trimmed = suggestion.trim();
      if (trimmed) {
        options.push({ description: trimmed, source });
      }
    }
  }
  return options;
}

function extractActionItems(responses: PersonaResponse[]): string[] {
  const items: string[] = [];
  for (const r of responses) {
    const persona = WRITER_PERSONAS.find((p) => p.id === r.personaId);
    const label = persona ? persona.name : r.personaId;
    const content = r.content.trim();
    if (content) {
      // Ersten Satz als Action Item extrahieren
      const firstSentence = content.split(/[.!?]\s/)[0]?.trim();
      if (firstSentence && firstSentence.length > 3) {
        items.push(`[${label}] ${firstSentence}`);
      }
    }
  }
  return items;
}
