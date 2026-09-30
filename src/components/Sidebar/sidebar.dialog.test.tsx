// @vitest-environment jsdom
// Regressionstest: Projekt anlegen OHNE window.prompt (Tauri hat keins).
// Der In-App-Dialog (AppDialog) muss erscheinen und newProject aufrufen.
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  newChapter: vi.fn(),
  renameProject: vi.fn(),
  renameChapter: vi.fn(),
  deleteProject: vi.fn(),
  deleteChapter: vi.fn(),
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

describe("Sidebar — In-App-Dialog statt window.prompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Neues-Projekt-Button öffnet Dialog und erstellt Projekt", async () => {
    render(<Sidebar />);
    const btn = screen.getByRole("button", { name: "+ Projekt" });
    fireEvent.click(btn);
    const input = await screen.findByRole("dialog").then((d) =>
      d.querySelector("input") as HTMLInputElement,
    );
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Mein Roman" } });
    const dlg = screen.getByRole("dialog");
    const ok = Array.from(dlg.querySelectorAll("button")).find((b) =>
      /ok|aceptar/i.test(b.textContent ?? ""),
    );
    expect(ok).toBeTruthy();
    fireEvent.click(ok!);
    await waitFor(() => expect(mockStoreState.newProject).toHaveBeenCalledWith("Mein Roman"));
  });

  it("Abbrechen erstellt kein Projekt", async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "+ Projekt" }));
    await screen.findByRole("dialog");
    const dlg = screen.getByRole("dialog");
    const cancel = Array.from(dlg.querySelectorAll("button")).find((b) =>
      /abbrechen|cancel|cancelar|annuler/i.test(b.textContent ?? ""),
    );
    fireEvent.click(cancel!);
    expect(mockStoreState.newProject).not.toHaveBeenCalled();
  });
});
