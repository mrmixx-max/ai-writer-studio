// KI-Panel: Aktionen auf markierten Text / Dokumentkontext.
export type KIAction =
  | "weiterschreiben"
  | "umschreiben"
  | "zusammenfassen"
  | "korrektur"
  | "brainstorming"
  | "chat";

export type RewriteStyle = "formell" | "locker" | "dramatisch" | "sachlich";

export interface KIRequest {
  action: KIAction;
  selection: string; // markierter Text (oder leer)
  context: string; // letzte ~2000 Zeichen des Dokuments
  style?: RewriteStyle; // nur bei umschreiben
  chatMessage?: string; // nur bei chat
}

export interface KIResult {
  text: string;
  offline: boolean;
}
