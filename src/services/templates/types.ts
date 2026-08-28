// Gemeinsame Typen für das Vorlagen-System.
//
// Vorlagen sind reine Daten: keine Abhängigkeiten zur DB, keine
// Nebenwirkungen. Das Anwenden passiert ausschließlich im Service
// (applyTemplates), damit Vorlagen testbar und importierbar bleiben.

/** Kapitel-Entwurf einer Buch-Vorlage. */
export interface TemplateChapter {
  /** Kapiteltitel, z. B. "1. Aufbruch". */
  title: string;
  /** Kurze Beschreibung, was in diesem Kapitel passiert. */
  description: string;
}

/** Buch-Vorlage: Genre mit vordefinierter Kapitelstruktur. */
export interface BookTemplate {
  id: string;
  name: string;
  /** Roman, Sachbuch, Drehbuch, Essay … */
  genre: string;
  description: string;
  /** Ziel-Richtwert in Wörtern (nur Orientierung, keine Sperre). */
  targetWords: number;
  chapters: TemplateChapter[];
}

/** Figuren-Vorlage: archetypische Ausgangskonfiguration. */
export interface CharacterTemplate {
  id: string;
  name: string;
  /** Held, Mentor, Antagonist, Liebe … */
  archetype: string;
  description: string;
  fields: {
    aliases?: string;
    age?: string;
    occupation?: string;
    appearance?: string;
    traits?: string;
    relationships?: string;
    notes?: string;
  };
}

/** Plot-Vorlage: strukturelles Gerüst als Projekt-Notiz. */
export interface PlotTemplate {
  id: string;
  name: string;
  description: string;
  /** Reihenfolge der Strukturelemente (Stationen/Akte). */
  beats: { title: string; description: string }[];
}

/** Nutzerauswahl im Assistenten. */
export interface TemplateSelection {
  book?: string; // BookTemplate.id
  characters?: string[]; // CharacterTemplate.ids
  plot?: string; // PlotTemplate.id
}

/** Serialisiertes Vorlagen-Paket für Import/Export. */
export interface TemplateBundle {
  format: "ai-writer-studio/templates";
  version: 1;
  exportedAt: string;
  book?: BookTemplate;
  characters?: CharacterTemplate[];
  plot?: PlotTemplate;
}
