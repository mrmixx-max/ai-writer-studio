// @vitest-environment jsdom
// Component-Tests für Sidebar.tsx: Modus-Wechsel (Editor/Prompts/Avantgarde),
// Tab-Synchronisation, Projekt-Toolbar mit window.prompt.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => [
    { id: "p1", name: "Mein Roman", createdAt: 0, updatedAt: 0 },
    { id: "p2", name: "Zweites Projekt", createdAt: 0, updatedAt: 0 },
  ] as never),
  listChapters: vi.fn(() => [{ id: "c1", title: "Kapitel 1", content: "{}", projectId: "p1", orderIndex: 0, createdAt: 0, updatedAt: 0 }] as never),
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
import { usePromptStore } from "@/store/promptStore";

async function clickMode(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByTitle(label));
}

describe("Sidebar", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      activeProjectId: null,
      chapters: [],
      activeChapterId: null,
    });
  });

  it("rendert Modus-Switcher mit allen Modi", () => {
    render(<Sidebar />);
    expect(screen.getByTitle("Editor")).toBeInTheDocument();
    expect(screen.getByTitle("Prompts")).toBeInTheDocument();
    expect(screen.getByTitle("Projektwissen")).toBeInTheDocument();
    expect(screen.getByTitle("Figuren")).toBeInTheDocument();
  });

  it("Editor-Modus ist initial aktiv", () => {
    render(<Sidebar />);
    expect(screen.getByTitle("Editor")).toHaveClass("active");
  });

  it("Wechsel zu Prompts aktiviert Modus + Tab und zeigt PromptGenerator", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await clickMode(user, "Prompts");
    expect(screen.getByTitle("Prompts")).toHaveClass("active");
    expect(await screen.findByTestId("prompt-generator")).toBeInTheDocument();
  });

  it("Wechsel zu Projektwissen zeigt KnowledgePanel (lazy)", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await clickMode(user, "Projektwissen");
    expect(await screen.findByTestId("knowledge-panel")).toBeInTheDocument();
    expect(screen.getByTitle("Projektwissen")).toHaveClass("active");
  });

  it("Avantgarde-Modus ohne Projekt zeigt Hinweis-Placeholder", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await clickMode(user, "Fragmente");
    expect(
      await screen.findByText(/Wähle links ein Projekt und Kapitel/),
    ).toBeInTheDocument();
  });

  it("Tab-Sync: Klick auf 📁 Projekte zurück in den Editor-Modus", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await clickMode(user, "Prompts");
    await user.click(screen.getByRole("button", { name: /Projekte/ }));
    expect(screen.getByTitle("Editor")).toHaveClass("active");
    expect(screen.getByRole("button", { name: "+ Projekt" })).toBeInTheDocument();
  });

  it("zeigt Projektbaum nach refresh", async () => {
    render(<Sidebar />);
    expect(await screen.findByText(/Mein Roman/)).toBeInTheDocument();
    expect(screen.getByText(/Zweites Projekt/)).toBeInTheDocument();
  });

  it("+ Projekt fragt nach Namen und legt Projekt an", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("  Neues Buch  ");
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "+ Projekt" }));
    await vi.waitFor(() => {
      expect(useProjectStore.getState().activeProjectId).toBe("p-new");
    });
    promptSpy.mockRestore();
  });

  it("+ Projekt ohne Eingabe legt nichts an", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("   ");
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "+ Projekt" }));
    expect(useProjectStore.getState().activeProjectId).toBeNull();
    promptSpy.mockRestore();
  });

  it("promptStore.set aus dem Prompts-Tab schreibt den UI-State", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await clickMode(user, "Prompts");
    await user.click(screen.getByRole("button", { name: /💡 Prompts/ }));
    expect(usePromptStore.getState().tab).toBe("generate");
  });

  describe("Projekt-/Kapitelzeilen-Aktionen", () => {
    beforeEach(() => {
      useProjectStore.setState({
        projects: [{ id: "p1", name: "Mein Roman", createdAt: 0, updatedAt: 0 }],
        activeProjectId: "p1",
        chapters: [{ id: "c1", title: "Kapitel 1", content: "{}", projectId: "p1", orderIndex: 0, createdAt: 0, updatedAt: 0 }],
        activeChapterId: "c1",
      });
    });

    it("Öffnen eines Kapitels lädt dessen Inhalt", async () => {
      const user = userEvent.setup();
      render(<Sidebar />);
      await user.click(screen.getByText(/Kapitel 1/));
      await vi.waitFor(() => {
        expect(useProjectStore.getState().activeChapterId).toBe("c1");
      });
    });

    it("Kapitel umbenennen fragt nach neuem Titel", async () => {
      const { renameChapter } = await import("@/services/project");
      const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Neuer Titel");
      const user = userEvent.setup();
      render(<Sidebar />);
      const row = screen.getByText(/Kapitel 1/).closest(".node")!;
      await user.click(row.querySelector(".node-actions button")!);
      expect(renameChapter).toHaveBeenCalledWith("c1", "Neuer Titel");
      promptSpy.mockRestore();
    });

    it("Kapitel löschen erfordert Bestätigung", async () => {
      const { deleteChapter } = await import("@/services/project");
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const user = userEvent.setup();
      render(<Sidebar />);
      const row = screen.getByText(/Kapitel 1/).closest(".node")!;
      await user.click(row.querySelectorAll(".node-actions button")[1]!);
      expect(confirmSpy).toHaveBeenCalledWith("Kapitel löschen?");
      expect(deleteChapter).toHaveBeenCalledWith("c1");
      confirmSpy.mockRestore();
    });

    it("Kapitel löschen ohne Bestätigung tut nichts", async () => {
      const { deleteChapter } = await import("@/services/project");
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      const user = userEvent.setup();
      render(<Sidebar />);
      const row = screen.getByText(/Kapitel 1/).closest(".node")!;
      await user.click(row.querySelectorAll(".node-actions button")[1]!);
      expect(deleteChapter).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("Projekt umbenennen fragt nach neuem Namen", async () => {
      const { renameProject } = await import("@/services/project");
      const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Besserer Titel");
      const user = userEvent.setup();
      render(<Sidebar />);
      const rows = screen.getAllByText(/Mein Roman/);
      const row = rows[0].closest(".node")!;
      await user.click(row.querySelector(".node-actions button")!);
      expect(renameProject).toHaveBeenCalledWith("p1", "Besserer Titel");
      promptSpy.mockRestore();
    });

    it("Projekt löschen erfordert Bestätigung", async () => {
      const { deleteProject } = await import("@/services/project");
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const user = userEvent.setup();
      render(<Sidebar />);
      const rows = screen.getAllByText(/Mein Roman/);
      const row = rows[0].closest(".node")!;
      await user.click(row.querySelectorAll(".node-actions button")[1]!);
      expect(deleteProject).toHaveBeenCalledWith("p1");
      confirmSpy.mockRestore();
    });

    it("Projekt öffnen setzt aktives Projekt + lädt Kapitel", async () => {
      const user = userEvent.setup();
      useProjectStore.setState({ activeProjectId: "p2", chapters: [] });
      render(<Sidebar />);
      await user.click(screen.getByText(/Mein Roman/));
      await vi.waitFor(() => {
        expect(useProjectStore.getState().activeProjectId).toBe("p1");
      });
    });
  });
});
