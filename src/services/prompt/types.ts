// Typen für den Prompt-Generator.

export type Genre =
  | "Fantasy"
  | "Science Fiction"
  | "Krimi/Thriller"
  | "Romance"
  | "Horror"
  | "Historisch"
  | "Literary Fiction"
  | "Sachbuch"
  | "Poesie"
  | "Überraschung";

export type PromptType =
  | "Story-Starter"
  | "Szenen-Idee"
  | "Charakter-Konzept"
  | "Konflikt/Plot-Premisse"
  | "Was-wäre-wenn"
  | "Schreibübung"
  | "Tagebuch-/Reflexionsprompt"
  | "Dialog-Starter";

export type Tone = "düster" | "humorvoll" | "romantisch" | "spannend" | "melancholisch" | "neutral";

export type TargetLength = "Kurzgeschichte" | "Kapitel" | "Roman-Idee" | "10-Minuten-Freewriting";

/** Vom Modell geliefertes Prompt-Objekt (Generator-Ausgabe). */
export interface GeneratedPrompt {
  text: string;
  genre: string;
  type: string;
  hook: string;
}

/** Filter für einen Generierungs-Durchlauf. */
export interface PromptFilters {
  genres: Genre[];
  promptType: PromptType;
  tone: Tone;
  targetLength: TargetLength;
  count: number; // 1–10
}

/** Gespeicherter Prompt (DB-Row). */
export interface StoredPrompt {
  id: string;
  text: string;
  genre: string | null;
  prompt_type: string | null;
  tone: string | null;
  target_length: string | null;
  is_favorite: boolean;
  created_at: number;
  provider: string | null;
  model: string | null;
  project_id: string | null;
}
