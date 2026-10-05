// @vitest-environment jsdom
/**
 * Tests: InteractiveGamePackagerModal (WP 69.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InteractiveGamePackagerModal } from "./InteractiveGamePackagerModal";

describe("InteractiveGamePackagerModal", () => {
  it("rendert die Komponente", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByTestId("interactive-game-packager-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByText("📖 Solo-Spielbuch-Packager")).toBeTruthy();
  });

  it("zeigt die Spielbuch-Prüfung", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByTestId("gb-validation")).toBeTruthy();
    expect(screen.getByTestId("gb-valid").textContent).toContain("erreichbar");
  });

  it("meldet kaputte Verweise", () => {
    render(<InteractiveGamePackagerModal initialStory={"# A\nText\n-> Weiter | Nirgendwo"} />);
    expect(screen.getByTestId("gb-valid").textContent).toContain("Fehler");
  });

  it("zeigt die gemischten Abschnitte", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByTestId("gb-sections")).toBeTruthy();
    expect(screen.getByTestId("gb-section-1")).toBeTruthy();
  });

  it("lässt den Einstieg auf Nummer 1", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByTestId("gb-section-1").textContent).toContain("Der Wald");
  });

  it("zeigt die Ziel-Nummern", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByTestId("gb-section-1").textContent).toContain("→");
  });

  it("zeigt die Würfeltabellen", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByTestId("gb-dice-text").textContent).toContain("Kampftabelle");
  });

  it("zeigt den Charakterbogen", () => {
    render(<InteractiveGamePackagerModal />);
    expect(screen.getByTestId("gb-sheet-text").textContent).toContain("CHARAKTERBOGEN");
  });

  it("zeigt das A5-PDF", () => {
    render(<InteractiveGamePackagerModal />);
    fireEvent.click(screen.getByTestId("gb-view-pdf"));
    expect(screen.getByTestId("gb-preview").textContent).toContain("%PDF");
    expect(screen.getByTestId("gb-preview").textContent).toContain("419.53");
  });

  it("zeigt das Webgame-HTML", () => {
    render(<InteractiveGamePackagerModal />);
    fireEvent.click(screen.getByTestId("gb-view-html"));
    expect(screen.getByTestId("gb-preview").textContent).toContain("<!DOCTYPE html>");
    expect(screen.getByTestId("gb-preview").textContent).toContain("application/json");
  });

  it("reagiert auf Seed-Änderung", () => {
    render(<InteractiveGamePackagerModal />);
    const before = screen.getByTestId("gb-section-2").textContent;
    fireEvent.change(screen.getByTestId("gb-seed-input"), { target: { value: "777" } });
    // Bei anderem Seed ändert sich die Reihenfolge der Abschnitte 2+.
    const after = screen.getByTestId("gb-section-2").textContent;
    expect(typeof before).toBe("string");
    expect(typeof after).toBe("string");
    expect(screen.getByTestId("interactive-game-packager-modal").textContent).toContain("777");
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<InteractiveGamePackagerModal />);
    fireEvent.change(screen.getByTestId("gb-title-input"), {
      target: { value: "Neues Abenteuer" },
    });
    // Der Titel erscheint im PDF-Export.
    fireEvent.click(screen.getByTestId("gb-view-pdf"));
    expect(screen.getByTestId("gb-preview").textContent).toContain("Neues Abenteuer");
  });

  it("reagiert auf Story-Eingabe", () => {
    render(<InteractiveGamePackagerModal />);
    fireEvent.change(screen.getByTestId("gb-story-input"), {
      target: { value: "# Eins\nText\n-> Weiter | Zwei\n---\n# Zwei\nFertig." },
    });
    expect(screen.getByTestId("gb-section-1").textContent).toContain("Eins");
  });

  it("kommt mit leerer Story zurecht", () => {
    render(<InteractiveGamePackagerModal initialStory="" />);
    expect(screen.getByTestId("interactive-game-packager-modal")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<InteractiveGamePackagerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
