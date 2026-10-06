// @vitest-environment jsdom
/**
 * Tests: TransmediaWorldBibleModal (WP 74.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransmediaWorldBibleModal } from "./TransmediaWorldBibleModal";

describe("TransmediaWorldBibleModal", () => {
  it("rendert die Komponente", () => {
    render(<TransmediaWorldBibleModal />);
    expect(screen.getByTestId("transmedia-world-bible-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<TransmediaWorldBibleModal />);
    expect(screen.getByText("🌍 Transmediale Franchise-Bibel & Kanon-Wiki")).toBeTruthy();
  });

  it("zeigt Kanon-Tier-Tabs", () => {
    render(<TransmediaWorldBibleModal />);
    expect(screen.getByTestId("bible-tier-core")).toBeTruthy();
    expect(screen.getByTestId("bible-tier-prequel")).toBeTruthy();
    expect(screen.getByTestId("bible-tier-legend")).toBeTruthy();
  });

  it("zeigt Kanon-Einträge", () => {
    render(<TransmediaWorldBibleModal />);
    expect(screen.getByTestId("bible-entries")).toBeTruthy();
  });

  it("zeigt Kosmologie", () => {
    render(<TransmediaWorldBibleModal />);
    expect(screen.getByTestId("bible-cosmology")).toBeTruthy();
  });

  it("zeigt Kollisionen", () => {
    render(<TransmediaWorldBibleModal />);
    expect(screen.getByTestId("bible-collisions")).toBeTruthy();
  });

  it("wechselt zu Prequel-Kanon", () => {
    render(<TransmediaWorldBibleModal />);
    fireEvent.click(screen.getByTestId("bible-tier-prequel"));
    expect(screen.getByTestId("bible-entries").textContent).toContain("Prequel");
  });

  it("wechselt zu Legenden", () => {
    render(<TransmediaWorldBibleModal />);
    fireEvent.click(screen.getByTestId("bible-tier-legend"));
    expect(screen.getByTestId("bible-entries").textContent).toContain("Legenden");
  });

  it("reagiert auf Suche", () => {
    render(<TransmediaWorldBibleModal />);
    fireEvent.change(screen.getByTestId("bible-search-input"), {
      target: { value: "Schöpfung" },
    });
    expect(screen.getByTestId("bible-entries")).toBeTruthy();
  });

  it("zeigt Markdown-Export", () => {
    render(<TransmediaWorldBibleModal />);
    expect(screen.getByTestId("bible-markdown").textContent).toContain("#");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<TransmediaWorldBibleModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
