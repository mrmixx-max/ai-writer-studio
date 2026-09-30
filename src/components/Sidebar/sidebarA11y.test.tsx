// @vitest-environment jsdom
// A11y-Tests (Sprint 9, Agent 5): icon-only Buttons und Bedienelemente in den
// i18n-angefassten Komponenten (Sidebar, BookWriterPanel, Settings-Sprachwahl)
// tragen verlässliche aria-Attribute.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => [
    { id: "p1", name: "Mein Roman", createdAt: 0, updatedAt: 0 },
  ] as never),
  listChapters: vi.fn(() => [] as never),
  createProject: vi.fn(async (name: string) => ({ id: "p-new", name, createdAt: 0, updatedAt: 0 })),
  createChapter: vi.fn(async () => ({ id: "c-new", title: "K", content: "{}", projectId: "p1", orderIndex: 0, createdAt: 0, updatedAt: 0 })),
  renameProject: vi.fn(async () => undefined),
  renameChapter: vi.fn(async () => undefined),
  deleteProject: vi.fn(async () => undefined),
  deleteChapter: vi.fn(async () => undefined),
  getChapter: vi.fn(() => null),
  getChapterDecrypted: vi.fn(async () => null),
  updateChapter: vi.fn(async () => undefined),
}));
vi.mock("@/components/PromptGenerator/PromptGenerator", () => ({
  PromptGenerator: () => <div data-testid="prompt-generator" />,
}));
vi.mock("@/components/Knowledge/KnowledgePanel", () => ({
  KnowledgePanel: () => <div data-testid="knowledge-panel" />,
}));
vi.mock("@/services/llm/ollama", () => ({
  OllamaProvider: class {
    async *chat() { yield ""; }
  },
}));
vi.mock("@/services/bookwriter/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bookwriter/jobs")>();
  return {
    ...actual,
    getResumableBookJob: vi.fn(() => null),
    createBookJob: vi.fn((...a: unknown[]) => ({ id: "x", ...(a[1] as object) })),
    updateBookJobProgress: vi.fn(async () => undefined),
    setBookJobStatus: vi.fn(async () => undefined),
    setBookJobOutline: vi.fn(async () => undefined),
    completeBookJob: vi.fn(async () => undefined),
    deleteBookJob: vi.fn(async () => undefined),
  };
});

import { Sidebar } from "@/components/Sidebar/Sidebar";
import { BookWriterPanel } from "@/components/Writing/BookWriterPanel";
import { useProjectStore } from "@/store/projectStore";

beforeEach(() => {
  useProjectStore.setState({
    projects: [{ id: "p1", name: "Mein Roman", createdAt: 0, updatedAt: 0 }],
    activeProjectId: "p1",
    chapters: [],
    activeChapterId: null,
  });
});

describe("Sidebar A11y", () => {
  it("icon-only Modus-Buttons haben nicht-leere aria-labels + aria-pressed", () => {
    const { container } = render(<Sidebar />);
    const switcher = container.querySelector(".mode-switcher");
    expect(switcher).not.toBeNull();
    expect(switcher!.getAttribute("aria-label")).toBeTruthy();
    const buttons = within(switcher as HTMLElement).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(10);
    for (const b of buttons) {
      const label = b.getAttribute("aria-label") ?? "";
      expect(label, `Button ${b.getAttribute("title")}`).toBeTruthy();
      // aria-label = "Name – Beschreibung" (ausgeschrieben, Sprint 19); title = Name.
      expect(label.startsWith(b.getAttribute("title") ?? ""), `aria-label "${label}" muss mit title "${b.getAttribute("title")}" beginnen`).toBe(true);
      expect(b.hasAttribute("aria-pressed")).toBe(true);
    }
  });

  it("Sidebar-aside und Tabs sind benannt; Projekt-Icon-Buttons sind benannt", () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector("#app-sidebar");
    expect(aside?.getAttribute("aria-label")).toBeTruthy();
    const activeTab = screen.getByRole("button", { name: "📁 Projekte" });
    expect(activeTab.getAttribute("aria-current")).toBe("page");
    // ✎/🗑-Buttons der Projekt-Row enthalten den Projektnamen im aria-label.
    const renameBtn = screen.getByRole("button", { name: /Mein Roman.*umbenennen/i });
    expect(renameBtn.getAttribute("aria-label")).toContain("Mein Roman");
    const deleteBtn = screen.getByRole("button", { name: /Mein Roman.*löschen/i });
    expect(deleteBtn.getAttribute("aria-label")).toContain("Mein Roman");
  });
});

describe("BookWriterPanel A11y", () => {
  it("View-Tabs, Selects und Fortschritt tragen aria-Attribute", () => {
    render(<BookWriterPanel />);
    const plannerTab = screen.getByRole("button", { name: /Kapitelplaner/ });
    const classicTab = screen.getByRole("button", { name: /Klassisch/ });
    expect(plannerTab.getAttribute("aria-pressed")).toBe("true");
    expect(classicTab.getAttribute("aria-pressed")).toBe("false");
    // Planner-Stil-Select ist über sein Label zugänglich.
    expect(screen.getByLabelText("Stil/Ton:")).toBeInTheDocument();
    // Export-Sektion: Format-Select + Button sind benannt.
    expect(screen.getByLabelText("Exportformat")).toBeInTheDocument();
    expect(screen.getByTestId("bw-export-btn").getAttribute("title")).toBeTruthy();
  });
});
