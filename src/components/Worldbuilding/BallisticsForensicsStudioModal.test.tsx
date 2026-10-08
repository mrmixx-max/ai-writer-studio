// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BallisticsForensicsStudioModal } from "./BallisticsForensicsStudioModal";

describe("BallisticsForensicsStudioModal", () => {
  it("rendert ohne Fehler", () => {
    render(<BallisticsForensicsStudioModal />);
    expect(screen.getByTestId("ballistics-forensics-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<BallisticsForensicsStudioModal />);
    expect(screen.getByText(/Blutspuren-Geometrie & Ballistik-Studio/)).toBeInTheDocument();
  });

  it("zeigt elliptischer Auftreffwinkel", () => {
    render(<BallisticsForensicsStudioModal />);
    expect(screen.getByText(/ELLIPTISCHER AUFTREFFWINKEL/)).toBeInTheDocument();
  });

  it("zeigt Blutspuren-Muster", () => {
    render(<BallisticsForensicsStudioModal />);
    expect(screen.getByText(/BLUTSPUREN-MUSTER/)).toBeInTheDocument();
  });

  it("zeigt Schussdistanz", () => {
    render(<BallisticsForensicsStudioModal />);
    expect(screen.getByText(/SCHUSSDISTANZ & SCHMAUCH/)).toBeInTheDocument();
  });

  it("zeigt Rekonstruktion", () => {
    render(<BallisticsForensicsStudioModal />);
    expect(screen.getByText(/REKONSTRUKTION & SVG-CANVAS/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<BallisticsForensicsStudioModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
