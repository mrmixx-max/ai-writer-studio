// @vitest-environment jsdom
// Component-Tests für das AdvancedExportPanel (Sprint 23, Agent 6).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedExportPanel } from "./AdvancedExportPanel";

describe("AdvancedExportPanel", () => {
  it("rendert Sektionen-Liste mit Vorschau", () => {
    render(<AdvancedExportPanel />);
    expect(screen.getByTestId("advanced-export-panel")).toBeTruthy();
    expect(screen.getByLabelText("Sektionen-Liste")).toBeTruthy();
    expect(screen.getByTestId("advanced-export-preview")).toBeTruthy();
    // Standard-Sektionen vorhanden
    expect(screen.getAllByText(/Inhaltsverzeichnis/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Widmung/).length).toBeGreaterThanOrEqual(1);
  });

  it("stellt Sektionen um (nach unten)", async () => {
    const user = userEvent.setup();
    render(<AdvancedExportPanel />);
    const preview = screen.getByTestId("advanced-export-preview");
    const before = preview.textContent ?? "";
    await user.click(screen.getByLabelText("Sektion 1 nach unten"));
    const after = preview.textContent ?? "";
    expect(after).not.toBe(before);
  });

  it("generiert Buch und bietet Download an", async () => {
    const user = userEvent.setup();
    render(<AdvancedExportPanel />);
    await user.click(screen.getByRole("button", { name: /generieren/i }));
    const dl = await screen.findByText(/download/i, undefined, { timeout: 5000 });
    expect(dl).toBeTruthy();
  });
});
