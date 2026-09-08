// @vitest-environment jsdom
// Component-Tests für das Sprint-22-ImporterPanel.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/services/project", () => ({
  createProject: vi.fn(async (name: string) => ({ id: "p-new", name, createdAt: 0, updatedAt: 0 })),
  createChapter: vi.fn(async () => ({ id: "c-new" })),
}));

import { ImporterPanel } from "./ImporterPanel";
import { createProject, createChapter } from "@/services/project";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ImporterPanel", () => {
  it("rendert Drag-and-Drop-Zone, Format-Auswahl und Kapitel-Split", () => {
    render(<ImporterPanel />);
    expect(screen.getByTestId("importer-dropzone")).toBeInTheDocument();
    expect(screen.getByTestId("importer-format-select")).toBeInTheDocument();
    expect(screen.getByTestId("importer-split-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("importer-pattern-input")).toBeInTheDocument();
    expect(screen.getByText(/Datei wählen/)).toBeInTheDocument();
  });

  it("importiert eine TXT-Datei und zeigt Vorschau + Erstellen-Button", async () => {
    render(<ImporterPanel />);
    const file = new File(["Kapitel 1\nEs war einmal.\nKapitel 2\nDas Ende."], "roman.txt", {
      type: "text/plain",
    });
    const input = screen.getByTestId("importer-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByTestId("importer-preview")).toBeInTheDocument());
    expect(screen.getByTestId("importer-preview").textContent).toContain("Es war einmal.");
    expect(screen.getByTestId("importer-create-button")).toBeInTheDocument();
  });

  it("erstellt ein Projekt mit Kapiteln pro Split", async () => {
    const onCreated = vi.fn();
    render(<ImporterPanel onProjectCreated={onCreated} />);
    const file = new File(["Kapitel 1\nEins.\nKapitel 2\nZwei."], "roman.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("importer-file-input"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByTestId("importer-create-button")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("importer-create-button"));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith("roman"));
    expect(createChapter).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledWith("p-new");
  });

  it("zeigt einen Fehler bei nicht unterstütztem Format", async () => {
    render(<ImporterPanel />);
    const file = new File(["x"], "bild.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("importer-file-input"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByTestId("importer-error")).toBeInTheDocument());
    expect(screen.getByTestId("importer-error").textContent).toMatch(/nicht unterstützt/i);
  });
});
