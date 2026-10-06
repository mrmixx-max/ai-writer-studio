// @vitest-environment jsdom
/**
 * Tests: ComicPanelOrchestratorModal (WP 77.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComicPanelOrchestratorModal } from "./ComicPanelOrchestratorModal";

describe("ComicPanelOrchestratorModal", () => {
  it("rendert die Komponente", () => {
    render(<ComicPanelOrchestratorModal />);
    expect(screen.getByTestId("comic-panel-orchestrator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ComicPanelOrchestratorModal />);
    expect(screen.getByText("🎨 Comic- & Graphic-Novel-Seiten-Orchestrator")).toBeTruthy();
  });

  it("zeigt Seiten-Vorschau", () => {
    render(<ComicPanelOrchestratorModal />);
    expect(screen.getByTestId("comic-pages")).toBeTruthy();
  });

  it("wechselt zu Image-Format", () => {
    render(<ComicPanelOrchestratorModal />);
    fireEvent.click(screen.getByTestId("comic-format-image"));
    expect(screen.getByTestId("comic-pages")).toBeTruthy();
  });

  it("wechselt zu Manga-Format", () => {
    render(<ComicPanelOrchestratorModal />);
    fireEvent.click(screen.getByTestId("comic-format-manga"));
    expect(screen.getByTestId("comic-pages")).toBeTruthy();
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<ComicPanelOrchestratorModal />);
    fireEvent.change(screen.getByTestId("comic-title-input"), {
      target: { value: "Neuer Titel" },
    });
    expect(screen.getByTestId("comic-pages")).toBeTruthy();
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<ComicPanelOrchestratorModal />);
    fireEvent.change(screen.getByTestId("comic-text-input"), {
      target: { value: "Ein neuer Satz. Noch ein Satz." },
    });
    expect(screen.getByTestId("comic-pages")).toBeTruthy();
  });

  it("zeigt Markdown-Export", () => {
    render(<ComicPanelOrchestratorModal />);
    expect(screen.getByTestId("comic-markdown").textContent).toContain("#");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ComicPanelOrchestratorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
