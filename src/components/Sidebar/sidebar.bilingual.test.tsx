// @vitest-environment jsdom
// Testet, dass der bilingual-Mode im Sidebar-Modus-Switcher gelistet ist.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

// Mock the project store so Sidebar renders without a DB.
vi.mock("@/store/projectStore", () => ({
  useProjectStore: () => ({
    projects: [],
    activeProjectId: null,
    chapters: [],
    activeChapterId: null,
    activeContent: "",
    refresh: vi.fn(),
    openProject: vi.fn(),
    openChapter: vi.fn(),
  }),
}));

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => []),
  listChapters: vi.fn(() => []),
  createProject: vi.fn(() => ({ id: "p1", name: "P1" })),
}));

describe("Sidebar — bilingual mode", () => {
  it("bilingual mode is listed in the mode switcher", () => {
    render(<Sidebar />);
    const bilingualButton = screen.getByRole("button", { name: /bilingual/i });
    expect(bilingualButton).toBeInTheDocument();
  });

  it("bilingual button has correct description", () => {
    render(<Sidebar />);
    const bilingualButton = screen.getByRole("button", { name: /bilingual/i });
    expect(bilingualButton).toHaveAttribute("title", expect.stringContaining("Übersetzung"));
  });
});
