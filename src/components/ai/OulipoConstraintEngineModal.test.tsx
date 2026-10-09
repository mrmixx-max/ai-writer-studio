// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OulipoConstraintEngineModal } from "./OulipoConstraintEngineModal";

describe("OulipoConstraintEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<OulipoConstraintEngineModal />);
    expect(screen.getByTestId("oulipo-constraint-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<OulipoConstraintEngineModal />);
    expect(
      screen.getByText(/Oulipo-Zwangs- & Regeldichtungs-Engine/),
    ).toBeInTheDocument();
  });

  it("zeigt Regel-Prüfer", () => {
    render(<OulipoConstraintEngineModal />);
    expect(screen.getByText(/REGEL-PRÜFER/)).toBeInTheDocument();
  });

  it("zeigt Synthesizer", () => {
    render(<OulipoConstraintEngineModal />);
    expect(screen.getByText(/SYNTHESIZER/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<OulipoConstraintEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
