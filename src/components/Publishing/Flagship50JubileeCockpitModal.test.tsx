// @vitest-environment jsdom
/**
 * Tests: Flagship50JubileeCockpitModal (WP 81.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Flagship50JubileeCockpitModal } from "./Flagship50JubileeCockpitModal";

describe("Flagship50JubileeCockpitModal", () => {
  it("rendert die Komponente", () => {
    render(<Flagship50JubileeCockpitModal />);
    expect(screen.getByTestId("flagship50-cockpit-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<Flagship50JubileeCockpitModal />);
    expect(screen.getByText("🏆 Flaggschiff 5.0 Master-Cockpit & Platin-Siegel")).toBeTruthy();
  });

  it("zeigt Audit", () => {
    render(<Flagship50JubileeCockpitModal />);
    expect(screen.getByTestId("cockpit-audit")).toBeTruthy();
  });

  it("zeigt Archiv", () => {
    render(<Flagship50JubileeCockpitModal />);
    expect(screen.getByTestId("cockpit-archive")).toBeTruthy();
  });

  it("zeigt Siegel", () => {
    render(<Flagship50JubileeCockpitModal />);
    expect(screen.getByTestId("cockpit-seal")).toBeTruthy();
  });

  it("reagiert auf Services-Eingabe", () => {
    render(<Flagship50JubileeCockpitModal />);
    fireEvent.change(screen.getByTestId("cockpit-service-input"), { target: { value: "100" } });
    expect(screen.getByTestId("cockpit-audit")).toBeTruthy();
  });

  it("reagiert auf Chunks-Eingabe", () => {
    render(<Flagship50JubileeCockpitModal />);
    fireEvent.change(screen.getByTestId("cockpit-chunk-input"), { target: { value: "80" } });
    expect(screen.getByTestId("cockpit-audit")).toBeTruthy();
  });

  it("reagiert auf i18n-Eingabe", () => {
    render(<Flagship50JubileeCockpitModal />);
    fireEvent.change(screen.getByTestId("cockpit-i18n-input"), { target: { value: "2000" } });
    expect(screen.getByTestId("cockpit-audit")).toBeTruthy();
  });

  it("zeigt SVG im Siegel", () => {
    render(<Flagship50JubileeCockpitModal />);
    expect(screen.getByTestId("cockpit-seal-svg").innerHTML).toContain("<svg");
  });

  it("zeigt Text-Ausgabe", () => {
    render(<Flagship50JubileeCockpitModal />);
    expect(screen.getByTestId("cockpit-text").textContent).toContain("PLATIN-GESAMT-AUDIT");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<Flagship50JubileeCockpitModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
