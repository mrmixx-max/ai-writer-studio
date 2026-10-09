// @vitest-environment jsdom
/** Tests: ConcreteCalligramEngineModal (WP 125.1 UI / Meilenstein 60.0 / v7.2.0) */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConcreteCalligramEngineModal } from "./ConcreteCalligramEngineModal";

describe("ConcreteCalligramEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<ConcreteCalligramEngineModal />);
    expect(screen.getByTestId("concrete-calligram-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<ConcreteCalligramEngineModal />);
    expect(screen.getByText(/Konkrete Poesie & Vektor-Kalligramm-Studio/)).toBeInTheDocument();
  });

  it("zeigt Pfad-Text", () => {
    render(<ConcreteCalligramEngineModal />);
    expect(screen.getByText(/PFAD-TEXT/)).toBeInTheDocument();
  });

  it("zeigt Vektor-Export", () => {
    render(<ConcreteCalligramEngineModal />);
    expect(screen.getByText(/VEKTOR-EXPORT/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<ConcreteCalligramEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
