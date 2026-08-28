// Figuren-Vorlagen: Archetypen als Ausgangspunkt für Figurenprofile.
//
// Jede Vorlage liefert die Felder, die createCharacter() kennt. Der
// Autor überschreibt alles — die Vorlage ist Gesprächsangebot, nicht
// Vorgabe.

import type { CharacterTemplate } from "./types";

export const characterTemplates: CharacterTemplate[] = [
  {
    id: "char-held",
    name: "Held",
    archetype: "Held",
    description:
      "Die Hauptfigur, die durch die Geschichte wächst. Beginnt mit " +
      "einer sichtbaren Stärke und einem verborgenen Mangel.",
    fields: {
      aliases: "",
      age: "30",
      occupation: "",
      appearance: "",
      traits:
        "Entschlossen, mutig, aber stur. Verborgener Mangel: hält " +
        "Festgefahrenes für Sicherheit.",
      relationships: "",
      notes:
        "Entwicklungsbogen: Die Stärke, die ihn anfangs trägt, wird " +
        "im zweiten Akt zum Problem; erst der Verzicht auf sie " +
        "löst den Konflikt.",
    },
  },
  {
    id: "char-mentor",
    name: "Mentor",
    archetype: "Mentor",
    description:
      "Erfahrene Figur, die dem Helden Werkzeug oder Wissen gibt — " +
      "aber nicht die Antwort.",
    fields: {
      aliases: "",
      age: "60",
      occupation: "",
      appearance: "",
      traits:
        "Ruhig, präzise, gelegentlich rätselhaft. Trägt eigene, " +
        "unaufgelöste Schuld.",
      relationships: "Lehrt oder begleitet den Helden; eigene Vergangenheit mit dem Antagonisten.",
      notes:
        "Grenze der Rolle: Der Mentor gibt das Werkzeug, nie die " +
        "Entscheidung. Spätestens im dritten Akt fehlt er — der " +
        "Held muss allein stehen.",
    },
  },
  {
    id: "char-antagonist",
    name: "Antagonist",
    archetype: "Antagonist",
    description:
      "Gegenkraft mit nachvollziehbarer Motivation. Aus ihrer Sicht " +
      "handelt sie richtig.",
    fields: {
      aliases: "",
      age: "45",
      occupation: "",
      appearance: "",
      traits:
        "Intelligent, geduldig, konsequent. Keine reine Bosheit — " +
        "ein Ziel, das mit dem des Helden unvereinbar ist.",
      relationships: "Spiegelt oder ergänzt den Helden; geteilte Geschichte möglich.",
      notes:
        "Regel für Szenen: Der Antagonist tut, was aus seiner " +
        "Sicht vernünftig ist. Wenn eine Szene sie dumm macht, " +
        "stimmt die Szene nicht.",
    },
  },
  {
    id: "char-liebe",
    name: "Liebe",
    archetype: "Liebe",
    description:
      "Liebes- oder Vertrauensfigur, die dem Helden die eigene " +
      "Verwundbarkeit vorhält.",
    fields: {
      aliases: "",
      age: "30",
      occupation: "",
      appearance: "",
      traits:
        "Aufmerksam, direkt, wehrhaft. Hat eigene Bedürfnisse, die " +
        "nicht im Dienst der Heldenfigur stehen.",
      relationships: "Nähe zum Helden mit eigener Grenze: Sie akzeptiert keine Notlösung.",
      notes:
        "Warnung vor der Nebenrolle: Wenn die Figur nur Zuhörer " +
        "oder Belohnung ist, fehlt ihr eigener Konflikt. Eine " +
        "eigene Szene pro Akt einplanen, die ohne den Helden " +
        "funktioniert.",
    },
  },
];

export function getCharacterTemplate(id: string): CharacterTemplate | undefined {
  return characterTemplates.find((t) => t.id === id);
}
