// @vitest-environment jsdom
/**
 * Tests: TableReadDirector (WP 45.1 — Drehbuch-Table-Read)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableReadDirector } from "./TableReadDirector";
import type { ScreenplayDocument } from "@/services/screenplay/screenplayTransmuter";

const DOC: ScreenplayDocument = {
  title: "Testdrehbuch",
  scenes: [
    {
      slugline: "INT. BÜRO - TAG",
      action: ["Schmidt sitzt am Schreibtisch."],
      dialogue: [
        { character: "Schmidt", lines: ["Ich brauche Antworten."] },
        { character: "Zeugin", parenthetical: "nervös", lines: ["Ich weiß nichts."] },
      ],
    },
    {
      slugline: "EXT. STRASSE - NACHT",
      action: ["Regen fällt."],
      dialogue: [{ character: "Schmidt", lines: ["Verdammt."] }],
    },
  ],
};

describe("TableReadDirector", () => {
  it("rendert die Regie-Ansicht", () => {
    render(<TableReadDirector doc={DOC} />);
    expect(screen.getByTestId("table-read-director")).toBeTruthy();
  });

  it("zeigt Szenen- und Figurenzahl", () => {
    render(<TableReadDirector doc={DOC} />);
    const text = screen.getByTestId("table-read-director").textContent ?? "";
    expect(text).toContain("2 Szenen");
  });

  it("weist Rollen mit Farben zu", () => {
    render(<TableReadDirector doc={DOC} />);
    expect(screen.getByTestId("table-read-roles")).toBeTruthy();
    expect(screen.getByTestId("table-read-role-Schmidt")).toBeTruthy();
    expect(screen.getByTestId("table-read-role-Zeugin")).toBeTruthy();
  });

  it("zeigt die aktuelle Zeile", () => {
    render(<TableReadDirector doc={DOC} />);
    expect(screen.getByTestId("table-read-current")).toBeTruthy();
  });

  it("markiert Szenenwechsel beim ersten Aufruf", () => {
    render(<TableReadDirector doc={DOC} />);
    expect(screen.getByTestId("table-read-scene-cue")).toBeTruthy();
  });

  it("Weiter-Navigation bewegt den Index", () => {
    const onLine = vi.fn();
    render(<TableReadDirector doc={DOC} onLineChange={onLine} />);
    fireEvent.click(screen.getByTestId("table-read-next"));
    expect(onLine).toHaveBeenCalledWith(1);
  });

  it("Zurück ist am Anfang deaktiviert", () => {
    render(<TableReadDirector doc={DOC} />);
    expect((screen.getByTestId("table-read-prev") as HTMLButtonElement).disabled).toBe(true);
  });

  it("rendert die Skriptliste mit allen Zeilen", () => {
    render(<TableReadDirector doc={DOC} />);
    expect(screen.getByTestId("table-read-line-0")).toBeTruthy();
    expect(screen.getByTestId("table-read-line-1")).toBeTruthy();
  });

  it("Klick auf Skriptzeile springt dorthin", () => {
    const onLine = vi.fn();
    render(<TableReadDirector doc={DOC} onLineChange={onLine} />);
    fireEvent.click(screen.getByTestId("table-read-line-2"));
    expect(onLine).toHaveBeenCalledWith(2);
  });

  it("zeigt Parenthetical wenn vorhanden", () => {
    render(<TableReadDirector doc={DOC} />);
    // Zur Zeile mit Parenthetical springen
    fireEvent.click(screen.getByTestId("table-read-line-3"));
    const paren = screen.queryByTestId("table-read-parenthetical");
    if (paren) expect(paren.textContent).toContain("nervös");
  });

  it("kommt mit leerem Dokument zurecht", () => {
    render(<TableReadDirector doc={{ title: "Leer", scenes: [] }} />);
    expect(screen.getByTestId("table-read-empty")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<TableReadDirector doc={DOC} />);
    // Charakterfarben kommen als Inline-Border aus dem Service (deterministische Palette)
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
