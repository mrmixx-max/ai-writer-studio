// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EspionageTradecraftEngineModal } from "./EspionageTradecraftEngineModal";

describe("EspionageTradecraftEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<EspionageTradecraftEngineModal />);
    expect(screen.getByTestId("espionage-tradecraft-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<EspionageTradecraftEngineModal />);
    expect(screen.getByText(/Spionage-Tradecraft & Tot-Briefkasten-Topografie/)).toBeInTheDocument();
  });

  it("zeigt Spionage-Prosa", () => {
    render(<EspionageTradecraftEngineModal />);
    expect(screen.getByText(/SPIONAGE-PROSA/)).toBeInTheDocument();
  });

  it("zeigt Dead-Drop-Topografie", () => {
    render(<EspionageTradecraftEngineModal />);
    expect(screen.getByText(/DEAD-DROP-TOPOGRAFIE/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<EspionageTradecraftEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
