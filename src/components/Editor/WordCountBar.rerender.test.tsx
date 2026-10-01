// @vitest-environment jsdom
// Test: Re-Render-Verhalten der Editor-Store-Abonnenten (WP2.1).
//
// Kernaussage: Ein selektorloser `useEditorStore()`-Aufruf rendert bei JEDER
// Store-Änderung neu. Für WordCountBar und PromptGenerator war das ein
// unnötiger Re-Render pro Wortzähler-Tick — bei einem Panel mit Ergebnisliste
// ist das spürbar.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Profiler } from "react";
import { useEditorStore } from "@/store/editorStore";
import { WordCountBar } from "./WordCountBar";

/**
 * Zählt echte Render-Vorgänge von `WordCountBar`.
 *
 * `React.Profiler.onRender` feuert bei JEDEM Render der enthaltenen Kinder —
 * das ist die einzige verlässliche Messung. Ein DOM-Vergleich taugt nicht
 * (bei unnötigem Re-Render bleibt das DOM identisch), und ein Spy in einer
 * Hülle verfehlt den Effekt (die Hülle rendert nicht mit).
 */
function renderAndCount() {
  const onRender = vi.fn();
  const utils = render(
    <Profiler id="wcb" onRender={onRender}>
      <WordCountBar />
    </Profiler>,
  );
  return { onRender, ...utils };
}

beforeEach(() => {
  useEditorStore.setState({
    wordCount: 0,
    charCount: 0,
    dirty: false,
    content: "{}",
    pendingInserts: [],
    insertTrigger: 0,
  });
});

describe("WordCountBar — Inhalt", () => {
  it("zeigt Wort-, Zeichenzahl und Speicherstatus", () => {
    useEditorStore.setState({ wordCount: 42, charCount: 250, dirty: false });
    const { container } = render(<WordCountBar />);
    expect(container.textContent).toContain("42 Wörter");
    expect(container.textContent).toContain("250 Zeichen");
    expect(container.textContent).toContain("gespeichert");
  });

  it("zeigt den Ungespeichert-Hinweis bei dirty", () => {
    useEditorStore.setState({ dirty: true });
    const { container } = render(<WordCountBar />);
    expect(container.textContent).toContain("nicht gespeichert");
  });
});

describe("WordCountBar — Re-Render-Verhalten", () => {
  it("rendert NICHT neu, wenn sich nur der content ändert", () => {
    // Genau der Fall, der vorher einen Re-Render auslöste: Der Autosave
    // schreibt `content`, die Leiste zeigt ihn aber nicht an.
    const { onRender } = renderAndCount();
    const before = onRender.mock.calls.length;

    act(() => {
      useEditorStore.setState({ content: JSON.stringify({ type: "doc", content: [] }) });
    });

    expect(onRender.mock.calls.length).toBe(before);
  });

  it("rendert NICHT neu bei einer Änderung an pendingInserts", () => {
    const { onRender } = renderAndCount();
    const before = onRender.mock.calls.length;

    act(() => {
      useEditorStore.setState({ pendingInserts: ["etwas"] });
    });

    expect(onRender.mock.calls.length).toBe(before);
  });

  it("rendert NICHT neu, wenn sich nur insertTrigger ändert", () => {
    const { onRender } = renderAndCount();
    const before = onRender.mock.calls.length;

    act(() => {
      useEditorStore.setState({ insertTrigger: 7 });
    });

    expect(onRender.mock.calls.length).toBe(before);
  });

  it("rendert neu, wenn sich die Wortzahl ändert", () => {
    const { onRender, container } = renderAndCount();
    const before = onRender.mock.calls.length;

    act(() => {
      useEditorStore.setState({ wordCount: 99 });
    });

    expect(onRender.mock.calls.length).toBeGreaterThan(before);
    expect(container.textContent).toContain("99 Wörter");
  });
});
