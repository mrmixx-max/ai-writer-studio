// @vitest-environment jsdom
/**
 * Tests: ForeshadowingWeaverModal (WP 56.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ForeshadowingWeaverModal } from "./ForeshadowingWeaverModal";

describe("ForeshadowingWeaverModal", () => {
  it("rendert die Komponente", () => {
    render(<ForeshadowingWeaverModal />);
    expect(screen.getByTestId("foreshadowing-weaver-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ForeshadowingWeaverModal />);
    expect(screen.getByText("🎯 Foreshadowing-Weaver")).toBeTruthy();
  });

  it("zeigt einen Hinweis je Stufe", () => {
    render(<ForeshadowingWeaverModal />);
    expect(screen.getByTestId("foreshadowing-clue-1")).toBeTruthy();
    expect(screen.getByTestId("foreshadowing-clue-2")).toBeTruthy();
    expect(screen.getByTestId("foreshadowing-clue-3")).toBeTruthy();
  });

  it("benennt die Stufen", () => {
    render(<ForeshadowingWeaverModal />);
    const text = screen.getByTestId("foreshadowing-plan").textContent ?? "";
    expect(text).toContain("Kaum merklich");
    expect(text).toContain("Gegenstands-Verankerung");
    expect(text).toContain("Ominöse Ahnung");
  });

  it("erhält den Originaltext der Szene", () => {
    render(<ForeshadowingWeaverModal />);
    const text = screen.getByTestId("foreshadowing-output-text").textContent ?? "";
    expect(text).toContain("Der Saal war voll");
    expect(text).toContain("Niemand sah den Leibarzt an");
  });

  it("macht die Szene länger", () => {
    render(<ForeshadowingWeaverModal />);
    const text = screen.getByTestId("foreshadowing-output-text").textContent ?? "";
    expect(text.length).toBeGreaterThan(100);
  });

  it("reagiert auf geänderte Hinweiszahl", () => {
    render(<ForeshadowingWeaverModal />);
    fireEvent.change(screen.getByTestId("foreshadowing-count-input"), { target: { value: "1" } });
    const text = screen.getByTestId("foreshadowing-output").textContent ?? "";
    expect(text).toContain("1 eingeflochten");
  });

  it("reagiert auf das Zielkapitel", () => {
    render(<ForeshadowingWeaverModal />);
    const before = screen.getByTestId("foreshadowing-output-text").textContent;
    fireEvent.change(screen.getByTestId("foreshadowing-chapter-input"), { target: { value: "19" } });
    expect(screen.getByTestId("foreshadowing-output-text").textContent).not.toBe(before);
  });

  it("übernimmt einen neuen Twist", () => {
    render(<ForeshadowingWeaverModal />);
    fireEvent.change(screen.getByTestId("foreshadowing-twist-input"), {
      target: { value: "Der Hauptmann verrät das Lager an den Feind." },
    });
    expect(screen.getByTestId("foreshadowing-keywords").textContent).toContain("hauptmann");
  });

  it("zeigt das Hinweis-Audit", () => {
    render(<ForeshadowingWeaverModal />);
    expect(screen.getByTestId("foreshadowing-audit")).toBeTruthy();
    expect(screen.getByTestId("foreshadowing-audit-total")).toBeTruthy();
  });

  it("zählt die Stufen im Audit", () => {
    render(<ForeshadowingWeaverModal />);
    expect(screen.getByTestId("foreshadowing-audit-level-1")).toBeTruthy();
    expect(screen.getByTestId("foreshadowing-audit-level-2")).toBeTruthy();
    expect(screen.getByTestId("foreshadowing-audit-level-3")).toBeTruthy();
  });

  it("zeigt die Stufen-Abdeckung", () => {
    render(<ForeshadowingWeaverModal />);
    expect(screen.getByTestId("foreshadowing-coverage").textContent).toContain("Abdeckung");
  });

  it("kommt mit leerem Twist zurecht", () => {
    render(<ForeshadowingWeaverModal />);
    fireEvent.change(screen.getByTestId("foreshadowing-twist-input"), { target: { value: "" } });
    expect(screen.queryByTestId("foreshadowing-plan")).toBeNull();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ForeshadowingWeaverModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
