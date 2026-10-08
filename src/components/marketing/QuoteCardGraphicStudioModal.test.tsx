// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuoteCardGraphicStudioModal } from "./QuoteCardGraphicStudioModal";

describe("QuoteCardGraphicStudioModal", () => {
  it("rendert ohne Fehler", () => {
    render(<QuoteCardGraphicStudioModal />);
    expect(screen.getByTestId("quote-card-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<QuoteCardGraphicStudioModal />);
    expect(screen.getByText(/Zitat-Karten- & Karussell-Grafik-Studio/)).toBeInTheDocument();
  });

  it("listet alle drei Seitenverhältnisse", () => {
    render(<QuoteCardGraphicStudioModal />);
    expect(screen.getAllByText(/1:1 \/ 1080×1080 px/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4:5 \/ 1080×1350 px/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/9:16 \/ 1080×1920 px/).length).toBeGreaterThan(0);
  });

  it("listet alle vier Stil-Themes", () => {
    render(<QuoteCardGraphicStudioModal />);
    expect(screen.getAllByText(/Dark Academia/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gothic Romance/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cozy Fantasy/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Minimal Modern/).length).toBeGreaterThan(0);
  });

  it("zeigt die Zitat-Karte als SVG", () => {
    render(<QuoteCardGraphicStudioModal />);
    expect(screen.getByText(/ZITAT-KARTE \(SVG\)/)).toBeInTheDocument();
  });

  it("zeigt das Karussell", () => {
    render(<QuoteCardGraphicStudioModal />);
    expect(screen.getByText(/KARUSSELL/)).toBeInTheDocument();
  });

  it("zeigt den Export", () => {
    render(<QuoteCardGraphicStudioModal />);
    expect(screen.getByText(/EXPORT/)).toBeInTheDocument();
    expect(screen.getByText(/Format:/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<QuoteCardGraphicStudioModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
