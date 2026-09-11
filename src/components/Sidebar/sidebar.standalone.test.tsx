// @vitest-environment jsdom
// Regressionstest: Standalone-Modi (chat, book-idea, newspaper, plugin-manager)
// muessen OHNE offenes Projekt/Kapitel ihr Panel rendern — nicht den
// Kapitel-Hinweis. Bug: cases standen hinter dem Kapitel-Guard (Sprint 29).
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

const mockStoreState = {
  projects: [],
  activeProjectId: null,
  chapters: [],
  activeChapterId: null,
  activeContent: "",
  refresh: vi.fn(),
  openProject: vi.fn(),
  openChapter: vi.fn(),
  newProject: vi.fn(),
};
vi.mock("@/store/projectStore", () => ({
  useProjectStore: (sel?: (s: unknown) => unknown) =>
    typeof sel === "function" ? sel(mockStoreState) : mockStoreState,
}));

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => []),
  listChapters: vi.fn(() => []),
  createProject: vi.fn(() => ({ id: "p1", name: "P1" })),
}));

describe("Sidebar — standalone modes ohne Kapitel", () => {
  it("chat rendert das Chat-Panel ohne Projekt", async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: /chat/i }));
    await waitFor(() => expect(screen.getByText("💬 CHAT")).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/nachricht eingeben/i)).toBeInTheDocument();
  });

  it("plugin-manager rendert ohne Projekt", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: /plugin/i }));
    expect(screen.queryByText(/kapitel/i)).not.toBeInTheDocument();
  });
});
