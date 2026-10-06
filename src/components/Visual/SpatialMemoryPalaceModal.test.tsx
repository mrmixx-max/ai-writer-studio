// @vitest-environment jsdom
/**
 * Tests: SpatialMemoryPalaceModal (WP 82.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpatialMemoryPalaceModal } from "./SpatialMemoryPalaceModal";

describe("SpatialMemoryPalaceModal", () => {
  it("rendert die Komponente", () => {
    render(<SpatialMemoryPalaceModal />);
    expect(screen.getByTestId("spatial-memory-palace-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<SpatialMemoryPalaceModal />);
    expect(screen.getByText("🏛️ 3D-Spatial-Mind-Palace & Gedächtnispalast")).toBeTruthy();
  });

  it("zeigt aktiven Raum", () => {
    render(<SpatialMemoryPalaceModal />);
    expect(screen.getByTestId("palace-active-room")).toBeTruthy();
  });

  it("zeigt Widersprüche", () => {
    render(<SpatialMemoryPalaceModal />);
    expect(screen.getByTestId("palace-contradictions")).toBeTruthy();
  });

  it("wechselt Raum", () => {
    render(<SpatialMemoryPalaceModal />);
    fireEvent.click(screen.getByTestId("palace-room-room-2"));
    expect(screen.getByTestId("palace-active-room")).toBeTruthy();
  });

  it("zeigt Hinweise", () => {
    render(<SpatialMemoryPalaceModal />);
    expect(screen.getByTestId("palace-clues")).toBeTruthy();
  });

  it("shows Text-Ausgabe", () => {
    render(<SpatialMemoryPalaceModal />);
    expect(screen.getByTestId("palace-text").textContent).toContain("GEDÄCHTNISPALAST");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<SpatialMemoryPalaceModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
