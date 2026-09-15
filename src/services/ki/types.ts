// KI-Panel: Aktionen auf markierten Text / Dokumentkontext.
export type KIAction =
  | "weiterschreiben"
  | "umschreiben"
  | "zusammenfassen"
  | "korrektur"
  | "brainstorming"
  | "chat"
  | "rede";

export type RewriteStyle = "formell" | "locker" | "dramatisch" | "sachlich";
export type RewriteLength = "kürzer" | "gleich" | "länger";
export type RewriteTarget = "de" | "en";

export interface RewriteOptions {
  style: RewriteStyle;
  length: RewriteLength;
  target: RewriteTarget;
}

export interface KIRequest {
  action: KIAction;
  selection: string; // markierter Text (oder leer)
  context: string; // letzte ~2000 Zeichen des Dokuments
  style?: RewriteStyle; // nur bei umschreiben
  rewriteOpts?: RewriteOptions; // erweiterte Umschreib-Optionen
  chatMessage?: string; // nur bei chat
  redeOpts?: RedeOptions; // nur bei rede
  /** Projekt für Dokumenten-RAG (Wissensindex). null = kein RAG. */
  projectId?: string | null;
  /** RAG-Feinschliff: default aktiviert (limit 6, maxChars 4000). */
  rag?: { enabled?: boolean; maxChars?: number; limit?: number };
  slotId?: string; // Multi-Modell: ID des zu nutzenden Modell-Slots
  history?: { role: "system" | "user" | "assistant"; content: string }[]; // Chatverlauf
  memoryContext?: string; // Langzeit-Gedächtnis: relevante Erinnerungen + Projektwissen als Block
}

/** Ton einer KI-generierten Rede (Schwerpunkt: politische Rhetorik). */
export type RedeTon =
  | "feierlich"
  | "sachlich"
  | "motivierend"
  | "humorvoll"
  | "nachdenklich"
  | "kämpferisch"
  | "staatstragend";

/** Eingaben für die Rede-Generierung (Redenschreiber → KI). */
export interface RedeOptions {
  anlass: string; // z. B. "Wahlkampfauftakt in Musterstadt"
  publikum: string; // z. B. "Bürgerinnen und Bürger"
  ton: RedeTon;
  minuten: number; // Ziel-Redezeit in Minuten
  kernpunkte: string; // ein Kernpunkt pro Zeile
  funktion?: string; // z. B. "Bürgermeisterin", "Abgeordneter" (optional)
  gegenposition?: string; // ein Gegenargument pro Zeile (optional, wird entkräftet)
}

export interface KIResult {
  text: string;
  offline: boolean;
  /** Verwendete RAG-Quellen (Kurznamen) — leer ohne Treffer/Projekt. */
  ragSources?: string[];
}
