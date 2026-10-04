// @vitest-environment jsdom
/**
 * Tests: ManuscriptStoryboard (WP 42.1 — Interaktive Korkwand)
 */


import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ManuscriptStoryboard,
  moveItem,
  groupByAct,
  makeTeaser,
  ACT_LABELS,
  type StoryboardChapter,
} from "./ManuscriptStoryboard";

const CHAPTERS: StoryboardChapter[] = [
  { id: "c1", title: "Anfang", status: "done", wordCount: 2000, act: "Akt 1" },
  { id: "c2", title: "Mitte", status: "editing", wordCount: 3500, act: "Midpoint" },
  { id: "c3", title: "Ende", status: "draft", wordCount: 1800, teaser: "Der Showdown" },
];

describe("moveItem", () => {
  it("verschiebt vorwärts", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("verschiebt rückwärts", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("gleicher Index ändert nichts", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it("ungültiger Index gibt Liste unverändert", () => {
    const list = ["a", "b"];
    expect(moveItem(list, -1, 0)).toBe(list);
    expect(moveItem(list, 0, 5)).toBe(list);
  });

  it("ist unveränderlich", () => {
    const list = ["a", "b", "c"];
    const result = moveItem(list, 0, 2);
    expect(list).toEqual(["a", "b", "c"]);
    expect(result).not.toBe(list);
  });
});

describe("groupByAct", () => {
  it("gruppiert nach Akten in Reihenfolge", () => {
    const groups = groupByAct(CHAPTERS);
    expect(groups[0].act).toBe("Akt 1");
    expect(groups[1].act).toBe("Midpoint");
  });

  it("unzugeordnete Kapitel landen in 'Ohne Akt'", () => {
    const groups = groupByAct(CHAPTERS);
    const last = groups[groups.length - 1];
    expect(last.act).toBe("Ohne Akt");
    expect(last.chapters.length).toBe(1);
  });

  it("leere Liste ergibt leere Gruppen", () => {
    expect(groupByAct([])).toEqual([]);
  });

  it("enthält alle Kapitel", () => {
    const groups = groupByAct(CHAPTERS);
    const total = groups.reduce((n, g) => n + g.chapters.length, 0);
    expect(total).toBe(CHAPTERS.length);
  });
});

describe("makeTeaser", () => {
  it("kürzt langen Text", () => {
    const long = "Wort ".repeat(50);
    const teaser = makeTeaser(long, 40);
    expect(teaser.length).toBeLessThanOrEqual(41);
    expect(teaser.endsWith("…")).toBe(true);
  });

  it("lässt kurzen Text unverändert", () => {
    expect(makeTeaser("Kurz.", 100)).toBe("Kurz.");
  });

  it("normalisiert Whitespace", () => {
    expect(makeTeaser("A\n\n  B", 100)).toBe("A B");
  });
});

describe("ACT_LABELS", () => {
  it("enthält 7 dramaturgische Akte", () => {
    expect(ACT_LABELS.length).toBe(7);
  });

  it("beginnt mit Akt 1 und endet mit Resolution", () => {
    expect(ACT_LABELS[0]).toBe("Akt 1");
    expect(ACT_LABELS[ACT_LABELS.length - 1]).toBe("Resolution");
  });
});

describe("ManuscriptStoryboard — Rendering", () => {
  it("rendert alle Kapitel als Karten", () => {
    render(<ManuscriptStoryboard chapters={CHAPTERS} />);
    expect(screen.getByTestId("storyboard-card-c1")).toBeTruthy();
    expect(screen.getByTestId("storyboard-card-c2")).toBeTruthy();
    expect(screen.getByTestId("storyboard-card-c3")).toBeTruthy();
  });

  it("zeigt Kapitelzahl und Wortsumme", () => {
    render(<ManuscriptStoryboard chapters={CHAPTERS} />);
    expect(screen.getByTestId("manuscript-storyboard").textContent).toContain("3 Kapitel");
    expect(screen.getByTestId("manuscript-storyboard").textContent).toContain("7.300");
  });

  it("zeigt Status pro Karte", () => {
    render(<ManuscriptStoryboard chapters={CHAPTERS} />);
    expect(screen.getByTestId("storyboard-status-c1").textContent).toBe("Fertig");
    expect(screen.getByTestId("storyboard-status-c3").textContent).toBe("Entwurf");
  });

  it("zeigt Teaser wenn vorhanden", () => {
    render(<ManuscriptStoryboard chapters={CHAPTERS} />);
    expect(screen.getByTestId("storyboard-card-c3").textContent).toContain("Der Showdown");
  });

  it("zeigt Hinweis bei leerer Liste", () => {
    render(<ManuscriptStoryboard chapters={[]} />);
    expect(screen.getByTestId("storyboard-empty")).toBeTruthy();
  });

  it("Umschalten auf Akte-Gruppierung funktioniert", () => {
    render(<ManuscriptStoryboard chapters={CHAPTERS} />);
    fireEvent.click(screen.getByTestId("storyboard-toggle-grouping"));
    expect(screen.getByTestId("storyboard-act-group-Akt 1")).toBeTruthy();
    expect(screen.getByTestId("storyboard-act-group-Ohne Akt")).toBeTruthy();
  });

  it("ruft onReorder beim Drop mit neuer Reihenfolge", () => {
    const onReorder = vi.fn();
    render(<ManuscriptStoryboard chapters={CHAPTERS} onReorder={onReorder} />);
    const card1 = screen.getByTestId("storyboard-card-c1");
    const card3 = screen.getByTestId("storyboard-card-c3");
    fireEvent.dragStart(card1);
    fireEvent.dragOver(card3);
    fireEvent.drop(card3);
    expect(onReorder).toHaveBeenCalledWith(["c2", "c3", "c1"]);
  });

  it("ruft onAssignAct beim Ändern der Akt-Zuordnung", () => {
    const onAssignAct = vi.fn();
    render(<ManuscriptStoryboard chapters={CHAPTERS} onAssignAct={onAssignAct} />);
    fireEvent.change(screen.getByTestId("storyboard-act-c3"), { target: { value: "Klimax" } });
    expect(onAssignAct).toHaveBeenCalledWith("c3", "Klimax");
  });
});
