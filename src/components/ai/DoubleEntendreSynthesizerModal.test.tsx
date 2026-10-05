// @vitest-environment jsdom
/**
 * Tests: DoubleEntendreSynthesizerModal (WP 64.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DoubleEntendreSynthesizerModal } from "./DoubleEntendreSynthesizerModal";

describe("DoubleEntendreSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<DoubleEntendreSynthesizerModal />);
    expect(screen.getByTestId("double-entendre-synthesizer-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<DoubleEntendreSynthesizerModal />);
    expect(screen.getByText("🎭 Doppelbödigkeits- & Intrigen-Synthesizer")).toBeTruthy();
  });

  it("zeigt den Dialog", () => {
    render(<DoubleEntendreSynthesizerModal />);
    expect(screen.getByTestId("entendre-dialogue")).toBeTruthy();
    expect(screen.getByTestId("entendre-line-1")).toBeTruthy();
  });

  it("blendet bei Hover die Dechiffrierung ein", () => {
    render(<DoubleEntendreSynthesizerModal />);
    fireEvent.mouseEnter(screen.getByTestId("entendre-line-1"));
    expect(screen.getByTestId("entendre-deciphered-1")).toBeTruthy();
  });

  it("blendet bei MouseLeave die Dechiffrierung aus", () => {
    render(<DoubleEntendreSynthesizerModal />);
    fireEvent.mouseEnter(screen.getByTestId("entendre-line-1"));
    expect(screen.getByTestId("entendre-deciphered-1")).toBeTruthy();
    fireEvent.mouseLeave(screen.getByTestId("entendre-line-1"));
    expect(screen.queryByTestId("entendre-deciphered-1")).toBeNull();
  });

  it("reagiert auf Themen-Auswahl", () => {
    render(<DoubleEntendreSynthesizerModal />);
    fireEvent.change(screen.getByTestId("entendre-topic-select"), {
      target: { value: "wine" },
    });
    expect(screen.getByTestId("double-entendre-synthesizer-modal").textContent).toContain("Weinlese");
  });

  it("reagiert auf Absichts-Auswahl", () => {
    render(<DoubleEntendreSynthesizerModal />);
    fireEvent.change(screen.getByTestId("entendre-intent-select"), {
      target: { value: "blackmail" },
    });
    expect(screen.getByTestId("double-entendre-synthesizer-modal").textContent).toContain("Erpressung");
  });

  it("reagiert auf Sprecher-Eingabe", () => {
    render(<DoubleEntendreSynthesizerModal />);
    fireEvent.change(screen.getByTestId("entendre-speaker-input"), {
      target: { value: "Der Herzog" },
    });
    expect(screen.getByTestId("entendre-line-1").textContent).toContain("DER HERZOG");
  });

  it("reagiert auf Subtext-Eingabe", () => {
    render(<DoubleEntendreSynthesizerModal />);
    fireEvent.change(screen.getByTestId("entendre-secret-input"), {
      target: { value: "Ich kenne das Geheimnis" },
    });
    fireEvent.mouseEnter(screen.getByTestId("entendre-line-1"));
    expect(screen.getByTestId("entendre-deciphered-1").textContent).toContain("Geheimnis");
  });

  it("reagiert auf Redebeitrags-Slider", () => {
    render(<DoubleEntendreSynthesizerModal />);
    fireEvent.change(screen.getByTestId("entendre-turns-input"), {
      target: { value: "10" },
    });
    expect(screen.getByTestId("entendre-line-10")).toBeTruthy();
  });

  it("zeigt die Analyse", () => {
    render(<DoubleEntendreSynthesizerModal />);
    expect(screen.getByTestId("entendre-analysis")).toBeTruthy();
    expect(screen.getByTestId("entendre-layering-rate")).toBeTruthy();
  });

  it("zeigt den vollständigen Oberflächentext", () => {
    render(<DoubleEntendreSynthesizerModal />);
    expect(screen.getByTestId("entendre-surface-text").textContent).toContain("„");
  });

  it("zeigt den vollständigen entschlüsselten Text", () => {
    render(<DoubleEntendreSynthesizerModal />);
    expect(screen.getByTestId("entendre-deciphered-full").textContent).toContain("Gemeint:");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<DoubleEntendreSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
