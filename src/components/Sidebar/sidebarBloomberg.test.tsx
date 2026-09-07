// @vitest-environment jsdom
// Bloomberg-Terminal-Thema (Sprint 18, Agent 2): aktives Item (Amber),
// kollabierbare Modi-Sektion, Projekt-Baum-Collapse, Shortcut-Chips,
// Monospace/Dichte-Vars im CSS.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const C1 = { id: "c1", title: "Kapitel 1", content: "{}", projectId: "p1", orderIndex: 0, createdAt: 0, updatedAt: 0, status: "planned" as const, targetWordCount: 2000, minimumWordCount: 1600, maximumWordCount: 2400, currentWordCount: 0 };

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => [
    { id: "p1", name: "Mein Roman", createdAt: 0, updatedAt: 0 },
    { id: "p2", name: "Zweites Projekt", createdAt: 0, updatedAt: 0 },
  ] as never),
  // Nur p1 hat Kapitel — so lässt sich der Projekt-Collapse deterministisch prüfen.
  listChapters: vi.fn((pid: string) => (pid === "p1" ? [{ ...C1 }] : []) as never),
  createProject: vi.fn(async (name: string) => ({ id: "p-new", name, createdAt: 0, updatedAt: 0 })),
  createChapter: vi.fn(async (_pid: string, title: string) => ({ id: "c-new", title, content: "{}", projectId: _pid, orderIndex: 0, createdAt: 0, updatedAt: 0 })),
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

import { Sidebar } from "./Sidebar";
import { useProjectStore } from "@/store/projectStore";

const CSS = readFileSync(
  join(process.cwd(), "src/components/Sidebar/sidebar.css"),
  "utf-8",
);

describe("Sidebar Bloomberg-Thema", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      activeProjectId: "p1",
      chapters: [{ ...C1 }],
      activeChapterId: "c1",
    });
  });

  it("aktiver Modus-Button trägt .active (Amber-Highlight-Hook)", () => {
    render(<Sidebar />);
    expect(screen.getByTitle("Editor")).toHaveClass("active");
  });

  it("Amber-Styling für aktive Items ist im CSS verankert", () => {
    expect(CSS).toContain("--sb-amber");
    expect(CSS).toMatch(/\.mode-switcher button\.active[^}]*var\(--sb-amber\)/);
    expect(CSS).toMatch(/\.project-tree > li\.active > \.node/);
    expect(CSS).toMatch(/\.chapter-tree > li\.active > \.node/);
  });

  it("aktive Projektzeile trägt .active", async () => {
    const { container } = render(<Sidebar />);
    expect(await screen.findByText(/Mein Roman/)).toBeInTheDocument();
    const active = container.querySelector(".project-tree > li.active");
    expect(active).not.toBeNull();
    expect(within(active as HTMLElement).getByText(/Mein Roman/)).toBeInTheDocument();
  });

  it("Modi-Sektion kollabiert und expandiert per Toggle; Moduswechsel danach weiter möglich", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const toggle = screen.getByRole("button", { name: /MODES/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTitle("Editor")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByTitle("Prompts"));
    expect(screen.getByTitle("Prompts")).toHaveClass("active");
    expect(await screen.findByTestId("prompt-generator")).toBeInTheDocument();
  });

  it("Projekt-Collapse funktioniert: Kapitel nur unter aktivem Projekt", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sidebar />);
    expect(await screen.findByText(/Kapitel 1/)).toBeInTheDocument();

    await user.click(screen.getByText(/Zweites Projekt/));
    await vi.waitFor(() => {
      expect(screen.queryByText(/Kapitel 1/)).not.toBeInTheDocument();
    });
    // Genau ein Projekt ist aktiv — das alte ist kollabiert.
    expect(container.querySelectorAll(".project-tree > li.active").length).toBe(1);
  });

  it("Tastaturkürzel werden als kbd-Chips mit data-shortcut angezeigt", () => {
    render(<Sidebar />);
    const editor = screen.getByTitle("Editor");
    expect(editor).toHaveAttribute("data-shortcut", "Ctrl+1");
    const kbd = within(editor).getByText("Ctrl+1");
    expect(kbd.tagName.toLowerCase()).toBe("kbd");
    expect(kbd).toHaveClass("sb-kbd");
  });

  it("Monospace + dichtes Layout sind als CSS-Vars verankert", () => {
    expect(CSS).toContain("--sb-mono");
    expect(CSS).toMatch(/font-family:\s*var\(--sb-mono\)/);
    expect(CSS).toContain(".sb-kbd");
    expect(CSS).toContain(".sb-section-toggle");
  });
});
