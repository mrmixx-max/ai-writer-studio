// @vitest-environment jsdom
// Component-Tests für ExportBar.tsx: Menü öffnen, Format/Scope-Wahl,
// Export-Flow (Projekt/Kapitel/Inhalt) und Preflight-Gate mit Bestätigung.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/export", () => ({
  exportProject: vi.fn(async () => undefined),
  exportContent: vi.fn(async () => undefined),
}));

vi.mock("@/services/preflight/runner", () => ({
  runExportPreflight: vi.fn(async () => ({
    findings: [{ id: "f1", severity: "blocker", title: "Leeres Kapitel", detail: "" }],
  })),
}));

vi.mock("@/services/preflight/filter", () => ({
  exportGate: vi.fn(() => ({
    needsConfirm: true,
    blockers: [{ id: "f1", severity: "blocker", title: "Leeres Kapitel" }],
    warnings: [],
    infos: [],
  })),
}));

import { ExportBar } from "./ExportBar";
import { exportProject, exportContent } from "@/services/export";
import { runExportPreflight } from "@/services/preflight/runner";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Export/ }));
}

describe("ExportBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({
      activeProjectId: "p1",
      activeChapterId: null,
      projects: [{ id: "p1", name: "Mein Roman", createdAt: 0, updatedAt: 0 }],
      chapters: [],
    });
    useEditorStore.setState({ content: "{}" });
  });

  it("Menü ist initial geschlossen und öffnet per Klick", async () => {
    const user = userEvent.setup();
    render(<ExportBar />);
    expect(screen.queryByText("Format")).not.toBeInTheDocument();
    await openMenu(user);
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByText("Bereich")).toBeInTheDocument();
  });

  it("Exportiert als Markdown ohne Preflight (direkter Export)", async () => {
    const user = userEvent.setup();
    render(<ExportBar />);
    await openMenu(user);
    await user.selectOptions(screen.getByDisplayValue("DOCX"), "md");
    await user.click(screen.getByRole("button", { name: "Exportieren" }));
    expect(exportProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", name: "Mein Roman" }),
      "md",
    );
    expect(runExportPreflight).not.toHaveBeenCalled();
    // Menü schließt nach Export
    expect(screen.queryByText("Bereich")).not.toBeInTheDocument();
  });

  it("Exportiert das aktuelle Kapitel, wenn Bereich = Kapitel", async () => {
    useProjectStore.setState({ activeChapterId: "c1" });
    const user = userEvent.setup();
    render(<ExportBar />);
    await openMenu(user);
    await user.selectOptions(screen.getByDisplayValue("DOCX"), "txt");
    await user.selectOptions(screen.getByDisplayValue("Ganzes Projekt"), "chapter");
    await user.click(screen.getByRole("button", { name: "Exportieren" }));
    expect(exportProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      "txt",
      "c1",
    );
  });

  it("Ohne aktives Projekt wird der Editor-Inhalt exportiert", async () => {
    useProjectStore.setState({ activeProjectId: null, projects: [] });
    const user = userEvent.setup();
    render(<ExportBar />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Exportieren" }));
    expect(exportContent).toHaveBeenCalledWith("{}", "Dokument", "docx");
    expect(exportProject).not.toHaveBeenCalled();
  });

  it("DOCX-Export zeigt Preflight-Befunde und verlangt Bestätigung", async () => {
    const user = userEvent.setup();
    render(<ExportBar />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Exportieren" }));
    expect(await screen.findByText(/Achtung/)).toBeInTheDocument();
    expect(screen.getByText(/1 Befund\/Bunde anzeigen/)).toBeInTheDocument();
    // Während des Preflight-Gates ist noch nichts exportiert
    expect(exportProject).not.toHaveBeenCalled();
    // Bestätigung startet den Export
    await user.click(screen.getByRole("button", { name: "Trotzdem exportieren" }));
    expect(exportProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      "docx",
    );
  });

  it("Preflight mit unkritischen Befunden zeigt 'Exportbereit'", async () => {
    const { exportGate } = await import("@/services/preflight/filter");
    const { runExportPreflight: run } = await import("@/services/preflight/runner");
    vi.mocked(run).mockResolvedValueOnce({
      findings: [{ id: "i1", severity: "info", title: "Hinweis: langer Satz" }],
    } as never);
    vi.mocked(exportGate).mockReturnValueOnce({
      needsConfirm: false,
      blockers: [],
      warnings: [],
      infos: [],
    } as never);

    const user = userEvent.setup();
    render(<ExportBar />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Exportieren" }));
    expect(await screen.findByText("Keine kritischen Befunde. Exportbereit.")).toBeInTheDocument();
  });

  it("Zurück-Button verlässt das Preflight-Gate", async () => {
    const { runExportPreflight: run } = await import("@/services/preflight/runner");
    vi.mocked(run).mockResolvedValueOnce({
      findings: [{ id: "f1", severity: "blocker", title: "Leeres Kapitel" }],
    } as never);
    const user = userEvent.setup();
    render(<ExportBar />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Exportieren" }));
    await screen.findByText(/Achtung/);
    await user.click(screen.getByRole("button", { name: "Zurück" }));
    expect(screen.getByRole("button", { name: "Exportieren" })).toBeInTheDocument();
  });
});
