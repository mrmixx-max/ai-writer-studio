// @vitest-environment jsdom
/**
 * Tests: AudiobookProductionSheetModal (WP 73.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AudiobookProductionSheetModal } from "./AudiobookProductionSheetModal";

describe("AudiobookProductionSheetModal", () => {
  it("rendert die Komponente", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("audiobook-production-sheet-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByText("🎧 Master-Hörbuch-Studio-Regiebogen")).toBeTruthy();
  });

  it("shows den Header", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("sheet-header")).toBeTruthy();
  });

  it("shows Kapitel-Auswahl", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("chapter-select")).toBeTruthy();
  });

  it("shows Kapitel-Details", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("chapter-details")).toBeTruthy();
  });

  it("shows QC-Checkliste", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("qc-checklist")).toBeTruthy();
  });

  it("shows alle 8 QC-Checks", () => {
    render(<AudiobookProductionSheetModal />);
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByTestId(`qc-check-qc-${i}`)).toBeTruthy();
    }
  });

  it("shows QC-Score", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("qc-score").textContent).toContain("QC-Score");
  });

  it("shows kritische Checks als bestanden", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("qc-critical").textContent).toContain("Alle kritischen");
  });

  it("shows ACX-Metadaten", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("acx-metadata")).toBeTruthy();
  });

  it("wechselt Kapitel", () => {
    render(<AudiobookProductionSheetModal />);
    fireEvent.change(screen.getByTestId("chapter-select"), { target: { value: "3" } });
    expect(screen.getByTestId("chapter-details").textContent).toContain("§3");
  });

  it("shows vollständigen Bericht", () => {
    render(<AudiobookProductionSheetModal />);
    expect(screen.getByTestId("sheet-report-text").textContent).toContain("HOERBUCH-REGIEBOGEN");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<AudiobookProductionSheetModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
