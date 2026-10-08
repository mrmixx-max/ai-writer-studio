// @vitest-environment jsdom
/** Tests: MultiPageSceneDraftSynthesizerModal (WP 95.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MultiPageSceneDraftSynthesizerModal } from "./MultiPageSceneDraftSynthesizerModal";

describe("MultiPageSceneDraftSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByTestId("multi-page-scene-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByText(/Autonomer Mehrseiten-Szenen/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByDisplayValue("Elias")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1800")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Stichpunkte-Textarea", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByText(/Stichpunkte/)).toBeInTheDocument();
  });

  it("zeigt Konsistenz-Prüfung", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByTestId("summary-konsistenz")).toBeInTheDocument();
  });

  it("zeigt Seitenübersicht", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByTestId("summary-seiten")).toBeInTheDocument();
  });

  it("zeigt Volltext", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByTestId("summary-volltext")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Szenarien", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByTestId("summary-beispiel")).toBeInTheDocument();
  });

  it("erklärt Deep POV", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByTestId("summary-deep-pov")).toBeInTheDocument();
  });

  it("erklärt 1-Klick-Injektion", () => {
    render(<MultiPageSceneDraftSynthesizerModal />);
    expect(screen.getByTestId("summary-injektion")).toBeInTheDocument();
  });
});