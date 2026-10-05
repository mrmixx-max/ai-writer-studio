// @vitest-environment jsdom
/**
 * Tests: ConlangDialogGeneratorModal (WP 59.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConlangDialogGeneratorModal } from "./ConlangDialogGeneratorModal";

describe("ConlangDialogGeneratorModal", () => {
  it("rendert die Komponente", () => {
    render(<ConlangDialogGeneratorModal />);
    expect(screen.getByTestId("conlang-dialog-generator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ConlangDialogGeneratorModal />);
    expect(screen.getByText("🗣️ Conlang-Generator")).toBeTruthy();
  });

  it("zeigt den Sprachnamen und die Profil-Beschreibung", () => {
    render(<ConlangDialogGeneratorModal />);
    expect(screen.getByTestId("conlang-dialog-generator-modal").textContent).toContain("Khar'ash");
  });

  it("zeigt alle drei Phonologie-Profile", () => {
    render(<ConlangDialogGeneratorModal />);
    ["guttural", "melodic", "mechanical"].forEach((p) => {
      expect(screen.getByTestId(`conlang-profile-${p}`)).toBeTruthy();
    });
  });

  it("wechselt das Profil", () => {
    render(<ConlangDialogGeneratorModal />);
    const before = screen.getByTestId("conlang-consonants").textContent;
    fireEvent.click(screen.getByTestId("conlang-profile-mechanical"));
    expect(screen.getByTestId("conlang-consonants").textContent).not.toBe(before);
  });

  it("markiert das aktive Profil", () => {
    render(<ConlangDialogGeneratorModal />);
    fireEvent.click(screen.getByTestId("conlang-profile-melodic"));
    expect(screen.getByTestId("conlang-profile-melodic").getAttribute("aria-pressed")).toBe("true");
  });

  it("zeigt das Phoneminventar", () => {
    render(<ConlangDialogGeneratorModal />);
    expect(screen.getByTestId("conlang-phonemes")).toBeTruthy();
    expect((screen.getByTestId("conlang-consonants").textContent ?? "").length).toBeGreaterThan(10);
  });

  it("übersetzt einen Satz", () => {
    render(<ConlangDialogGeneratorModal />);
    expect((screen.getByTestId("conlang-foreign").textContent ?? "").length).toBeGreaterThan(3);
  });

  it("übernimmt einen neuen Satz", () => {
    render(<ConlangDialogGeneratorModal />);
    const before = screen.getByTestId("conlang-foreign").textContent;
    fireEvent.change(screen.getByTestId("conlang-sentence-input"), {
      target: { value: "Schwert und Nacht" },
    });
    expect(screen.getByTestId("conlang-foreign").textContent).not.toBe(before);
  });

  it("bettet narrativ mit Übersetzung ein", () => {
    render(<ConlangDialogGeneratorModal />);
    const text = screen.getByTestId("conlang-narrative").textContent ?? "";
    expect(text).toContain("Es bedeutete wörtlich");
  });

  it("übernimmt das Sprechverb", () => {
    render(<ConlangDialogGeneratorModal />);
    fireEvent.change(screen.getByTestId("conlang-verb-input"), { target: { value: "brüllte" } });
    expect(screen.getByTestId("conlang-narrative").textContent).toContain("brüllte");
  });

  it("zeigt die wörtliche Übersetzung", () => {
    render(<ConlangDialogGeneratorModal />);
    expect((screen.getByTestId("conlang-literal").textContent ?? "").length).toBeGreaterThan(2);
  });

  it("schlägt ein bekanntes Wort nach", () => {
    render(<ConlangDialogGeneratorModal />);
    const result = screen.getByTestId("conlang-lookup-result").textContent ?? "";
    expect(result).toContain("✓");
    expect(result).toContain("→");
  });

  it("meldet unbekannte Wörter", () => {
    render(<ConlangDialogGeneratorModal />);
    fireEvent.change(screen.getByTestId("conlang-lookup-input"), {
      target: { value: "Xyzzy" },
    });
    expect(screen.getByTestId("conlang-lookup-result").textContent).toContain("nicht im Lexikon");
  });

  it("zeigt das Lexikon", () => {
    render(<ConlangDialogGeneratorModal />);
    expect(screen.getByTestId("conlang-entry-Blut")).toBeTruthy();
    expect(screen.getByTestId("conlang-entry-Schwert")).toBeTruthy();
  });

  it("übernimmt einen neuen Sprachnamen", () => {
    render(<ConlangDialogGeneratorModal />);
    fireEvent.change(screen.getByTestId("conlang-name-input"), {
      target: { value: "Vraghul" },
    });
    expect(screen.getByTestId("conlang-dialog-generator-modal").textContent).toContain("Vraghul");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ConlangDialogGeneratorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
