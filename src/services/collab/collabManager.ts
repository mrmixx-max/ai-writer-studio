// CollabManager: Kommentare + Review-Requests (Sprint 20, Agent 3).
//
// In-Memory-Store (Single-User-Desktop-App, keine neuen Dependencies):
// Kommentare und Review-Requests leben pro Projekt in Modul-Maps.
// Reine Async-API (Promise), damit spaetere Persistenz (DB) die
// Signaturen nicht aendert.

/** Einzelner Kommentar zu einem Projekt, optional mit Textselektion. */
export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
  resolved: boolean;
  selection?: { start: number; end: number };
}

/** Review-Anfrage zu einem Projekt mit Status und Kommentarverlauf. */
export interface ReviewRequest {
  id: string;
  projectId: string;
  author: string;
  status: "open" | "approved" | "rejected";
  comments: Comment[];
  createdAt: number;
}

/** Selektion im Editor (Zeichen-Offsets). */
export interface TextSelection {
  start: number;
  end: number;
}

const commentsByProject = new Map<string, Comment[]>();
const reviews = new Map<string, ReviewRequest>();
const commentIndex = new Map<string, { projectId: string; comment: Comment }>();

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** Aktueller Autor — Default "Ich", via Umgebungsvariable ueberschreibbar. */
export function currentAuthor(): string {
  const fromEnv =
    typeof process !== "undefined" &&
    typeof process.env?.COLLAB_AUTHOR === "string"
      ? process.env.COLLAB_AUTHOR.trim()
      : "";
  return fromEnv || "Ich";
}

/**
 * Fuegt einem Projekt einen Kommentar hinzu.
 * @throws wenn projectId leer ist oder der Text nur Whitespace enthaelt.
 */
export async function addComment(
  projectId: string,
  text: string,
  selection?: TextSelection,
): Promise<Comment> {
  if (!projectId || !projectId.trim()) {
    throw new Error("addComment: projectId darf nicht leer sein.");
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("addComment: Kommentartext darf nicht leer sein.");
  }
  if (selection !== undefined) {
    if (
      !Number.isInteger(selection.start) ||
      !Number.isInteger(selection.end) ||
      selection.start < 0 ||
      selection.end < selection.start
    ) {
      throw new Error(
        "addComment: selection braucht start >= 0 und end >= start (Integer).",
      );
    }
  }
  const comment: Comment = {
    id: nextId("c"),
    author: currentAuthor(),
    text: trimmed,
    timestamp: Date.now(),
    resolved: false,
    ...(selection !== undefined
      ? { selection: { start: selection.start, end: selection.end } }
      : {}),
  };
  const list = commentsByProject.get(projectId) ?? [];
  list.push(comment);
  commentsByProject.set(projectId, list);
  commentIndex.set(comment.id, { projectId, comment });
  return { ...comment };
}

/** Markiert einen Kommentar als erledigt. @throws bei unbekannter ID. */
export async function resolveComment(commentId: string): Promise<void> {
  const entry = commentIndex.get(commentId);
  if (!entry) {
    throw new Error(`resolveComment: unbekannte Kommentar-ID "${commentId}".`);
  }
  entry.comment.resolved = true;
}

/** Liefert alle Kommentare eines Projekts (Kopie, Einfuegereihenfolge). */
export async function getComments(projectId: string): Promise<Comment[]> {
  const list = commentsByProject.get(projectId) ?? [];
  return list.map((c) => ({ ...c }));
}

/**
 * Erstellt eine Review-Anfrage fuer ein Projekt (Status "open").
 * @throws wenn projectId leer ist.
 */
export async function createReviewRequest(
  projectId: string,
): Promise<ReviewRequest> {
  if (!projectId || !projectId.trim()) {
    throw new Error("createReviewRequest: projectId darf nicht leer sein.");
  }
  const review: ReviewRequest = {
    id: nextId("r"),
    projectId,
    author: currentAuthor(),
    status: "open",
    comments: await getComments(projectId),
    createdAt: Date.now(),
  };
  reviews.set(review.id, review);
  return { ...review, comments: [...review.comments] };
}

/** Holt eine Review-Anfrage per ID (Kopie) — undefined bei unbekannter ID. */
export async function getReview(
  reviewId: string,
): Promise<ReviewRequest | undefined> {
  const review = reviews.get(reviewId);
  if (!review) return undefined;
  return { ...review, comments: [...review.comments] };
}

/** Genehmigt eine Review-Anfrage. @throws bei unbekannter ID. */
export async function approveReview(reviewId: string): Promise<void> {
  const review = reviews.get(reviewId);
  if (!review) {
    throw new Error(`approveReview: unbekannte Review-ID "${reviewId}".`);
  }
  review.status = "approved";
}

/** Lehnt eine Review-Anfrage ab. @throws bei unbekannter ID. */
export async function rejectReview(reviewId: string): Promise<void> {
  const review = reviews.get(reviewId);
  if (!review) {
    throw new Error(`rejectReview: unbekannte Review-ID "${reviewId}".`);
  }
  review.status = "rejected";
}

/** Test-Helfer: setzt den kompletten In-Memory-Store zurueck. */
export function __resetCollabStore(): void {
  commentsByProject.clear();
  reviews.clear();
  commentIndex.clear();
  idCounter = 0;
}
