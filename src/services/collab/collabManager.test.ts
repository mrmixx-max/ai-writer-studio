// Service-Tests: CollabManager (Sprint 20, Agent 3).
import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetCollabStore,
  addComment,
  approveReview,
  createReviewRequest,
  getComments,
  getReview,
  rejectReview,
  resolveComment,
} from "./collabManager";

beforeEach(() => {
  __resetCollabStore();
});

describe("collabManager", () => {
  it("addComment() erzeugt einen Kommentar mit ID, Autor und Timestamp", async () => {
    const comment = await addComment("p1", "Bitte Einleitung kuerzen");
    expect(comment.id).toMatch(/^c-/);
    expect(comment.text).toBe("Bitte Einleitung kuerzen");
    expect(comment.author).toBeTruthy();
    expect(comment.timestamp).toBeGreaterThan(0);
    expect(comment.resolved).toBe(false);
  });

  it("addComment() uebernimmt optionale Textselektion", async () => {
    const comment = await addComment("p1", "Hier hakt es", {
      start: 10,
      end: 42,
    });
    expect(comment.selection).toEqual({ start: 10, end: 42 });
  });

  it("addComment() wirft bei leerem Text und ungueltiger Selektion", async () => {
    await expect(addComment("p1", "   ")).rejects.toThrow();
    await expect(addComment("", "Text")).rejects.toThrow();
    await expect(
      addComment("p1", "Text", { start: 5, end: 2 }),
    ).rejects.toThrow();
  });

  it("getComments() liefert alle Kommentare eines Projekts (projektgetrennt)", async () => {
    await addComment("p1", "Erster");
    await addComment("p1", "Zweiter");
    await addComment("p2", "Anderes Projekt");
    const comments = await getComments("p1");
    expect(comments).toHaveLength(2);
    expect(comments.map((c) => c.text)).toEqual(["Erster", "Zweiter"]);
  });

  it("resolveComment() markiert den Kommentar als erledigt", async () => {
    const comment = await addComment("p1", "Noch offen");
    expect(comment.resolved).toBe(false);
    await resolveComment(comment.id);
    const [updated] = await getComments("p1");
    expect(updated.resolved).toBe(true);
  });

  it("resolveComment() wirft bei unbekannter ID", async () => {
    await expect(resolveComment("c-unbekannt")).rejects.toThrow();
  });

  it("createReviewRequest() erzeugt einen offenen Request mit Kommentarverlauf", async () => {
    await addComment("p1", "Sieht gut aus");
    const review = await createReviewRequest("p1");
    expect(review.id).toMatch(/^r-/);
    expect(review.projectId).toBe("p1");
    expect(review.status).toBe("open");
    expect(review.createdAt).toBeGreaterThan(0);
    expect(review.comments).toHaveLength(1);
  });

  it("approveReview() / rejectReview() wechseln den Status", async () => {
    const r1 = await createReviewRequest("p1");
    await approveReview(r1.id);
    expect((await getReview(r1.id))?.status).toBe("approved");

    const r2 = await createReviewRequest("p1");
    await rejectReview(r2.id);
    expect((await getReview(r2.id))?.status).toBe("rejected");
  });

  it("approveReview() wirft bei unbekannter ID", async () => {
    await expect(approveReview("r-unbekannt")).rejects.toThrow();
  });
});
