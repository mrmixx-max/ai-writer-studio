// Plot-Vorlagen: strukturelle Gerüste als Projekt-Notizen.
//
// Plot-Vorlagen erzeugen eine strukturierte Notiz (Tag "struktur"),
// damit Projektwissen, Konsistenzprüfung und KI-Kontext die Struktur
// sehen — ohne in Kapitel einzugreifen.

import type { PlotTemplate } from "./types";

export const plotTemplates: PlotTemplate[] = [
  {
    id: "plot-heldenreise",
    name: "Heldenreise",
    description:
      "Campbells Monomyth in 12 Stationen. Für Abenteuer- und " +
      "Wandlungsgeschichten mit klarer Verwandlung der Hauptfigur.",
    beats: [
      { title: "1. Gewohnte Welt", description: "Alltag und die unsichtbare Lücke darin." },
      { title: "2. Ruf des Abenteuers", description: "Ein Ereignis fordert heraus." },
      { title: "3. Verweigerung", description: "Zögern, Angst, abgewürgter Aufbruch." },
      { title: "4. Begegnung mit dem Mentor", description: "Werkzeug, Wissen oder Mut wird gereicht." },
      { title: "5. Überschreiten der Schwelle", description: "Eintritt in die besondere Welt." },
      { title: "6. Prüfungen, Verbündete, Feinde", description: "Regeln der neuen Welt kennenlernen." },
      { title: "7. Annäherung an die tiefste Höhle", description: "Vorbereitung auf die Zentralprüfung." },
      { title: "8. Prüfung", description: "Todesnähe, Scheitern, Überleben im Neuen." },
      { title: "9. Belohnung", description: "Schwert oder Erkenntnis wird gewonnen." },
      { title: "10. Rückweg", description: "Verfolgte Heimkehr; der Einsatz wandert mit." },
      { title: "11. Auferstehung", description: "Letzte Prüfung; die Wandlung wird vollständig." },
      { title: "12. Rückkehr mit dem Elixier", description: "Die gewonnene Erkenntnis verändert die gewohnte Welt." },
    ],
  },
  {
    id: "plot-drei-akt",
    name: "Drei-Akt-Struktur",
    description:
      "Klassische dramaturgische Gliederung mit Wendepunkten bei " +
      "25 % und 50 % sowie Klimax im dritten Akt.",
    beats: [
      { title: "Akt 1 — Exposition", description: "Held, Welt, Auslöser; Wendepunkt 1 bei ca. 25 %." },
      { title: "Akt 2 — Konfrontation (1. Hälfte)", description: "Steigende Einsätze, Mittelpunkt-Wende bei ca. 50 %." },
      { title: "Akt 2 — Konfrontation (2. Hälfte)", description: "Eskalation bis zum Tiefpunkt bei ca. 75 %." },
      { title: "Akt 3 — Auflösung", description: "Klimax, Fallhöhe abarbeiten, neuer Zustand." },
    ],
  },
  {
    id: "plot-in-media-res",
    name: "In Media Res",
    description:
      "Beginn mitten im Geschehen: Die Krise steht vorne, das " +
      "Wie-und-Warum folgt über Rückblenden und Enthüllung.",
    beats: [
      { title: "Kalter Einstieg", description: "Mitten in der Krise — keine Einführung, nur Handlung." },
      { title: "Stille vor dem Sturm", description: "Kurz zurück; wie es so weit kam, in Umrissen." },
      { title: "Erste Enthüllung", description: "Eine Rückblende erklärt eine Motivation, nicht alle." },
      { title: "Eskalation", description: "Die Gegenwartshandlung spitzt sich weiter zu." },
      { title: "Zweite Enthüllung", description: "Das Bild vom Anfang bricht: eine Annahme war falsch." },
      { title: "Zusammenführung", description: "Vergangenheit und Gegenwart treffen aufeinander." },
      { title: "Klimax", description: "Die Szene, mit der alles begann, wird zu Ende erzählt." },
      { title: "Nachhall", description: "Kurzer Ausklang; was geblieben ist." },
    ],
  },
];

export function getPlotTemplate(id: string): PlotTemplate | undefined {
  return plotTemplates.find((t) => t.id === id);
}
