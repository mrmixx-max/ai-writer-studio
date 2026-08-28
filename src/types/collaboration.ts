// Collaboration-Typen: Kommentare, Track Changes, Vorschläge, Versionsvergleich.

export type CommentStatus = "open" | "resolved";
export type SuggestionStatus = "pending" | "accepted" | "rejected";
export type SuggestionKind = "insert" | "replace" | "delete";

export interface Comment {
  id: string;
  chapterId: string;
  /** Position im Klartext des Kapitels (Text-Offset). */
  anchorStart: number;
  anchorEnd: number;
  /** Der kommentierte Text-Ausschnitt. */
  anchorText: string;
  author: string;
  body: string;
  status: CommentStatus;
  createdAt: number;
  resolvedAt: number | null;
}

export interface TrackChange {
  id: string;
  chapterId: string;
  kind: "insert" | "delete";
  position: number;
  text: string;
  /** Ersetzter Text bei Löschungen (für Rückblick). */
  replacedText: string | null;
  author: string;
  createdAt: number;
}

export interface Suggestion {
  id: string;
  chapterId: string;
  kind: SuggestionKind;
  /** Position im Klartext (Text-Offset). */
  anchorStart: number;
  anchorEnd: number;
  originalText: string;
  proposedText: string;
  author: string;
  note: string;
  status: SuggestionStatus;
  createdAt: number;
  decidedAt: number | null;
}

export interface DiffSegment {
  type: "equal" | "insert" | "delete";
  text: string;
}
