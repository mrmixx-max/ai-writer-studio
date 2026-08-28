// Buch-Vorlagen: Genre-Strukturen mit vordefinierten Kapiteln.
//
// Bewusst als Ausgangspunkt, nicht als Korsett: Jedes Kapitel ist eine
// leere Seite mit Titel und Beschreibung, die der Autor frei umformt.

import type { BookTemplate } from "./types";

export const bookTemplates: BookTemplate[] = [
  {
    id: "book-roman",
    name: "Roman",
    genre: "Roman",
    description:
      "Klassische Romanstruktur mit drei Wendepunkten. Geeignet für " +
      "Literatur und Genre-Fiktion gleichermaßen.",
    targetWords: 80000,
    chapters: [
      { title: "1. Gewohnte Welt", description: "Protagonist, Alltag und die unsichtbare Lücke darin etablieren." },
      { title: "2. Auslöser", description: "Ein Ereignis zerstört den Status quo — kein Zurück mehr." },
      { title: "3. Erste Schritte", description: "Erste Versuche, auf den Auslöser zu reagieren; scheitern halb." },
      { title: "4. Wendepunkt", description: "Die Situation spitzt sich zu; der Einsatz wird deutlich." },
      { title: "5. Tiefpunkt", description: "Der größte Rückschlag. Alles scheint verloren." },
      { title: "6. Neuer Plan", description: "Aus dem Tiefpunkt entsteht ein neuer Entschluss." },
      { title: "7. Entscheidung", description: "Die zentrale Konfrontation — Setup und Zahlungen lösen sich." },
      { title: "8. Rückkehr", description: "Die veränderte Welt; was bleibt und was weiterlebt." },
    ],
  },
  {
    id: "book-sachbuch",
    name: "Sachbuch",
    genre: "Sachbuch",
    description:
      "Fachbuch- oder Ratgeberstruktur: Problem, Prinzip, Anwendung. " +
      "Jedes Hauptkapitel folgt demselben Muster.",
    targetWords: 50000,
    chapters: [
      { title: "1. Warum dieses Buch", description: "Leserproblem benennen, Versprechen des Buches klären." },
      { title: "2. Grundlagen", description: "Begriffe und Zusammenhänge einführen, die später gebraucht werden." },
      { title: "3. Prinzip 1: Diagnose", description: "Erstes Kernprinzip mit Fallbeispiel und häufigen Fehlern." },
      { title: "4. Prinzip 2: Methode", description: "Zweites Kernprinzip mit Schritt-für-Schritt-Anleitung." },
      { title: "5. Prinzip 3: Umsetzung", description: "Drittes Kernprinzip; typische Stolpersteine im Alltag." },
      { title: "6. Fallstudien", description: "Zwei bis drei Fälle von Anfang bis Ende durchspielen." },
      { title: "7. Häufige Einwände", description: "Einwände der Leser ernst nehmen und beantworten." },
      { title: "8. Der nächste Schritt", description: "Zusammenfassung als Checkliste; Weg zur Anwendung." },
    ],
  },
  {
    id: "book-drehbuch",
    name: "Drehbuch",
    genre: "Drehbuch",
    description:
      "Drehbuchskizze in Aktform. Die Kapitel entsprechen Behandlungs-" +
      "abschnitten (Treatment), nicht finalen Szenen.",
    targetWords: 25000,
    chapters: [
      { title: "Akt 1: Setup", description: "Held, Welt und Ton in 10–15 Seiten einführen." },
      { title: "Akt 1: Auslöser", description: "Der Inciting Incident gegen Ende des ersten Akts." },
      { title: "Akt 2: Aufstieg", description: "Der Held entscheidet sich; erste Eskalationen." },
      { title: "Akt 2: Mitte", description: "Point of no return — der Einsatz wird existenziell." },
      { title: "Akt 2: Zusammenbruch", description: "Alles scheitert; der Held verliert seine Sicherheit." },
      { title: "Akt 3: Entscheidung", description: "Klimax in einer letzten, unumkehrbaren Konfrontation." },
      { title: "Akt 3: Auflösung", description: "Neuer Zustand; das Thema in einem Bild bündeln." },
    ],
  },
  {
    id: "book-essay",
    name: "Essay",
    genre: "Essay",
    description:
      "Denkender Aufsatz in Abhandlungsform: Frage, Verengung, Wendung, " +
      "Ausklang. Für lange Essays und kurze Sachtexte.",
    targetWords: 12000,
    chapters: [
      { title: "1. Die Frage", description: "Aus einem konkreten Anlass heraus fragen, nicht abstrakt beginnen." },
      { title: "2. Annäherung", description: "Erste Gedanken, widerlegte Selbstverständlichkeiten." },
      { title: "3. Verengung", description: "Der Gedanke verengt sich auf den entscheidenden Punkt." },
      { title: "4. Wendung", description: "Der Umschlag: das Bisherige in neuem Licht." },
      { title: "5. Einwände", description: "Der stärkste Gegenargument — es ernst nehmen." },
      { title: "6. Ausklang", description: "Keine Auflösung, aber eine Haltung. Offen enden." },
    ],
  },
];

export function getBookTemplate(id: string): BookTemplate | undefined {
  return bookTemplates.find((t) => t.id === id);
}
