// @vitest-environment jsdom
// Sprint 19, Agent 2 (UI-Labels): Sichtbare UI-Texte enthalten keine
// Tastenkürzel-Notation (Ctrl+/Alt+/Shift+) mehr — stattdessen stehen
// ausgeschriebene deutsche Aktionsnamen in den Buttons und Hinweisen.
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => []) as never,
  listChapters: vi.fn(() => []) as never,
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
import { EmptyEditor } from "@/components/Empty/EmptyEditor";

const SRC = (rel: string) =>
  readFileSync(join(__dirname, "..", "..", rel), "utf-8");

describe("UI-Labels ohne Tastenkürzel-Notation", () => {
  it("Sidebar: kein Modus-Button zeigt sichtbar Ctrl+/Alt+/Shift+ an", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Modi" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b.textContent ?? "").not.toMatch(/Ctrl\+|Alt\+|Shift\+/);
    }
    // Keine kbd-Kürzel-Chips mehr im Modus-Umschalter.
    expect(nav.querySelector("kbd")).toBeNull();
  });

  it("Sidebar: jeder Modus-Button zeigt seinen deutschen Namen als sichtbaren Text", () => {
    render(<Sidebar />);
    for (const name of ["Editor", "Prompts", "Projektwissen", "Figuren", "Fragmente"]) {
      const btn = screen.getByTitle(name);
      // Der Name steht im sichtbaren Button-Text, nicht nur im title-Tooltip.
      expect(within(btn).getByText(name)).toBeInTheDocument();
    }
  });

  it("Editor: keine title-Tooltips mit Kürzel-Notation (Ctrl+/Shift+)", () => {
    const src = SRC("components/Editor/Editor.tsx");
    const titles = [...src.matchAll(/title="([^"]*)"/g)].map((m) => m[1]);
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) {
      expect(t).not.toMatch(/Ctrl\+|Shift\+|Alt\+|Strg\+/);
    }
    // Die ausgeschriebenen Aktionen bleiben erhalten.
    expect(src).toContain('title="Rückgängig"');
    expect(src).toContain('title="Wiederholen"');
  });

  it("EmptyEditor: Hinweis ist ein ausgeschriebener Satz mit „Strg+S speichert“", () => {
    render(<EmptyEditor hasProjects onShowSetup={() => {}} />);
    expect(screen.getByText(/Strg\+S speichert von Hand/)).toBeInTheDocument();
    expect(screen.getByText(/Fokusmodus/)).toBeInTheDocument();
    const hint = document.querySelector(".empty-hint, [class*='hint']")?.textContent ?? document.body.textContent ?? "";
    expect(hint).not.toMatch(/Ctrl\+/);
  });

  it("Sidebar-Quelle: kein shortcut-Feld und kein data-shortcut mehr", () => {
    const src = SRC("components/Sidebar/Sidebar.tsx");
    expect(src).not.toMatch(/shortcut:/);
    expect(src).not.toMatch(/data-shortcut/);
    expect(src).not.toMatch(/Ctrl\+1|Alt\+2/);
  });
});
