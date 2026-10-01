// @vitest-environment jsdom
// Component-Tests: BeatSheetPanel — Vorlagen, Beat-Liste und Abdeckung.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BeatSheetPanel } from "./BeatSheetPanel";
import type { BookChapterInput } from "@/services/bookwriter/export/types";

function makeChapters(count: number, over: Partial<BookChapterInput> = {}): BookChapterInput[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    title: `Kapitel ${i + 1}`,
    content: "Ausgearbeiteter Text.",
    status: "draft",
    ...over,
  }));
}

describe("BeatSheetPanel", () => {
  it("rendert ohne Absturz und zeigt das Panel", () => {
    render(<BeatSheetPanel chapters={makeChapters(3)} />);
    expect(screen.getByTestId("beat-sheet-panel")).toBeTruthy();
  });

  it("zeigt die 15 Beats von Save the Cat als Liste", () => {
    render(<BeatSheetPanel chapters={makeChapters(3)} templateType="save-the-cat" />);
    expect(screen.getByTestId("beat-list")).toBeTruthy();
    expect(screen.getByTestId("beat-item-opening-image")).toBeTruthy();
    expect(screen.getByTestId("beat-item-final-image")).toBeTruthy();
    expect(screen.getByTestId("beat-name-opening-image").textContent).toContain("Opening Image");
    expect(screen.getByTestId("beat-description-opening-image").textContent).toContain("Erstes Bild");
  });

  it("bietet alle drei Vorlagen im Selektor an", () => {
    render(<BeatSheetPanel chapters={makeChapters(3)} />);
    expect(screen.getByTestId("beat-template-save-the-cat")).toBeTruthy();
    expect(screen.getByTestId("beat-template-hero-journey")).toBeTruthy();
    expect(screen.getByTestId("beat-template-three-act")).toBeTruthy();
  });

  it("wechselt die Vorlage und ruft onTemplateChange auf", () => {
    const onTemplateChange = vi.fn();
    render(
      <BeatSheetPanel chapters={makeChapters(3)} onTemplateChange={onTemplateChange} />,
    );

    // Save the Cat aktiv: 15 Beats.
    expect(screen.getByTestId("beat-item-opening-image")).toBeTruthy();

    fireEvent.click(screen.getByTestId("beat-template-hero-journey"));

    expect(onTemplateChange).toHaveBeenCalledWith("hero-journey");
    // Heldenreise: 12 Beats, anderer erster Beat.
    expect(screen.getByTestId("beat-item-ordinary-world")).toBeTruthy();
    expect(screen.queryByTestId("beat-item-opening-image")).toBeNull();
  });

  it("zeigt die Drei-Akt-Struktur mit 9 Beats", () => {
    render(<BeatSheetPanel chapters={makeChapters(3)} templateType="three-act" />);
    expect(screen.getByTestId("beat-item-act1-setup")).toBeTruthy();
    expect(screen.getByTestId("beat-item-act3-resolution")).toBeTruthy();
    expect(screen.getByTestId("beat-template-description").textContent).toContain("Drei Akte");
  });

  it("meldet vollständige Abdeckung bei gefüllten Kapiteln", () => {
    render(<BeatSheetPanel chapters={makeChapters(3)} templateType="three-act" />);
    const summary = screen.getByTestId("beat-coverage-summary").textContent ?? "";
    expect(summary).toContain("9/9");
    expect(summary).toContain("100%");
    expect(screen.getByTestId("beat-coverage-state").textContent).toBe("vollständig");
  });

  it("meldet fehlende Beats bei leeren Kapiteln", () => {
    const chapters: BookChapterInput[] = [
      { number: 1, title: "A", content: "" },
      { number: 2, title: "B", content: "Text." },
      { number: 3, title: "C", content: "Text." },
    ];
    render(<BeatSheetPanel chapters={chapters} templateType="three-act" />);

    expect(screen.getByTestId("beat-coverage-state").textContent).toContain("offen");
    const pending = screen.getByTestId("beat-status-count-pending").textContent ?? "";
    expect(pending).not.toContain(": 0");
  });

  it("leitet den Beat-Status aus dem Kapitelstatus ab", () => {
    const chapters: BookChapterInput[] = [
      { number: 1, title: "A", content: "Fertig.", status: "completed" },
      { number: 2, title: "B", content: "Text.", status: "draft" },
      { number: 3, title: "C", content: "Text.", status: "draft" },
    ];
    render(<BeatSheetPanel chapters={chapters} templateType="three-act" />);

    // Akt I (Kapitel 1, completed) → Fertig.
    expect(screen.getByTestId("beat-status-act1-setup").textContent).toBe("Fertig");
    // Akt II (Kapitel 2/3, draft) → Entwurf.
    expect(screen.getByTestId("beat-status-act2-midpoint").textContent).toBe("Entwurf");
  });

  it("zeigt alle Beats als offen, wenn keine Kapitel vorliegen", () => {
    render(<BeatSheetPanel chapters={[]} templateType="three-act" />);
    expect(screen.getByTestId("beat-status-act1-setup").textContent).toBe("Offen");
    expect(screen.getByTestId("beat-status-count-pending").textContent).toBe("Offen: 9");
    expect(screen.getByTestId("beat-coverage-state").textContent).toContain("offen");
  });

  it("setzt die Fortschrittsleiste passend zur Abdeckung", () => {
    render(<BeatSheetPanel chapters={makeChapters(3)} templateType="three-act" />);
    const bar = screen.getByTestId("beat-coverage-bar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
  });
});
