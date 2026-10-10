// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HauntedArchitectureEngineModal } from "./HauntedArchitectureEngineModal";

describe("HauntedArchitectureEngineModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<HauntedArchitectureEngineModal />);
    expect(getByTestId("haunted-architecture-modal")).toBeTruthy();
  });

  it("zeigt Titel an", () => {
    const { getByText } = render(<HauntedArchitectureEngineModal />);
    expect(getByText(/Spukhaus-Topografie & Haus-als-Organismus/)).toBeTruthy();
  });

  it("zeigt Geometrie-Anomalie", () => {
    const { getByText } = render(<HauntedArchitectureEngineModal />);
    expect(getByText(/GEOMETRIE-ANOMALIE/)).toBeTruthy();
  });

  it("zeigt Verfalls-Prosa", () => {
    const { getByText } = render(<HauntedArchitectureEngineModal />);
    expect(getByText(/VERFALLS-PROSA/)).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { getByTestId } = render(<HauntedArchitectureEngineModal />);
    const container = getByTestId("haunted-architecture-modal");
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
