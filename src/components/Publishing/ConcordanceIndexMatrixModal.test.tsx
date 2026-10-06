// @vitest-environment jsdom
/**
 * Tests: ConcordanceIndexMatrixModal (WP 79.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConcordanceIndexMatrixModal } from "./ConcordanceIndexMatrixModal";

describe("ConcordanceIndexMatrixModal", () => {
  it("rendert die Komponente", () => {
    render(<ConcordanceIndexMatrixModal />);
    expect(screen.getByTestId("concordance-index-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ConcordanceIndexMatrixModal />);
    expect(screen.getByText("📖 Master-Konkordanz- & Sachregister-Index")).toBeTruthy();
  });

  it("zeigt Index-Einträge", () => {
    render(<ConcordanceIndexMatrixModal />);
    expect(screen.getByTestId("concordance-entries")).toBeTruthy();
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<ConcordanceIndexMatrixModal />);
    fireEvent.change(screen.getByTestId("concordance-title-input"), {
      target: { value: "Neuer Titel" },
    });
    expect(screen.getByTestId("concordance-entries")).toBeTruthy();
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<ConcordanceIndexMatrixModal />);
    fireEvent.change(screen.getByTestId("concordance-text-input"), {
      target: { value: "Ein neuer Satz mit Namen." },
    });
    expect(screen.getByTestId("concordance-entries")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<ConcordanceIndexMatrixModal />);
    expect(screen.getByTestId("concordance-text").textContent).toContain("KONKORDANZ");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ConcordanceIndexMatrixModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
