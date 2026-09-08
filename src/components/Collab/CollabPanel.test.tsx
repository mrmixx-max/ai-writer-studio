// @vitest-environment jsdom
// Component-Tests: CollabPanel (Sprint 20, Agent 3) — Kommentar-Liste,
// Eingabe (gemockte API), Resolve-Button, Review-Flow.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollabPanel, type CollabApi } from "./CollabPanel";
import type { Comment, ReviewRequest } from "@/services/collab/collabManager";

let comments: Comment[];
let review: ReviewRequest | null;

function makeApi(): CollabApi & {
  calls: { resolved: string[]; created: number; approved: string[] };
} {
  const calls = { resolved: [] as string[], created: 0, approved: [] as string[] };
  return {
    calls,
    getComments: vi.fn(async () => [...comments]),
    addComment: vi.fn(async (_p: string, text: string) => {
      const c: Comment = {
        id: `c-${comments.length + 1}`,
        author: "Ich",
        text,
        timestamp: Date.now(),
        resolved: false,
      };
      comments.push(c);
      return { ...c };
    }),
    resolveComment: vi.fn(async (id: string) => {
      calls.resolved.push(id);
      comments = comments.map((c) =>
        c.id === id ? { ...c, resolved: true } : c,
      );
    }),
    createReviewRequest: vi.fn(async (projectId: string) => {
      calls.created += 1;
      review = {
        id: "r-1",
        projectId,
        author: "Ich",
        status: "open",
        comments: [...comments],
        createdAt: Date.now(),
      };
      return { ...review };
    }),
    approveReview: vi.fn(async (id: string) => {
      calls.approved.push(id);
      if (review) review = { ...review, status: "approved" };
    }),
    rejectReview: vi.fn(async () => {
      if (review) review = { ...review, status: "rejected" };
    }),
  };
}

beforeEach(() => {
  comments = [
    {
      id: "c-1",
      author: "Anna",
      text: "Einleitung kuerzen",
      timestamp: 1700000000000,
      resolved: false,
    },
  ];
  review = null;
});

describe("CollabPanel", () => {
  it("rendert die Kommentar-Liste mit allen Kommentaren", async () => {
    render(<CollabPanel projectId="p1" api={makeApi()} />);
    await waitFor(() =>
      expect(screen.getByTestId("collab-comment-list")).toBeTruthy(),
    );
    const items = screen.getAllByTestId("collab-comment");
    expect(items).toHaveLength(1);
    expect(screen.getByText("Einleitung kuerzen")).toBeTruthy();
  });

  it("zeigt Eingabe, Hinzufügen-Button und Review-Button", () => {
    render(<CollabPanel projectId="p1" api={makeApi()} />);
    expect(screen.getByTestId("collab-comment-input")).toBeTruthy();
    expect(screen.getByTestId("collab-add-btn")).toBeTruthy();
    expect(screen.getByTestId("collab-review-btn")).toBeTruthy();
    expect(
      screen.getByTestId("collab-take-selection"),
    ).toBeTruthy();
  });

  it("Hinzufügen-Button fügt einen Kommentar hinzu und leert die Eingabe", async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<CollabPanel projectId="p1" api={api} />);
    await waitFor(() =>
      expect(screen.getAllByTestId("collab-comment")).toHaveLength(1),
    );
    await user.type(
      screen.getByTestId("collab-comment-input"),
      "Neuer Hinweis",
    );
    await user.click(screen.getByTestId("collab-add-btn"));
    await waitFor(() =>
      expect(screen.getAllByTestId("collab-comment")).toHaveLength(2),
    );
    expect(screen.getByText("Neuer Hinweis")).toBeTruthy();
    expect(
      (screen.getByTestId("collab-comment-input") as HTMLTextAreaElement)
        .value,
    ).toBe("");
  });

  it("Resolve-Button markiert den Kommentar als erledigt", async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<CollabPanel projectId="p1" api={api} />);
    await waitFor(() =>
      expect(screen.getByTestId("collab-resolve-c-1")).toBeTruthy(),
    );
    await user.click(screen.getByTestId("collab-resolve-c-1"));
    await waitFor(() => expect(api.calls.resolved).toEqual(["c-1"]));
    await waitFor(() =>
      expect(screen.queryByTestId("collab-resolve-c-1")).toBeNull(),
    );
  });

  it("Review-Button erstellt einen Request und zeigt den Status", async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<CollabPanel projectId="p1" api={api} />);
    await user.click(screen.getByTestId("collab-review-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("collab-review-status")).toBeTruthy(),
    );
    expect(screen.getByTestId("collab-review-state").textContent).toBe(
      "open",
    );
    expect(api.calls.created).toBe(1);
  });

  it("Genehmigen-Button setzt den Review-Status auf approved", async () => {
    const user = userEvent.setup();
    render(<CollabPanel projectId="p1" api={makeApi()} />);
    await user.click(screen.getByTestId("collab-review-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("collab-approve-btn")).toBeTruthy(),
    );
    await user.click(screen.getByTestId("collab-approve-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("collab-review-state").textContent).toBe(
        "approved",
      ),
    );
  });
});
