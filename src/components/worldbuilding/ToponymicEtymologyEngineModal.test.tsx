// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToponymicEtymologyEngineModal } from "./ToponymicEtymologyEngineModal";

describe("ToponymicEtymologyEngineModal", () => {
  it("rendert ohne Fehler", () => {
    expect(() => render(<ToponymicEtymologyEngineModal />)).not.toThrow();
  });

  it("zeigt den Titel", () => {
    render(<ToponymicEtymologyEngineModal />);
    expect(
      screen.getByText("🗺️ Toponymische Ortsnamen- & Schichten-Engine"),
    ).toBeInTheDocument();
  });

  it("zeigt SPRACHSTÄMME", () => {
    render(<ToponymicEtymologyEngineModal />);
    expect(screen.getByText(/SPRACHSTÄMME/)).toBeInTheDocument();
  });

  it("zeigt LANDSCHAFTS-KOMPOSITA", () => {
    render(<ToponymicEtymologyEngineModal />);
    expect(screen.getByText(/LANDSCHAFTS-KOMPOSITA/)).toBeInTheDocument();
  });

  it("zeigt ORTSNAME", () => {
    render(<ToponymicEtymologyEngineModal />);
    expect(screen.getByText("ORTSNAME")).toBeInTheDocument();
  });

  it("zeigt LAUTVERSCHIEBUNG", () => {
    render(<ToponymicEtymologyEngineModal />);
    expect(screen.getByText("LAUTVERSCHIEBUNG")).toBeInTheDocument();
  });

  it("zeigt einen generierten Ortsnamen (non-empty)", () => {
    render(<ToponymicEtymologyEngineModal />);
    const container = screen.getByTestId("toponymic-etymology-modal");
    expect(container.textContent).toBeTruthy();
    expect(container.textContent!.length).toBeGreaterThan(0);
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<ToponymicEtymologyEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
