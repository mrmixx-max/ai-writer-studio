// @vitest-environment jsdom
/**
 * Tests: OpticalMarginAlignmentModal (WP 83.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpticalMarginAlignmentModal } from "./OpticalMarginAlignmentModal";

describe("OpticalMarginAlignmentModal", () => {
  it("rendert die Komponente", () => {
    render(<OpticalMarginAlignmentModal />);
    expect(screen.getByTestId("optical-margin-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<OpticalMarginAlignmentModal />);
    expect(screen.getByText("📐 Optischer Randausgleich (Hängende Interpunktion)")).toBeTruthy();
  });

  it("zeigt Ausgleiche", () => {
    render(<OpticalMarginAlignmentModal />);
    expect(screen.getByTestId("margin-alignments")).toBeTruthy();
  });

  it("zeigt CSS", () => {
    render(<OpticalMarginAlignmentModal />);
    expect(screen.getByTestId("margin-css")).toBeTruthy();
  });

  it("wechselt Glyphe", () => {
    render(<OpticalMarginAlignmentModal />);
    fireEvent.click(screen.getByTestId("margin-glyph-period"));
    expect(screen.getByTestId("margin-svg")).toBeTruthy();
  });

  it("wechselt zu Anführungszeichen", () => {
    render(<OpticalMarginAlignmentModal />);
    fireEvent.click(screen.getByTestId("margin-glyph-quote"));
    expect(screen.getByTestId("margin-svg")).toBeTruthy();
  });

  it("shows Text-Ausgabe", () => {
    render(<OpticalMarginAlignmentModal />);
    expect(screen.getByTestId("margin-text").textContent).toContain("OPTISCHER RANDAUSGLEICH");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<OpticalMarginAlignmentModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
