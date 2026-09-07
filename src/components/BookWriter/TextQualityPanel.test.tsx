// @vitest-environment jsdom
// Component-Tests: TextQualityPanel (Sprint 19) — Container-Logik:
// ohne Kapitel mit Text -> Hinweis; mit Kapitel -> Dashboard + Lektorat.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextQualityPanel } from "./TextQualityPanel";
import { useProjectStore } from "@/store/projectStore";

function seedChapter(content: string) {
  useProjectStore.setState({
    chapters: [{ id: "ch1", projectId: "p1", title: "Kapitel 1", content, order: 0 } as never],
    activeProjectId: "p1",
    activeChapterId: "ch1",
  } as never);
}

beforeEach(() => {
  useProjectStore.setState({ chapters: [], activeProjectId: null, activeChapterId: null } as never);
});

describe("TextQualityPanel", () => {
  it("zeigt einen Hinweis, wenn kein Kapiteltext vorhanden ist", () => {
    render(<TextQualityPanel projectId={null} chapterId={null} />);
    expect(screen.getByTestId("textquality-empty")).toBeTruthy();
  });

  it("rendert Dashboard + Lektorat bei vorhandenem Kapiteltext", () => {
    seedChapter(
      "Der alte Mann ging langsam durch den dunklen Wald. Er sagte: \"Komm mit mir.\" " +
        "Die Bäume rauschten leise im Wind. Plötzlich blieb er stehen und lauschte.",
    );
    render(<TextQualityPanel projectId="p1" chapterId="ch1" />);
    expect(screen.getByTestId("textquality-panel")).toBeTruthy();
    expect(screen.getByTestId("textquality-rewrite-hint")).toBeTruthy();
  });

  it("zeigt Hinweis bei leerem Kapiteltext", () => {
    seedChapter("   ");
    render(<TextQualityPanel projectId="p1" chapterId="ch1" />);
    expect(screen.getByTestId("textquality-empty")).toBeTruthy();
  });
});
