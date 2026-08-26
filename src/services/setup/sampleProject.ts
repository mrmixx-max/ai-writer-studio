// Beispielprojekt für den Erststart-Assistenten.
//
// Zweck: Der Nutzer soll nach dem Assistenten nicht vor einer leeren App
// stehen, sondern etwas Echtes zum Anfassen haben — mit Kapiteln, Figuren-
// profilen und Notizen, damit Projektwissen und Konsistenzprüfung sofort
// Material haben.

import { createProject, createChapter } from "@/services/project";
import { createCharacter, createNote } from "@/services/knowledge/profiles";

/** Baut ein TipTap-Dokument aus Überschrift und Absätzen. */
function doc(heading: string, paragraphs: string[]): string {
  const content: unknown[] = [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: heading }],
    },
  ];
  for (const p of paragraphs) {
    content.push({ type: "paragraph", content: [{ type: "text", text: p }] });
  }
  return JSON.stringify({ type: "doc", content });
}

/**
 * Legt das Beispielprojekt an und gibt dessen Id zurück.
 *
 * Nicht idempotent: mehrfaches Aufrufen erzeugt mehrere Projekte.
 * Der Assistent ruft es genau einmal auf.
 */
export async function createSampleProject(): Promise<string> {
  const project = await createProject("Beispiel: Der Novemberbrief");

  await createChapter(
    project.id,
    "1. Der Fund",
    doc("Der Fund", [
      "Der Brief lag zwischen den Seiten eines Buches, das seit vierzig Jahren " +
        "niemand aufgeschlagen hatte. Marta hielt ihn gegen das Fenster. Das " +
        "Papier war dünn geworden, fast durchscheinend.",
      "Sie las die erste Zeile und setzte sich hin.",
      "Draußen begann es zu regnen. Sie merkte es nicht.",
    ]),
  );

  await createChapter(
    project.id,
    "2. Was darin stand",
    doc("Was darin stand", [
      "Der Brief war an eine Adresse gerichtet, die es nicht mehr gab. Die " +
        "Straße hatte man umbenannt, das Haus abgerissen. Nur der Name des " +
        "Empfängers stimmte noch: ihr eigener.",
      "Geschrieben hatte ihn ihre Großmutter. Im November 1961, drei Wochen " +
        "vor Martas Geburt.",
    ]),
  );

  await createChapter(
    project.id,
    "3. Die Suche",
    doc("Die Suche", [
      "Im Archiv gab es Öffnungszeiten, Formulare und einen Mann namens " +
        "Kessler, der jede Frage mit einer Gegenfrage beantwortete.",
      "Marta blieb, bis er aufgab.",
    ]),
  );

  // Figurenprofile — Referenzdaten für die Konsistenzprüfung.
  await createCharacter(project.id, "Marta Reineke", {
    aliases: "Marta",
    age: "48",
    occupation: "Restauratorin",
    appearance: "Kurze graue Haare, Lesebrille an einer Kette",
    traits: "Geduldig, hartnäckig, misstrauisch gegenüber Behörden",
    relationships: "Enkelin von Hedwig Reineke, der Verfasserin des Briefs",
    notes:
      "Erzählt wird konsequent aus ihrer Perspektive, dritte Person, " +
      "Vergangenheit. Abweichungen meldet der Perspektivprüfer.",
  });

  await createCharacter(project.id, "Kessler", {
    aliases: "Herr Kessler, der Archivar",
    age: "60",
    occupation: "Archivar",
    appearance: "Hemd mit aufgerollten Ärmeln, immer eine Tasse in Reichweite",
    traits: "Wortkarg, gründlich, insgeheim hilfsbereit",
    relationships: "Beruflicher Kontakt zu Marta",
    notes: "Sein Vorname wird bewusst nie genannt.",
  });

  await createNote(
    project.id,
    "Zeitlinie",
    "November 1961: Hedwig schreibt den Brief.\n" +
      "Dezember 1961: Marta wird geboren.\n" +
      "Gegenwart (2026): Marta findet den Brief.\n\n" +
      "Wichtig: Zwischen Brief und Fund liegen 65 Jahre. Alle Altersangaben " +
      "müssen dazu passen — der Zeitlinienprüfer meldet Widersprüche.",
    "struktur,zeitlinie",
  );

  await createNote(
    project.id,
    "Ton und Stil",
    "Kurze Sätze. Konkrete Gegenstände statt Gefühlsbeschreibungen. Keine " +
      "Adjektivketten. Dialoge tragen die Handlung, nicht die Erklärung.\n\n" +
      "Diese Notiz ist Teil des Projektwissens: Frage die KI danach, wenn du " +
      "wissen willst, welchen Ton das Projekt verlangt.",
    "stil",
  );

  return project.id;
}
