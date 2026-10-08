// @vitest-environment jsdom
// AntiquarianBookbindingStudioModal – UI-Tests (Meilenstein 56.0 / v6.8.0)
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AntiquarianBookbindingStudioModal } from "./AntiquarianBookbindingStudioModal";

describe("AntiquarianBookbindingStudioModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<AntiquarianBookbindingStudioModal />);
    expect(getByTestId("antiquarian-bookbinding-modal")).toBeTruthy();
  });

  it("zeigt Titel an", () => {
    const { getByText } = render(<AntiquarianBookbindingStudioModal />);
    expect(getByText(/Antiquarisches Marmorpapier- & Bünde-Studio/)).toBeTruthy();
  });

  it("zeigt Marmorpapier", () => {
    const { getByText } = render(<AntiquarianBookbindingStudioModal />);
    expect(getByText(/MARMORPAPIER/)).toBeTruthy();
  });

  it("zeigt Buchrücken-Mockup", () => {
    const { getByText } = render(<AntiquarianBookbindingStudioModal />);
    expect(getByText(/BUCHRÜCKEN-MOCKUP/)).toBeTruthy();
  });

  it("zeigt Druck-Export", () => {
    const { getByText } = render(<AntiquarianBookbindingStudioModal />);
    expect(getByText(/DRUCK-EXPORT/)).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<AntiquarianBookbindingStudioModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
