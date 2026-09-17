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
  // Mutable Selektion: Tests schalten zwischen leer/nicht-leer um.
  const sel = { from: 0, to: 0, empty: true };
  // Programmierbares nodesBetween: null = keine Textblöcke (Fallback-Pfad).
  let nbImpl: ((from: number, to: number, cb: (node: unknown, pos: number) => boolean) => void) | null = null;
  const chainStub: Record<string, unknown> = {};
  for (const m of [
    "focus",
    "toggleBold",
    "toggleItalic",
    "toggleHeading",
    "setHeading",
    "setTextSelection",
    "toggleBulletList",
    "toggleOrderedList",
    "toggleBlockquote",
    "detectCharacterTags",
  ]) {
    chainStub[m] = vi.fn(() => chainStub);
  }
  chainStub["run"] = runSpy;
  const editorStub = {
    chain: () => chainStub,
    isActive: () => false,
    state: {
      get selection() {
        return sel;
      },
      doc: {
        resolve: () => ({
          start: () => 0,
          end: () => 10,
          depth: 0,
        }),
        nodesBetween: (from: number, to: number, cb: (node: unknown, pos: number) => boolean) =>
          nbImpl?.(from, to, cb),
      },
    },
    getJSON: () => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hallo Welt foo" }] }],
    }),
  };
  return {
    runSpy,
    chainStub: chainStub as {
      setHeading: ReturnType<typeof vi.fn>;
      setTextSelection: ReturnType<typeof vi.fn>;
      toggleHeading: ReturnType<typeof vi.fn>;
    },
    editorStub,
    setSelection: (s: { from: number; to: number; empty: boolean }) => {
      sel.from = s.from;
      sel.to = s.to;
      sel.empty = s.empty;
    },
    setNodesBetween: (
      fn: ((from: number, to: number, cb: (node: unknown, pos: number) => boolean) => void) | null,
    ) => {
      nbImpl = fn;
    },
    clearChainSpies: () => {
      for (const v of Object.values(chainStub)) {
        if (typeof v === "function" && "mockClear" in v) (v as ReturnType<typeof vi.fn>).mockClear();
      }
    },
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
    h.clearChainSpies();
    h.setSelection({ from: 0, to: 0, empty: true });
    h.setNodesBetween(null);
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

  it("H1 mit leerer Selektion nutzt setHeading (kein toggle-Übergriff)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "H1" }));
    // setHeading statt toggleHeading: Begrenzung auf die Cursor-Zeile.
    expect(h.chainStub.setHeading).toHaveBeenCalledWith({ level: 1 });
    expect(h.chainStub.setTextSelection).toHaveBeenCalledWith({ from: 0, to: 10 });
    expect(h.chainStub.toggleHeading).not.toHaveBeenCalled();
    expect(h.runSpy).toHaveBeenCalled();
  });

  it("H2/H3 mit leerer Selektion nutzen setHeading mit passendem Level", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "H2" }));
    expect(h.chainStub.setHeading).toHaveBeenCalledWith({ level: 2 });
    expect(h.chainStub.toggleHeading).not.toHaveBeenCalled();
    h.clearChainSpies();
    await user.click(screen.getByRole("button", { name: "H3" }));
    expect(h.chainStub.setHeading).toHaveBeenCalledWith({ level: 3 });
    expect(h.chainStub.toggleHeading).not.toHaveBeenCalled();
  });

  it("H1 mit Markierung stellt jeden getroffenen Block einzeln um", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.setSelection({ from: 5, to: 50, empty: false });
    // Zwei Textblöcke in der Auswahl: pos 10 (Größe 20), pos 32 (Größe 25).
    h.setNodesBetween((_from, _to, cb) => {
      cb({ isTextblock: true, nodeSize: 20 }, 10);
      cb({ isTextblock: true, nodeSize: 25 }, 32);
      return true;
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "H1" }));
    // Block 1: start=max(10,5)=10, end=min(10+20-2,50)=28.
    // Block 2: start=max(32,5)=32, end=min(32+25-2,50)=50.
    expect(h.chainStub.setTextSelection).toHaveBeenCalledWith({ from: 10, to: 28 });
    expect(h.chainStub.setTextSelection).toHaveBeenCalledWith({ from: 32, to: 50 });
    expect(h.chainStub.setHeading).toHaveBeenCalledWith({ level: 1 });
    expect(h.chainStub.toggleHeading).not.toHaveBeenCalled();
    expect(h.runSpy).toHaveBeenCalled();
  });

  it("H2 mit Markierung ohne Textblöcke fällt auf toggleHeading zurück", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.setSelection({ from: 5, to: 50, empty: false });
    // Keine Textblöcke (z.B. nur Medienknoten) → ranges leer → Fallback.
    h.setNodesBetween((_from, _to, cb) => {
      cb({ isTextblock: false, nodeSize: 10 }, 10);
      return true;
    });
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "H2" }));
    expect(h.chainStub.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    expect(h.chainStub.setHeading).not.toHaveBeenCalled();
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
