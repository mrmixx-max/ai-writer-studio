// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CognitiveReaderTwinModal } from "./CognitiveReaderTwinModal";

describe("CognitiveReaderTwinModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CognitiveReaderTwinModal />);
    expect(screen.getByTestId("cognitive-reader-twin-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CognitiveReaderTwinModal />);
    expect(screen.getByText(/Kognitiver Reader-Twin & Blick-Simulator/)).toBeInTheDocument();
  });

  it("listet alle vier Reader-Twin-Archetypen", () => {
    render(<CognitiveReaderTwinModal />);
    expect(screen.getAllByText(/Der Skimmer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Der Kontemplator/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Der Dopamin-Sucher/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Der Plot-Hacker/).length).toBeGreaterThan(0);
  });

  it("zeigt Lese-Erfahrung je Archetyp", () => {
    render(<CognitiveReaderTwinModal />);
    expect(screen.getByText(/LESE-ERFAHRUNG JE ARCHETYP/)).toBeInTheDocument();
    expect(screen.getAllByText(/Verweildauer/).length).toBeGreaterThan(0);
  });

  it("zeigt die Sakkaden- und Regressions-Heatmap", () => {
    render(<CognitiveReaderTwinModal />);
    expect(screen.getByText(/SAKKADEN- & REGRESSIONS-HEATMAP/)).toBeInTheDocument();
  });

  it("zeigt die Gesamt-Retention", () => {
    render(<CognitiveReaderTwinModal />);
    expect(screen.getByText(/Gesamt-Retention/)).toBeInTheDocument();
  });

  it("zeigt den schwächsten Archetyp", () => {
    render(<CognitiveReaderTwinModal />);
    expect(screen.getByText(/SCHWÄCHSTER ARCHETYP/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<CognitiveReaderTwinModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
