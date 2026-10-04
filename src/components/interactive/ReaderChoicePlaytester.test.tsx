// @vitest-environment jsdom
/**
 * Tests: ReaderChoicePlaytester (WP 46.2 — Gamebook Monte-Carlo Playtester)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaderChoicePlaytester } from "./ReaderChoicePlaytester";
import type { Gamebook } from "@/services/interactive/readerChoicePlaytester";

const BOOK: Gamebook = {
  id: "gb1",
  title: "Das verlorene Schwert",
  nodes: [
    {
      id: "start",
      text: "Du stehst vor einer Höhle.",
      choices: [
        { text: "Hineingehen", targetNodeId: "cave" },
        { text: "Zurückgehen", targetNodeId: "village" },
      ],
    },
    {
      id: "cave",
      text: "Drinnen ist es dunkel.",
      choices: [
        { text: "Fackel anzünden", targetNodeId: "treasure" },
        { text: "Im Dunkeln weiter", targetNodeId: "dead-end" },
      ],
    },
    {
      id: "village",
      text: "Du bist zurück im Dorf.",
      choices: [{ text: "Neustart", targetNodeId: "start" }],
    },
    {
      id: "treasure",
      text: "Du findest das Schwert!",
      choices: [],
      isEnding: true,
      endingType: "good",
    },
    {
      id: "dead-end",
      text: "Du stolperst und fällst.",
      choices: [],
      isEnding: true,
      endingType: "bad",
    },
  ],
};

describe("ReaderChoicePlaytester", () => {
  it("rendert den Playtester", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    expect(screen.getByTestId("reader-choice-playtester")).toBeTruthy();
  });

  it("zeigt Knoten- und Verzweigungszahl", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    const text = screen.getByTestId("reader-choice-playtester").textContent ?? "";
    expect(text).toContain("5 Knoten");
  });

  it("Simulation startbar", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    fireEvent.click(screen.getByTestId("playtester-run"));
    expect(screen.getByTestId("playtester-result")).toBeTruthy();
  });

  it("Ergebnis zeigt Iterationen", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    fireEvent.click(screen.getByTestId("playtester-run"));
    expect(screen.getByTestId("playtester-iterations-run").textContent).toContain("Simulationen");
  });

  it("Ergebnis zeigt durchschnittliche Pfadlänge", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    fireEvent.click(screen.getByTestId("playtester-run"));
    expect(screen.getByTestId("playtester-avg-length").textContent).toContain("Knoten");
  });

  it("Ergebnis zeigt Enden", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    fireEvent.click(screen.getByTestId("playtester-run"));
    expect(screen.getByTestId("playtester-endings").textContent).toContain("good");
  });

  it("Iterationen änderbar", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    fireEvent.change(screen.getByTestId("playtester-iterations"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByTestId("playtester-run"));
    expect(screen.getByTestId("playtester-iterations-run").textContent).toContain("500");
  });

  it("Heatmap nach Simulation sichtbar", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    fireEvent.click(screen.getByTestId("playtester-run"));
    expect(screen.getByTestId("playtester-heatmap")).toBeTruthy();
  });

  it("Heatmap zeigt Knoten-Besuche", () => {
    render(<ReaderChoicePlaytester book={BOOK} />);
    fireEvent.click(screen.getByTestId("playtester-run"));
    expect(screen.getByTestId("playtester-heat-start")).toBeTruthy();
  });

  it("kommt mit leerem Buch zurecht", () => {
    render(<ReaderChoicePlaytester book={{ id: "leer", title: "Leer", nodes: [] }} />);
    expect(screen.getByTestId("playtester-empty")).toBeTruthy();
  });

  it("Run-Button bei leerem Buch deaktiviert", () => {
    render(<ReaderChoicePlaytester book={{ id: "leer", title: "Leer", nodes: [] }} />);
    expect((screen.getByTestId("playtester-run") as HTMLButtonElement).disabled).toBe(true);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ReaderChoicePlaytester book={BOOK} />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
