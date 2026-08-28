// Vorlagen-Service: Registrierung, Auswahlanwendung, Import/Export.
//
// applyTemplates() ist die einzige Stelle, die Vorlagen in echte
// Projektinhalte übersetzt:
//   - Buch-Vorlage  -> Kapitel (createChapter) mit Beschreibung als Erstinhalt
//   - Figuren       -> Figurenprofile (createCharacter)
//   - Plot          -> strukturierte Projekt-Notiz (createNote, Tag "struktur")
//
// Bewusst nicht transaktional: Jeder Teilschritt, der gelingt, bleibt.
// Der Aufrufer erhält die Fehlermeldung, nicht eine leere Halbierung.

import { createChapter } from "@/services/project";
import { createCharacter, createNote } from "@/services/knowledge/profiles";
import { getBookTemplate } from "./bookTemplates";
import { getCharacterTemplate } from "./characterTemplates";
import { getPlotTemplate } from "./plotTemplates";
import type {
  TemplateSelection,
  TemplateChapter,
} from "./types";

export type {
  BookTemplate,
  CharacterTemplate,
  PlotTemplate,
  TemplateSelection,
  TemplateBundle,
} from "./types";
export {
  bookTemplates,
  getBookTemplate,
} from "./bookTemplates";
export {
  characterTemplates,
  getCharacterTemplate,
} from "./characterTemplates";
export {
  plotTemplates,
  getPlotTemplate,
} from "./plotTemplates";
export {
  buildBundle,
  parseBundle,
  loadBundleFile,
  TEMPLATE_FILE_EXTENSION,
} from "./importExport";

/** Erstinhalt eines Kapitels: Beschreibung als Simple-Text-Hinweis. */
function chapterSeed(ch: TemplateChapter): string {
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text:
              `Zurückgestellter Entwurf — ${ch.description} ` +
              "(Vorlage. Diesen Absatz beim Schreiben ersetzen.)",
          },
        ],
      },
    ],
  });
}

export interface ApplyResult {
  chaptersCreated: number;
  charactersCreated: number;
  plotNoteCreated: boolean;
}

/**
 * Wendet die Auswahl auf ein bestehendes Projekt an.
 *
 * Buch-Kapitel werden an bestehende Kapitel angehängt, nicht eingefügt.
 * Gibt zurück, was tatsächlich angelegt wurde — nicht, was hätte
 * angelegt werden sollen.
 */
export async function applyTemplates(
  projectId: string,
  selection: TemplateSelection,
): Promise<ApplyResult> {
  const result: ApplyResult = {
    chaptersCreated: 0,
    charactersCreated: 0,
    plotNoteCreated: false,
  };

  const book = selection.book ? getBookTemplate(selection.book) : undefined;
  if (book) {
    for (const ch of book.chapters) {
      await createChapter(projectId, ch.title, chapterSeed(ch));
      result.chaptersCreated += 1;
    }
  }

  const plots = selection.plot ? getPlotTemplate(selection.plot) : undefined;
  for (const charId of selection.characters ?? []) {
    const t = getCharacterTemplate(charId);
    if (!t) continue;
    await createCharacter(projectId, t.name, { ...t.fields });
    result.charactersCreated += 1;
  }

  if (plots) {
    const body = plots.beats
      .map((b) => `${b.title}: ${b.description}`)
      .join("\n");
    await createNote(
      projectId,
      `Struktur: ${plots.name}`,
      `${plots.description}\n\n${body}`,
      "struktur,plot",
    );
    result.plotNoteCreated = true;
  }

  return result;
}

// Hinweis: importBundle existiert nicht — parseBundle (oben re-exportiert)
// ist der Einstieg für imports.
