// @vitest-environment jsdom
/**
 * Tests: SeriesUniverseMatrix (WP 44.2 — Multi-Book Serien-Universums-Matrix)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeriesUniverseMatrix } from "./SeriesUniverseMatrix";
import type { SeriesBook } from "@/services/worldbuilding/multiBookSeriesMatrix";

const BOOKS: SeriesBook[] = [
  {
    id: "b1",
    title: "Band 1",
    bookNumber: 1,
    yearsAfterPrevious: 0,
    characters: [
      { name: "Aldric", alive: true, injuries: [], alliances: ["Nordbund"], rank: "Knappe" },
      { name: "Mira", alive: true, injuries: [], alliances: [] },
    ],
    factions: ["Nordbund"],
  },
  {
    id: "b2",
    title: "Band 2",
    bookNumber: 2,
    yearsAfterPrevious: 3,
    characters: [
      { name: "Aldric", alive: true, injuries: ["linkes Auge"], alliances: ["Nordbund"], rank: "Ritter" },
      { name: "Mira", alive: false, injuries: [], alliances: [] },
    ],
    factions: ["Nordbund", "Südbund"],
  },
];

describe("SeriesUniverseMatrix", () => {
  it("rendert die Matrix", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    expect(screen.getByTestId("series-universe-matrix")).toBeTruthy();
  });

  it("zeigt Bandzahl und Figurenzahl", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    const text = screen.getByTestId("series-universe-matrix").textContent ?? "";
    expect(text).toContain("2 Bände");
    expect(text).toContain("2 Figuren");
  });

  it("rendert Spalten pro Band", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    expect(screen.getByTestId("series-col-1")).toBeTruthy();
    expect(screen.getByTestId("series-col-2")).toBeTruthy();
  });

  it("rendert Zeilen pro Figur", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    expect(screen.getByTestId("series-row-Aldric")).toBeTruthy();
    expect(screen.getByTestId("series-row-Mira")).toBeTruthy();
  });

  it("zeigt Lebensstatus pro Zelle", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    expect(screen.getByTestId("series-cell-Aldric-1").textContent).toContain("●");
    expect(screen.getByTestId("series-cell-Mira-2").textContent).toContain("✝");
  });

  it("markiert Verletzungen mit Warnsymbol", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    expect(screen.getByTestId("series-cell-Aldric-2").textContent).toContain("⚠");
  });

  it("Klick auf Figur zeigt Status-Audit", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    fireEvent.click(screen.getByTestId("series-row-Aldric"));
    expect(screen.getByTestId("series-character-audit")).toBeTruthy();
    expect(screen.getByTestId("series-character-audit").textContent).toContain("Aldric");
  });

  it("Audit listet Erscheinungen pro Band", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    fireEvent.click(screen.getByTestId("series-row-Mira"));
    expect(screen.getByTestId("series-audit-1")).toBeTruthy();
    expect(screen.getByTestId("series-audit-2")).toBeTruthy();
  });

  it("erkennt Widerspruch (Tod in Band 1 → lebendig in Band 2)", () => {
    const withContradiction: SeriesBook[] = [
      {
        ...BOOKS[0],
        characters: [
          { name: "Mira", alive: false, injuries: [], alliances: [] },
          ...BOOKS[0].characters.filter((c) => c.name !== "Mira"),
        ],
      },
      {
        ...BOOKS[1],
        characters: [
          { name: "Mira", alive: true, injuries: [], alliances: [] },
          ...BOOKS[1].characters.filter((c) => c.name !== "Mira"),
        ],
      },
    ];
    render(<SeriesUniverseMatrix books={withContradiction} />);
    expect(screen.getByTestId("series-contradictions")).toBeTruthy();
    expect(screen.getByTestId("series-contradiction-0").textContent).toContain("Mira");
  });

  it("zeigt Diff-Steuerung", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    expect(screen.getByTestId("series-diff-from")).toBeTruthy();
    expect(screen.getByTestId("series-diff-to")).toBeTruthy();
    expect(screen.getByTestId("series-diff")).toBeTruthy();
  });

  it("Diff zeigt vergangene Jahre", () => {
    render(<SeriesUniverseMatrix books={BOOKS} />);
    expect(screen.getByTestId("series-diff").textContent).toContain("Jahre vergangen");
  });

  it("Band-Buttons rufen onSelectBook", () => {
    const onSelect = vi.fn();
    render(<SeriesUniverseMatrix books={BOOKS} onSelectBook={onSelect} />);
    fireEvent.click(screen.getByTestId("series-open-1"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("kommt mit leerer Bandliste zurecht", () => {
    render(<SeriesUniverseMatrix books={[]} />);
    expect(screen.getByTestId("series-matrix-empty")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<SeriesUniverseMatrix books={BOOKS} />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
