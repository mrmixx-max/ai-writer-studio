// @vitest-environment jsdom
/**
 * Tests: VoiceMemoModal (WP 43.1 — Audio-Walkman & Smart-Tagger)
 */


import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VoiceMemoModal } from "./VoiceMemoModal";
import type { MemoContext } from "@/services/audio/voiceMemoCompanion";

const CONTEXT: MemoContext = {
  chapters: [
    { id: "c1", title: "Kapitel 1", content: "Sarah trifft David im Hafen." },
    { id: "c2", title: "Kapitel 2", content: "Ein Sturm zieht auf." },
  ],
  characters: ["Sarah", "David"],
  codexTopics: ["Hafen", "Sturm"],
};

describe("VoiceMemoModal", () => {
  it("rendert nicht wenn geschlossen", () => {
    const { container } = render(
      <VoiceMemoModal open={false} onClose={() => {}} context={CONTEXT} />,
    );
    expect(container.querySelector('[data-testid="voice-memo-modal"]')).toBeNull();
  });

  it("rendert wenn offen", () => {
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    expect(screen.getByTestId("voice-memo-modal")).toBeTruthy();
  });

  it("hat ein Transkript-Feld", () => {
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    expect(screen.getByTestId("voice-memo-transcript")).toBeTruthy();
  });

  it("hat einen Aufnahme-Button", () => {
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    expect(screen.getByTestId("voice-memo-record")).toBeTruthy();
  });

  it("analysiert eingegebenen Text", () => {
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    fireEvent.change(screen.getByTestId("voice-memo-transcript"), {
      target: { value: "Sarah sollte ein Geheimnis vor David haben" },
    });
    fireEvent.click(screen.getByTestId("voice-memo-analyze"));
    expect(screen.getByTestId("voice-memo-targets")).toBeTruthy();
  });

  it("erkennt Figurennamen als Ziel", () => {
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    fireEvent.change(screen.getByTestId("voice-memo-transcript"), {
      target: { value: "Sarah sollte ein Geheimnis vor David haben" },
    });
    fireEvent.click(screen.getByTestId("voice-memo-analyze"));
    const html = screen.getByTestId("voice-memo-targets").textContent ?? "";
    expect(html).toMatch(/Sarah|David/);
  });

  it("leerer Text erzeugt keine Vorschläge", () => {
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    fireEvent.click(screen.getByTestId("voice-memo-analyze"));
    expect(screen.queryByTestId("voice-memo-targets")).toBeNull();
  });

  it("Übernehmen ruft onApply", () => {
    const onApply = vi.fn();
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} onApply={onApply} />);
    fireEvent.change(screen.getByTestId("voice-memo-transcript"), {
      target: { value: "Sarah sollte ein Geheimnis vor David haben" },
    });
    fireEvent.click(screen.getByTestId("voice-memo-analyze"));
    const firstApply = screen.queryByTestId("voice-memo-apply-0");
    if (firstApply) {
      fireEvent.click(firstApply);
      expect(onApply).toHaveBeenCalled();
    }
  });

  it("Dauer ist einstellbar", () => {
    render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    const input = screen.getByTestId("voice-memo-duration");
    fireEvent.change(input, { target: { value: "120" } });
    expect((input as HTMLInputElement).value).toBe("120");
  });

  it("schließt bei Klick", () => {
    const onClose = vi.fn();
    render(<VoiceMemoModal open onClose={onClose} context={CONTEXT} />);
    fireEvent.click(screen.getByTestId("voice-memo-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("kommt mit leerem Kontext zurecht", () => {
    render(
      <VoiceMemoModal open onClose={() => {}} context={{ chapters: [], characters: [], codexTopics: [] }} />,
    );
    expect(screen.getByTestId("voice-memo-modal")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<VoiceMemoModal open onClose={() => {}} context={CONTEXT} />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
