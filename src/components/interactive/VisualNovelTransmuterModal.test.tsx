// @vitest-environment jsdom
/**
 * Tests: VisualNovelTransmuterModal (WP 68.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VisualNovelTransmuterModal } from "./VisualNovelTransmuterModal";

describe("VisualNovelTransmuterModal", () => {
  it("rendert die Komponente", () => {
    render(<VisualNovelTransmuterModal />);
    expect(screen.getByTestId("visual-novel-transmuter-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<VisualNovelTransmuterModal />);
    expect(screen.getByText("🎮 Visual Novel Transmuter")).toBeTruthy();
  });

  it("zeigt die Skript-Prüfung", () => {
    render(<VisualNovelTransmuterModal />);
    expect(screen.getByTestId("vn-validation")).toBeTruthy();
    expect(screen.getByTestId("vn-valid").textContent).toContain("gültig");
  });

  it("meldet kaputte Sprünge", () => {
    render(<VisualNovelTransmuterModal initialProse={"# A\nText\n> Weiter -> Nirgendwo"} />);
    expect(screen.getByTestId("vn-broken-jumps")).toBeTruthy();
    expect(screen.getByTestId("vn-valid").textContent).toContain("Fehler");
  });

  it("zeigt den Live-Player", () => {
    render(<VisualNovelTransmuterModal />);
    expect(screen.getByTestId("vn-player")).toBeTruthy();
    expect(screen.getByTestId("vn-player-title")).toBeTruthy();
  });

  it("zeigt die erste Dialogzeile", () => {
    render(<VisualNovelTransmuterModal />);
    expect(screen.getByTestId("vn-player-dialogue").textContent).toContain("Ich gehe jetzt");
  });

  it("zeigt den Hintergrund", () => {
    render(<VisualNovelTransmuterModal />);
    expect(screen.getByTestId("vn-player-bg").textContent).toContain("forest");
  });

  it("rückt bei Klick zur nächsten Zeile vor", () => {
    render(<VisualNovelTransmuterModal />);
    const dialogue = screen.getByTestId("vn-player-dialogue");
    expect(dialogue.textContent).toContain("Ich gehe jetzt");
    fireEvent.click(dialogue);
    expect(screen.getByTestId("vn-player-dialogue").textContent).toContain("Das wagst du nicht");
  });

  it("zeigt Emotionstags", () => {
    render(<VisualNovelTransmuterModal />);
    fireEvent.click(screen.getByTestId("vn-player-dialogue"));
    expect(screen.getByTestId("vn-player-emotion").textContent).toContain("angry");
  });

  it("zeigt Entscheidungen nach der letzten Zeile", () => {
    render(<VisualNovelTransmuterModal />);
    fireEvent.click(screen.getByTestId("vn-player-dialogue"));
    expect(screen.getByTestId("vn-player-choices")).toBeTruthy();
    expect(screen.getByTestId("vn-choice-0").textContent).toContain("Fliehen");
  });

  it("springt bei Klick auf eine Entscheidung zur Zielszene", () => {
    render(<VisualNovelTransmuterModal />);
    fireEvent.click(screen.getByTestId("vn-player-dialogue"));
    fireEvent.click(screen.getByTestId("vn-choice-0"));
    expect(screen.getByTestId("vn-player-title").textContent).toContain("Die Lichtung");
  });

  it("setzt den Player zurück", () => {
    render(<VisualNovelTransmuterModal />);
    fireEvent.click(screen.getByTestId("vn-player-dialogue"));
    fireEvent.click(screen.getByTestId("vn-choice-0"));
    fireEvent.click(screen.getByTestId("vn-player-reset"));
    expect(screen.getByTestId("vn-player-title").textContent).toContain("Der Wald");
  });

  it("zeigt den Ren'Py-Export", () => {
    render(<VisualNovelTransmuterModal />);
    expect(screen.getByTestId("vn-export-output").textContent).toContain("label start:");
  });

  it("schaltet auf Twine um", () => {
    render(<VisualNovelTransmuterModal />);
    fireEvent.click(screen.getByTestId("vn-export-twine"));
    expect(screen.getByTestId("vn-export-output").textContent).toContain("tw-storydata");
  });

  it("reagiert auf Manuskript-Eingabe", () => {
    render(<VisualNovelTransmuterModal />);
    fireEvent.change(screen.getByTestId("vn-prose-input"), {
      target: { value: "# Nur eine Szene\nA: \"Hallo\"" },
    });
    expect(screen.getByTestId("vn-player-title").textContent).toContain("Nur eine Szene");
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<VisualNovelTransmuterModal />);
    fireEvent.change(screen.getByTestId("vn-title-input"), {
      target: { value: "Neues Spiel" },
    });
    expect(screen.getByTestId("vn-export-output").textContent).toContain("Neues Spiel");
  });

  it("kommt mit leerem Manuskript zurecht", () => {
    render(<VisualNovelTransmuterModal initialProse="" />);
    expect(screen.getByTestId("vn-player-empty")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<VisualNovelTransmuterModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
