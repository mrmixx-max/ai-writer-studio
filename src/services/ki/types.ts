// KI-Panel: Aktionen auf markierten Text / Dokumentkontext.
export type KIAction =
  | "weiterschreiben"
  | "umschreiben"
  | "zusammenfassen"
  | "korrektur"
  | "brainstorming"
  | "chat";

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
  slotId?: string; // Multi-Modell: ID des zu nutzenden Modell-Slots
  history?: { role: "system" | "user" | "assistant"; content: string }[]; // Chatverlauf
  memoryContext?: string; // Langzeit-Gedächtnis: relevante Erinnerungen + Projektwissen als Block
}

export interface KIResult {
  text: string;
  offline: boolean;
}
