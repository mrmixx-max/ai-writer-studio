// Feature: Prompt-Vorlagen — kuratierte, genre-spezifische Prompt-Templates
// für den Prompt-Generator (und die KI-Aktionen). Statisch, offline nutzbar.
import type { Genre, PromptType, Tone, TargetLength } from "@/services/prompt/types";

export interface PromptTemplate {
  id: string;
  name: string;
  genre: Genre;
  promptType: PromptType;
  tone: Tone;
  targetLength: TargetLength;
  /** Start-Idee, die als erster Ergebnis- oder Editor-Text dienen kann */
  seed: string;
  /** Zusätzliche Anweisung, die an die Generierung angehängt wird */
  guidance: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "fantasy-quest",
    name: "Fantasy: Dunkle Quest",
    genre: "Fantasy",
    promptType: "Konflikt/Plot-Premisse",
    tone: "düster",
    targetLength: "Roman-Idee",
    seed: "Ein Land ohne Zauber seit dreißig Jahren – bis ein Magd das erste Flackern in einer Kerze sieht.",
    guidance: "Magie ist rare, teuer und macht abhängig. Keine allmächtigen Helden.",
  },
  {
    id: "fantasy-stadtkneipe",
    name: "Fantasy: Szenen-Idee Stadtkneipe",
    genre: "Fantasy",
    promptType: "Szenen-Idee",
    tone: "humorvoll",
    targetLength: "Kapitel",
    seed: "In der einzigen Kneipe an der Zollbrücke sitzen ein Dieb, ein Paladin und ein Elch.",
    guidance: "Der Humor entsteht aus den Figuren, nicht aus Gags.",
  },
  {
    id: "sf-erstenkontakt",
    name: "Sci-Fi: Erster Kontakt (umgekehrt)",
    genre: "Science Fiction",
    promptType: "Story-Starter",
    tone: "spannend",
    targetLength: "Kurzgeschichte",
    seed: "Die Außerirdischen melden sich – und verlangen die Herausgabe einer Erfindung, die noch nicht existiert.",
    guidance: "Hard-SF-Nähe: die technologische Implikation konsequent zu Ende denken.",
  },
  {
    id: "sf-station",
    name: "Sci-Fi: Isolation auf der Station",
    genre: "Science Fiction",
    promptType: "Charakter-Konzept",
    tone: "melancholisch",
    targetLength: "Kurzgeschichte",
    seed: "Die letzte Technikerin einer automatisierten Mondbasis repariert jeden Tag ein Gerät, das niemand mehr braucht.",
    guidance: "Perspektive der inneren Einsamkeit; Technik nur als Kulisse.",
  },
  {
    id: "krimi-hinweis",
    name: "Krimi: Falscher Hinweis",
    genre: "Krimi/Thriller",
    promptType: "Szenen-Idee",
    tone: "spannend",
    targetLength: "Kapitel",
    seed: "Am Tatort liegt ein Beweisstück, das erst in vier Wochen hergestellt werden konnte.",
    guidance: "Fair play: Der Leser bekommt dieselben Fakten wie die Ermittlerin.",
  },
  {
    id: "krimi-verhoer",
    name: "Krimi: Dialog-Verhör",
    genre: "Krimi/Thriller",
    promptType: "Dialog-Starter",
    tone: "düster",
    targetLength: "10-Minuten-Freewriting",
    seed: "\u201eSie sagten mir, ich dürfe nach dieser Frage gehen.\u201c",
    guidance: "Reines Dialog-Szenario, maximale Subtext-Dichte.",
  },
  {
    id: "romance-wiedersehen",
    name: "Romance: Das Wiedersehen",
    genre: "Romance",
    promptType: "Story-Starter",
    tone: "romantisch",
    targetLength: "Kurzgeschichte",
    seed: "Zwanzig Jahre nach dem Abiball stehen sich zwei Menschen am gleichem Gymnasium-Flur gegenüber – als Eltern.",
    guidance: "Spannung aus gemeinsamer Vorgeschichte, nicht aus Missverständnissen.",
  },
  {
    id: "horror-haus",
    name: "Horror: Das Haus kennt dich",
    genre: "Horror",
    promptType: "Szenen-Idee",
    tone: "düster",
    targetLength: "Kapitel",
    seed: "Das renovierte Haus enthält eine Wand, die beim Anklopfen antwortet.",
    guidance: "Langsame Eskalation, Vertrautheit als Horrorquelle statt Gore.",
  },
  {
    id: "historisch-gericht",
    name: "Historisch: Vor Gericht",
    genre: "Historisch",
    promptType: "Story-Starter",
    tone: "dramatisch" as Tone,
    targetLength: "Roman-Idee",
    seed: "Hamburg 1892: Eine Hebamme wird angeklagt, während die Cholera die Speicherstadt erreicht.",
    guidance: "Historische Details exakt, aber nie museumsartig – sie treiben den Konflikt.",
  },
  {
    id: "literary-gegenwart",
    name: "Literary Fiction: Ein Moment, doppelt",
    genre: "Literary Fiction",
    promptType: "Schreibübung",
    tone: "melancholisch",
    targetLength: "10-Minuten-Freewriting",
    seed: "Beschreibe denselben Abschied zweimal: aus Sicht der Gehenden und der Bleibenden.",
    guidance: "Fokus auf Wahrnehmung, Rhythmus und das Ungesagte.",
  },
  {
    id: "sachbuch-gegenposition",
    name: "Sachbuch: Die Gegenposition",
    genre: "Sachbuch",
    promptType: "Story-Starter",
    tone: "neutral",
    targetLength: "Kapitel",
    seed: "Nimm eine etablierte These deines Fachgebiets und formuliere die stärkste mögliche Gegenposition.",
    guidance: "Sachlich, belegt, ohne Polemik – die Gegenposition muss seriös bleiben.",
  },
  {
    id: "poesie-ort",
    name: "Poesie: Ein Ort, der fehlt",
    genre: "Poesie",
    promptType: "Schreibübung",
    tone: "melancholisch",
    targetLength: "10-Minuten-Freewriting",
    seed: "Schreibe ein Gedicht über einen Ort, den du nie betreten hast, aber kennst.",
    guidance: "Konkrete Bilder statt Abstraktion; freie Form.",
  },
];

/** Template anhand der ID (null wenn unbekannt). */
export function getTemplate(id: string): PromptTemplate | null {
  return PROMPT_TEMPLATES.find((t) => t.id === id) ?? null;
}
