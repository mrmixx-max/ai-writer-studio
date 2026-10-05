// @vitest-environment jsdom
/**
 * Tests: ProseExpanderModal (WP 54.1 — Beat-zu-Prosa-Expander)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProseExpanderModal } from "./ProseExpanderModal";

describe("ProseExpanderModal", () => {
  it("rendert die Komponente", () => {
    render(<ProseExpanderModal />);
    expect(screen.getByTestId("prose-expander-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ProseExpanderModal />);
    expect(screen.getByText("✍️ Beat-zu-Prosa-Expander")).toBeTruthy();
  });

  it("zeigt bei leerer Eingabe den Hinweis", () => {
    render(<ProseExpanderModal />);
    expect(screen.getByTestId("prose-empty")).toBeTruthy();
  });

  it("expandiert eingegebene Beats", () => {
    render(<ProseExpanderModal initialBeats={"Miller betritt den Saloon\nEr trinkt Whisky"} />);
    expect(screen.getByTestId("prose-beat-count").textContent).toBe("2");
    expect(screen.getByTestId("prose-paragraph-1")).toBeTruthy();
    expect(screen.getByTestId("prose-paragraph-2")).toBeTruthy();
  });

  it("zählt Wörter", () => {
    render(<ProseExpanderModal initialBeats={"Er geht"} />);
    const words = Number(screen.getByTestId("prose-word-count").textContent);
    expect(words).toBeGreaterThan(5);
  });

  it("zeigt Sinnesanker", () => {
    render(<ProseExpanderModal initialBeats={"Er geht"} />);
    const anchors = Number(screen.getByTestId("prose-sensory-count").textContent);
    expect(anchors).toBeGreaterThan(0);
  });

  it("reagiert auf Pacing-Wechsel", () => {
    render(<ProseExpanderModal initialBeats={"Er geht zum Hafen"} />);
    const before = screen.getByTestId("prose-word-count").textContent;
    fireEvent.change(screen.getByTestId("prose-pacing-select"), {
      target: { value: "atmospheric" },
    });
    const after = screen.getByTestId("prose-word-count").textContent;
    expect(Number(after)).toBeGreaterThan(Number(before));
  });

  it("übernimmt neue Eingaben", () => {
    render(<ProseExpanderModal />);
    fireEvent.change(screen.getByTestId("prose-beats-input"), {
      target: { value: "A\nB\nC" },
    });
    expect(screen.getByTestId("prose-beat-count").textContent).toBe("3");
  });

  it("entfernt Aufzählungszeichen", () => {
    render(<ProseExpanderModal initialBeats={"- Erster Beat\n* Zweiter Beat"} />);
    expect(screen.getByTestId("prose-beat-count").textContent).toBe("2");
  });

  it("zeigt die Tell-Kontrolle", () => {
    render(<ProseExpanderModal initialBeats={"Er geht"} />);
    expect(screen.getByTestId("prose-telling-analysis")).toBeTruthy();
  });

  it("meldet keine Tell-Stellen bei gezeigtem Text", () => {
    render(<ProseExpanderModal initialBeats={"Er geht"} />);
    expect(screen.getByTestId("prose-tell-count").textContent).toBe("0");
  });

  it("zeigt Tell→Show-Ersetzungen bei Gefühls-Beat", () => {
    render(<ProseExpanderModal initialBeats={"Er hatte Todesangst"} />);
    const shown = Number(screen.getByTestId("prose-shown-count").textContent);
    expect(shown).toBeGreaterThan(0);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ProseExpanderModal initialBeats={"Er geht"} />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });

  it("kommt mit ungültigen Startwerten zurecht", () => {
    render(<ProseExpanderModal initialBeats={undefined} />);
    expect(screen.getByTestId("prose-expander-modal")).toBeTruthy();
    expect(screen.getByTestId("prose-empty")).toBeTruthy();
  });
});
