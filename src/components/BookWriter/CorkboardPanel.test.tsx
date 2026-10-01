// @vitest-environment jsdom
// Component-Tests: CorkboardPanel — Karten-Grid und Drag-and-Drop-Reordering.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CorkboardPanel } from "./CorkboardPanel";
import type { BookChapterIndex } from "@/services/plot/corkboard";

function makeChapter(
  id: string,
  over: Partial<BookChapterIndex> = {},
): BookChapterIndex {
  return {
    id,
    title: `Kapitel ${id.toUpperCase()}`,
    logline: `Logline ${id}`,
    povCharacter: "Anna",
    location: "Berlin",
    status: "draft",
    sortOrder: 0,
    ...over,
  };
}

/** Minimaler DataTransfer-Ersatz (jsdom/happy-dom liefern keinen). */
function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    effectAllowed: "",
    dropEffect: "",
    setData: (key: string, value: string) => {
      store[key] = value;
    },
    getData: (key: string) => store[key] ?? "",
  };
}

describe("CorkboardPanel", () => {
  it("rendert ohne Absturz und zeigt die Korkwand", () => {
    render(<CorkboardPanel chapters={[makeChapter("a")]} />);
    expect(screen.getByTestId("corkboard-panel")).toBeTruthy();
    expect(screen.getByTestId("corkboard-grid")).toBeTruthy();
  });

  it("zeigt eine Karte pro Kapitel mit allen Feldern", () => {
    const chapters = [
      makeChapter("a", { title: "Der Anfang", logline: "Alles beginnt.", povCharacter: "Anna", location: "Berlin", status: "draft" }),
      makeChapter("b", { title: "Die Krise", logline: "Nichts ist mehr sicher.", povCharacter: "Ben", location: "Hamburg", status: "revision" }),
      makeChapter("c", { title: "Das Ende", logline: "Alles klärt sich.", povCharacter: "Clara", location: "Wien", status: "completed" }),
    ];
    render(<CorkboardPanel chapters={chapters} />);

    expect(screen.getByTestId("corkboard-card-a")).toBeTruthy();
    expect(screen.getByTestId("corkboard-card-b")).toBeTruthy();
    expect(screen.getByTestId("corkboard-card-c")).toBeTruthy();

    expect(screen.getByTestId("corkboard-card-title-a").textContent).toContain("Der Anfang");
    expect(screen.getByTestId("corkboard-card-logline-a").textContent).toContain("Alles beginnt.");
    expect(screen.getByTestId("corkboard-card-pov-b").textContent).toContain("Ben");
    expect(screen.getByTestId("corkboard-card-location-c").textContent).toContain("Wien");
  });

  it("zeigt das passende Status-Badge je Kapitel", () => {
    const chapters = [
      makeChapter("a", { status: "draft" }),
      makeChapter("b", { status: "revision" }),
      makeChapter("c", { status: "completed" }),
    ];
    render(<CorkboardPanel chapters={chapters} />);

    expect(screen.getByTestId("corkboard-status-a").textContent).toBe("Entwurf");
    expect(screen.getByTestId("corkboard-status-b").textContent).toBe("Überarbeitung");
    expect(screen.getByTestId("corkboard-status-c").textContent).toBe("Fertig");
  });

  it("nutzt getCorkboardLayout für das Grid (Spalten + Positionen)", () => {
    const chapters = [makeChapter("a"), makeChapter("b"), makeChapter("c")];
    render(<CorkboardPanel chapters={chapters} columns={2} />);

    const grid = screen.getByTestId("corkboard-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toContain("repeat(2");

    // 3 Kapitel bei 2 Spalten → drittes Kapitel in Zeile 2, Spalte 1.
    const cardC = screen.getByTestId("corkboard-card-c") as HTMLElement;
    expect(cardC.style.gridRow).toBe("2");
    expect(cardC.style.gridColumn).toBe("1");
  });

  it("zeigt Kapitelanzahl und Spalten an", () => {
    render(<CorkboardPanel chapters={[makeChapter("a"), makeChapter("b")]} columns={4} />);
    const count = screen.getByTestId("corkboard-count").textContent ?? "";
    expect(count).toContain("2 Kapitel");
    expect(count).toContain("4 Spalten");
  });

  it("ordnet per Drag-and-Drop um und ruft onReorder auf", () => {
    const chapters = [makeChapter("a"), makeChapter("b"), makeChapter("c")];
    const onReorder = vi.fn();
    render(<CorkboardPanel chapters={chapters} onReorder={onReorder} />);

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(screen.getByTestId("corkboard-card-a"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("corkboard-card-c"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("corkboard-card-c"), { dataTransfer });

    expect(onReorder).toHaveBeenCalledTimes(1);
    const result = onReorder.mock.calls[0][0] as BookChapterIndex[];
    expect(result.map((c) => c.id)).toEqual(["b", "c", "a"]);
    // sortOrder wird durch reorderChapters neu gesetzt.
    expect(result.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
  });

  it("ruft onReorder bei ungültigem Zug (gleiche Position) nicht auf", () => {
    const chapters = [makeChapter("a"), makeChapter("b")];
    const onReorder = vi.fn();
    render(<CorkboardPanel chapters={chapters} onReorder={onReorder} />);

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(screen.getByTestId("corkboard-card-a"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("corkboard-card-a"), { dataTransfer });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("ruft onChapterClick bei Klick auf eine Karte auf", () => {
    const chapters = [makeChapter("a"), makeChapter("b")];
    const onChapterClick = vi.fn();
    render(<CorkboardPanel chapters={chapters} onChapterClick={onChapterClick} />);

    fireEvent.click(screen.getByTestId("corkboard-card-b"));
    expect(onChapterClick).toHaveBeenCalledTimes(1);
    expect((onChapterClick.mock.calls[0][0] as BookChapterIndex).id).toBe("b");
  });

  it("verarbeitet eine leere Kapitel-Liste graceful", () => {
    render(<CorkboardPanel chapters={[]} />);
    expect(screen.getByTestId("corkboard-panel")).toBeTruthy();
    expect(screen.getByTestId("corkboard-empty")).toBeTruthy();
    expect(screen.queryByTestId("corkboard-grid")).toBeNull();
  });

  it("markiert Karten als draggable", () => {
    render(<CorkboardPanel chapters={[makeChapter("a")]} />);
    const card = screen.getByTestId("corkboard-card-a") as HTMLElement;
    expect(card.getAttribute("draggable")).toBe("true");
    expect(card.getAttribute("data-index")).toBe("0");
  });
});
