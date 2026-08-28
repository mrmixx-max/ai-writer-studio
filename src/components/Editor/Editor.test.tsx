// @vitest-environment jsdom
// Component-Tests für Editor.tsx: Toolbar, Texteingabe (onUpdate → Autosave),
// entprellte Wort-/Zeichenzählung, safeParse-Fallback bei kaputtem JSON.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// TipTap mocken: useEditor liefert einen steuerbaren Stub, dessen onUpdate-
// Callback wir von außen feuern können. EditorContent rendert nur ein Div.
const h = vi.hoisted(() => {
  let onUpdateCb: ((e: { editor: unknown }) => void) | null = null;
  const runSpy = vi.fn();
  const chainStub = {
    focus: () => chainStub,
    toggleBold: () => chainStub,
    toggleItalic: () => chainStub,
    toggleHeading: () => chainStub,
    toggleBulletList: () => chainStub,
    toggleOrderedList: () => chainStub,
    toggleBlockquote: () => chainStub,
    detectCharacterTags: () => chainStub,
    run: runSpy,
  };
  const editorStub = {
    chain: () => chainStub,
    isActive: () => false,
    getJSON: () => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hallo Welt foo" }] }],
    }),
  };
  return {
    runSpy,
    chainStub,
    editorStub,
    // Getter: liest die aktuelle Closure-Variable (kein kopierter Initialwert)
    get onUpdateCb() { return onUpdateCb; },
    setOnUpdate(cb: (e: { editor: unknown }) => void) { onUpdateCb = cb; },
    fireUpdate(e: { editor: unknown }) { onUpdateCb?.(e); },
  };
});

vi.mock("@tiptap/react", () => ({
  useEditor: (opts: { onUpdate: (e: { editor: unknown }) => void }) => {
    h.setOnUpdate(opts.onUpdate);
    return h.editorStub;
  },
  EditorContent: () => <div data-testid="editor-content" />,
}));

// heavy Nebeneffekt-Kinder stubben
vi.mock("@/components/Editor/extensions", () => ({
  CharacterTagExtension: { configure: () => ({}) },
  SceneMarkerExtension: {},
  ChapterOutlineExtension: {},
  ChapterOutlinePanel: () => null,
  CharacterTooltip: () => null,
}));
vi.mock("@/components/Collaboration", () => ({
  CommentMark: {},
  TcInsertMark: {},
  TcDeleteMark: {},
  TrackChangesExtension: {},
  CollaborationPanel: () => null,
}));
vi.mock("@/components/Editor/GitPanel", () => ({ GitPanel: () => null }));

import { Editor } from "./Editor";
import { useEditorStore } from "@/store/editorStore";
import { tiptapToText, countChars } from "@/services/editor/count";

describe("Editor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useEditorStore.setState({ wordCount: 0, charCount: 0 });
    h.runSpy.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rendert Editor-Shell mit Toolbar und Inhalt (kein Ladezustand)", () => {
    render(<Editor />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    expect(screen.getByTitle("Charakter-Tags erkennen (@Name)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "B" })).toBeInTheDocument();
  });

  it("liefert bei kaputtem initialContent keinen Crash (safeParse-Fallback)", () => {
    render(<Editor initialContent="{kaputt" />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("Toolbar-Button führt die Editor-Chain aus (toggleBold)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "B" }));
    expect(h.runSpy).toHaveBeenCalled();
  });

  it("aktualisiert Wort-/Zeichenzähler entprellt nach Texteingabe (300 ms)", async () => {
    render(<Editor />);
    // onUpdate des echten Editors simulieren
    await act(async () => {
      h.fireUpdate({ editor: h.editorStub });
      await vi.advanceTimersByTimeAsync(300);
    });
    const s = useEditorStore.getState();
    expect(s.wordCount).toBe(3);
    expect(s.charCount).toBe(countChars(tiptapToText(h.editorStub.getJSON())));
  });

  it("ruft onChange nach Autosave-Delay (5 s) mit JSON auf", async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    await act(async () => {
      h.fireUpdate({ editor: h.editorStub });
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const json = JSON.parse(onChange.mock.calls[0][0]);
    expect(json.type).toBe("doc");
  });

  it("Wortzählung ist entprellt: mehrere Updates zählen nur einmal", async () => {
    render(<Editor />);
    await act(async () => {
      h.fireUpdate({ editor: h.editorStub });
      h.fireUpdate({ editor: h.editorStub });
      h.fireUpdate({ editor: h.editorStub });
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(useEditorStore.getState().wordCount).toBe(3);
  });
});
