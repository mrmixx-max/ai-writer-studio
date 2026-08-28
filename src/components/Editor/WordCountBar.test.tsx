// @vitest-environment jsdom
// Component-Tests für WordCountBar.tsx: Wort-/Zeichenzähler + Dirty-Indikator.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WordCountBar } from "./WordCountBar";
import { useEditorStore } from "@/store/editorStore";

describe("WordCountBar", () => {
  beforeEach(() => {
    useEditorStore.setState({ wordCount: 0, charCount: 0, dirty: false });
  });

  it("zeigt aktuelle Wort- und Zeichenzahl", () => {
    useEditorStore.setState({ wordCount: 1200, charCount: 7431 });
    render(<WordCountBar />);
    expect(screen.getByText("1200 Wörter")).toBeInTheDocument();
    expect(screen.getByText("7431 Zeichen")).toBeInTheDocument();
  });

  it("unterscheidet gespeichert / nicht gespeichert", () => {
    useEditorStore.setState({ dirty: true });
    const { rerender } = render(<WordCountBar />);
    expect(screen.getByText("● nicht gespeichert")).toBeInTheDocument();
    useEditorStore.setState({ dirty: false });
    rerender(<WordCountBar />);
    expect(screen.getByText("✓ gespeichert")).toBeInTheDocument();
  });
});
