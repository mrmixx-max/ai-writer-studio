// @vitest-environment jsdom
/**
 * Tests: NemesisDarkMirrorAnalyzerModal (Meilenstein 63.0 / v7.5.0)
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NemesisDarkMirrorAnalyzerModal } from "./NemesisDarkMirrorAnalyzerModal";

describe("NemesisDarkMirrorAnalyzerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<NemesisDarkMirrorAnalyzerModal />);
    expect(screen.getByTestId("nemesis-dark-mirror-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<NemesisDarkMirrorAnalyzerModal />);
    expect(screen.getByText("🪞 Nemesis-Dunkelspiegel-Resonanz-Analysator")).toBeTruthy();
  });

  it("zeigt TRAUMA-GEGENÜBERSTELLUNG", () => {
    render(<NemesisDarkMirrorAnalyzerModal />);
    expect(screen.getByText("TRAUMA-GEGENÜBERSTELLUNG")).toBeTruthy();
  });

  it("zeigt RESONANZ-SCORE", () => {
    render(<NemesisDarkMirrorAnalyzerModal />);
    expect(screen.getByText("RESONANZ-SCORE")).toBeTruthy();
  });

  it("zeigt IDEOLOGISCHER SHOWDOWN", () => {
    render(<NemesisDarkMirrorAnalyzerModal />);
    expect(screen.getByText("IDEOLOGISCHER SHOWDOWN")).toBeTruthy();
  });

  it("zeigt einen Score-Wert", () => {
    render(<NemesisDarkMirrorAnalyzerModal />);
    expect(screen.getByText(/Score:/).textContent).toMatch(/\d+/);
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<NemesisDarkMirrorAnalyzerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
