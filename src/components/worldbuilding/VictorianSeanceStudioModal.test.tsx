// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VictorianSeanceStudioModal } from "./VictorianSeanceStudioModal";

describe("VictorianSeanceStudioModal", () => {
  it("rendert ohne Fehler", () => {
    render(<VictorianSeanceStudioModal />);
    expect(screen.getByTestId("victorian-seance-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<VictorianSeanceStudioModal />);
    expect(screen.getByText(/Viktorianisches Séance- & Spiritismus-Studio/)).toBeInTheDocument();
  });

  it("zeigt Phänomene", () => {
    render(<VictorianSeanceStudioModal />);
    expect(screen.getByText(/PHÄNOMENE/)).toBeInTheDocument();
  });

  it("zeigt Geister-Schreiben", () => {
    render(<VictorianSeanceStudioModal />);
    expect(screen.getByText(/GEISTER-SCHREIBEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<VictorianSeanceStudioModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
