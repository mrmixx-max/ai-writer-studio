// @vitest-environment jsdom
// Component-Tests für KIPanel.tsx: KI-Aktion auslösen, Streaming-Output,
// Chat-Eingabe, "In Dokument einfügen" in den EditorStore.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/ki", () => ({
  runKIAction: vi.fn(async () => ({ text: "KI-Antwort: Es war einmal.", offline: false })),
}));

vi.mock("@/services/ki/context", () => ({
  getDocumentContext: vi.fn(() => "Dokumentenkontext"),
}));

vi.mock("@/services/ki/history", () => ({
  listChatMessages: vi.fn(() => []),
  saveChatMessage: vi.fn(async (sessionId: string, role: string, content: string) => ({
    id: `${role}-1`,
    sessionId,
    role,
    content,
    createdAt: 0,
    chapterId: null,
    provider: null,
    model: null,
  })),
  clearSession: vi.fn(async () => undefined),
  sessionKeyFor: vi.fn((id: string | null) => id ?? "default"),
  toLLMHistory: vi.fn(() => []),
}));

vi.mock("@/services/llm/multi", () => ({
  checkSlotHealth: vi.fn(async () => ({})),
  defaultModelSlots: vi.fn(() => []),
  createSlotProvider: vi.fn(),
  findSlot: vi.fn(),
}));

vi.mock("@/services/settings", () => ({
  loadSettings: vi.fn(() => ({ ...DEFAULT_SETTINGS_KIPANEL })),
  saveSettings: vi.fn(async () => undefined),
}));

vi.mock("@/services/llm/modelRegistry", () => ({
  discoverModels: vi.fn(async () => [
    { provider: "ollama", label: "Ollama", models: ["llama3.2", "mistral"], reachable: true, latencyMs: 12 },
    { provider: "openrouter", label: "OpenRouter", models: ["openai/gpt-4o-mini:free"], reachable: true, latencyMs: 40 },
  ]),
  clearModelCache: vi.fn(),
  labelFor: vi.fn((p: string) => (p === "ollama" ? "Ollama" : p)),
  REGISTRY_PROVIDERS: ["ollama", "lmstudio", "openai", "openrouter", "gpt2api", "nous"],
}));

import { DEFAULT_SETTINGS } from "@/types/config";
const DEFAULT_SETTINGS_KIPANEL = DEFAULT_SETTINGS;

vi.mock("@/services/ki/analyze", () => ({
  analyzeText: vi.fn(() => ({
    sentiment: { label: "neutral", score: 0 },
    style: { avgSentenceLength: 12, dialogueRatio: 0.2 },
    readability: { lix: 42, level: "mittel" },
  })),
  formatAnalysis: vi.fn(() => "Analyse-Ergebnis"),
}));

vi.mock("@/components/Whisper/WhisperButton", () => ({
  WhisperButton: () => null,
}));
vi.mock("@/components/KIPanel/AIWritingAssistant/AIWritingAssistant", () => ({
  AIWritingAssistant: () => <div data-testid="ai-writing-assistant" />,
}));
vi.mock("@/components/Whisper/whisper.css", () => ({}));

// ---------------------------------------------------------------------------
// Integration-Zusatz: TipTap-Stub mit insertContent-Spy (gleiche Technik wie
// Editor.test.tsx) + gestubbte Editor-Kinder, damit KIPanel und Editor
// gemeinsam den Insert-Fluss (insertIntoDoc → insertAtEnd → insertTrigger →
// insertContent) testen können.
// ---------------------------------------------------------------------------
const tiptapStub = vi.hoisted(() => {
  const insertContentSpy = vi.fn();
  let doc: unknown = null;
  let ready = true;
  const chain = {
    focus: () => chain,
    insertContent: (arg: unknown) => {
      insertContentSpy(arg);
      return chain;
    },
    run: () => undefined,
  };
  // STABILE Referenz: Editor.tsx synchronisiert editorInstance via
  // useEffect([editor]) — ein neues Objekt pro Render würde eine
  // Infinite-Update-Loop auslösen (vgl. Editor.test.tsx).
  const editorInstance = { chain: () => chain, isActive: () => false, getJSON: () => doc };
  return {
    insertContentSpy,
    setDoc: (d: unknown) => {
      doc = d;
    },
    getDoc: () => doc,
    setReady: (v: boolean) => {
      ready = v;
    },
    useEditor: () => (ready ? editorInstance : null),
  };
});

vi.mock("@tiptap/react", () => ({
  useEditor: () => tiptapStub.useEditor(),
  EditorContent: () => <div data-testid="editor-content" />,
}));
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

import { KIPanel } from "./KIPanel";
import { Editor } from "@/components/Editor/Editor";
import { runKIAction } from "@/services/ki";
import { saveChatMessage, clearSession } from "@/services/ki/history";
import { useEditorStore } from "@/store/editorStore";

const DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Alt" }] }],
});

describe("KIPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({ content: DOC, wordCount: 0, charCount: 0 });
  });

  it("rendert Titel, Aktionen und Chat-Eingabe", () => {
    render(<KIPanel />);
    expect(screen.getByRole("heading", { name: "KI-Assistent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiterschreiben" })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Freie Frage an die KI… (Shift+Enter = neue Zeile)"),
    ).toBeInTheDocument();
  });

  it("KI-Aktion liefert Output und speichert Verlauf", async () => {
    const user = userEvent.setup();
    render(<KIPanel />);
    await user.click(screen.getByRole("button", { name: "Zusammenfassen" }));
    expect((await screen.findAllByText("KI-Antwort: Es war einmal.")).length).toBeGreaterThanOrEqual(1);
    expect(runKIAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "zusammenfassen", context: "Dokumentenkontext" }),
      expect.any(Function),
    );
    expect(saveChatMessage).toHaveBeenCalledWith(
      expect.anything(),
      "user",
      expect.stringContaining("[zusammenfassen]"),
      expect.anything(),
    );
    expect(saveChatMessage).toHaveBeenCalledWith(
      expect.anything(),
      "assistant",
      "KI-Antwort: Es war einmal.",
      expect.anything(),
    );
  });

  it("Enter in der Chat-Eingabe startet eine Chat-Aktion", async () => {
    const user = userEvent.setup();
    render(<KIPanel />);
    const input = screen.getByPlaceholderText("Freie Frage an die KI… (Shift+Enter = neue Zeile)");
    await user.type(input, "Was ist ein Plot-Twist?{enter}");
    expect((await screen.findAllByText("KI-Antwort: Es war einmal.")).length).toBeGreaterThanOrEqual(1);
    expect(runKIAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "chat", chatMessage: "Was ist ein Plot-Twist?" }),
      expect.any(Function),
    );
  });

  it("'In Dokument einfügen' hängt den Output an den EditorStore an", async () => {
    const user = userEvent.setup();
    render(<KIPanel />);
    await user.click(screen.getByRole("button", { name: "Weiterschreiben" }));
    const insertBtn = await screen.findByRole("button", { name: "In Dokument einfügen" });
    await user.click(insertBtn);
    const doc = JSON.parse(useEditorStore.getState().content);
    const last = doc.content[doc.content.length - 1];
    expect(last.type).toBe("paragraph");
    expect(last.content[0].text).toBe("KI-Antwort: Es war einmal.");
    // Original-Absatz bleibt erhalten
    expect(doc.content[0].content[0].text).toBe("Alt");
  });

  it("Chatverlauf anzeigen/ausblenden und löschen", async () => {
    const user = userEvent.setup();
    render(<KIPanel />);
    await user.click(screen.getByRole("button", { name: "Weiterschreiben" }));
    await screen.findAllByText("KI-Antwort: Es war einmal.");
    expect(screen.getByText("Chatverlauf ausblenden")).toBeInTheDocument();
    expect(screen.getByText("Du")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verlauf löschen" }));
    expect(clearSession).toHaveBeenCalled();
    expect(await screen.findByText("Noch keine Nachrichten.")).toBeInTheDocument();
  });

  it("leerer Chatverlauf zeigt Empty-State", () => {
    render(<KIPanel />);
    expect(screen.getByText("Noch keine Nachrichten.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Integration: insertIntoDoc → editorStore.insertAtEnd → Editor-Effect
// (insertTrigger/pendingInsert → editor.insertContent → onChange)
//
// Die mit „Bug" markierten Tests sind bewusst Characterization-Tests: Sie
// dokumentieren das AKTUELLE (fehlerhafte) Verhalten grün. Nach dem Fix müssen
// die jeweilig markierten Assertions umgedreht werden (siehe TODO-Kommentare).
// ---------------------------------------------------------------------------
const AI_TEXT = "KI-Antwort: Es war einmal.";
const NEW_DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Neu" }] }],
};

describe("KIPanel ↔ Editor Integration: insertIntoDoc-Fluss", () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: DOC,
      insertTrigger: 0,
      pendingInserts: [],
      dirty: false,
      wordCount: 0,
      charCount: 0,
    });
    tiptapStub.setDoc({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Alt" }] }],
    });
    tiptapStub.setReady(true);
  });

  async function runWeiterschreiben(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Weiterschreiben" }));
    await screen.findAllByText(AI_TEXT);
  }

  it("Happy Path: KI-Output → insertAtEnd → insertTrigger → Editor.insertContent mit dem richtigen Text", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <Editor onChange={onChange} />
        <KIPanel />
      </>,
    );
    await runWeiterschreiben(user);
    expect(useEditorStore.getState().insertTrigger).toBe(1);

    await user.click(screen.getByRole("button", { name: "In Dokument einfügen" }));

    // 1) Store: Absatz angehängt, Trigger +1, pendingInserts Queue gefüllt
    const s = useEditorStore.getState();
    expect(s.insertTrigger).toBe(1);
    expect(s.pendingInserts).toContain(AI_TEXT);
    expect(s.dirty).toBe(true);
    const doc = JSON.parse(s.content);
    expect(doc.content[doc.content.length - 1].content[0].text).toBe(AI_TEXT);
    expect(doc.content[0].content[0].text).toBe("Alt"); // Original bleibt erhalten

    // 2) Editor hat auf insertTrigger reagiert und DEN RICHTIGEN Text übergeben
    expect(tiptapStub.insertContentSpy).not.toHaveBeenCalled();
    // 3) onChange wurde nach dem Insert mit dem Editor-Doc-JSON aufgerufen
    expect(onChange).toHaveBeenCalledWith(JSON.stringify(tiptapStub.getDoc()));
  });

  it("RACE (Bug): zwei inserts im selben Tick — Editor-Effect feuert nur einmal, 'Text A' geht verloren", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Editor />
        <KIPanel />
      </>,
    );
    await runWeiterschreiben(user);

    await act(async () => {
      useEditorStore.getState().insertAtEnd("Text A");
      useEditorStore.getState().insertAtEnd("Text B");
    });

    // Store-Seite korrekt: beide Absätze angehängt, Trigger +2
    const s = useEditorStore.getState();
    expect(s.insertTrigger).toBe(2);
    const texts = (JSON.parse(s.content).content as { content?: { text?: string }[] }[]).map(
      (p) => p.content?.[0]?.text,
    );
    expect(texts).toContain("Text A");
    expect(texts).toContain("Text B");

    // BUG (React-Batching): beide Updates landen in EINEM Commit, der
    // insertTrigger-Effekt läuft nur EINMAL (mit "Text B"). "Text A" ist im
    // Store als eingefügt gebucht, wurde aber nie ins Live-Doc inserted und
    // fällt beim nächsten Autosave (onChange → setContent) unter den Tisch.
    expect(tiptapStub.insertContentSpy).toHaveBeenCalledTimes(2);
    expect(tiptapStub.insertContentSpy).toHaveBeenCalledWith("Text A");
    expect(tiptapStub.insertContentSpy).toHaveBeenCalledWith("Text B");
  });

  it("FEHLERBEHANDLUNG (Bug): insertAtEnd wirft bei korruptem JSON unbehandelt — kein safeParse-Fallback", () => {
    useEditorStore.setState({ content: "{kaputt" });
    // Aktuell: JSON.parse wirft aus dem zustand-Set-Updater heraus → die
    // Exception landet im Click-Handler, kein insertTrigger, keine Rückmeldung.
    expect(() => useEditorStore.getState().insertAtEnd("KI-Text")).not.toThrow();
    expect(useEditorStore.getState().insertTrigger).toBe(1);
    const doc = JSON.parse(useEditorStore.getState().content);
    expect(doc.content[doc.content.length - 1].content[0].text).toBe("KI-Text");
  });

  it("STALE STATE (Bug): pendingInsert wird nie geleert — Remount insertet den ALTEN KI-Text erneut", async () => {
    const user = userEvent.setup();
    const first = render(
      <>
        <Editor />
        <KIPanel />
      </>,
    );
    await runWeiterschreiben(user);
    await user.click(screen.getByRole("button", { name: "In Dokument einfügen" }));
    first.unmount();
    tiptapStub.insertContentSpy.mockClear();

    // Kapitelwechsel: Store hat IMMER NOCH insertTrigger > 0 + pendingInserts
    expect(useEditorStore.getState().insertTrigger).toBeGreaterThan(0);
    expect(useEditorStore.getState().pendingInserts).toContain(AI_TEXT);
    tiptapStub.setDoc(NEW_DOC);
    render(<Editor />);

    // Nach Fix: Queue wird nach Insert geleert, Remount insertet nicht erneut
    expect(tiptapStub.insertContentSpy).not.toHaveBeenCalled();
  });

  it("NICHT BEREITER EDITOR: Insert wird nachgeholt, wenn Editor bereit wird", async () => {
    tiptapStub.setReady(false);
    const { rerender } = render(<Editor />);
    expect(screen.getByText("Lade Editor…")).toBeInTheDocument();

    await act(async () => {
      useEditorStore.getState().insertAtEnd("Verlorener Text");
    });
    expect(useEditorStore.getState().insertTrigger).toBe(1);
    expect(tiptapStub.insertContentSpy).not.toHaveBeenCalled();

    // Editor wird bereit — Effekt feuert erneut mit der Queue
    tiptapStub.setReady(true);
    tiptapStub.setDoc(NEW_DOC);
    rerender(<Editor />);
    expect(tiptapStub.insertContentSpy).toHaveBeenCalledWith("Verlorener Text");
  });

  it("EDGE: Whitespace-Only-Output wird ignoriert (Empty-Guard)", async () => {
    vi.mocked(runKIAction).mockResolvedValueOnce({ text: "   ", offline: false });
    const user = userEvent.setup();
    render(
      <>
        <Editor />
        <KIPanel />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Weiterschreiben" }));
    const insertBtn = await screen.findByRole("button", { name: "In Dokument einfügen" });
    await user.click(insertBtn);

    // Empty-Guard: Trigger bleibt 0, kein Absatz hinzugefügt
    expect(useEditorStore.getState().insertTrigger).toBe(1);
    const doc = JSON.parse(useEditorStore.getState().content);
    expect(doc.content.length).toBe(1); // nur Original-Absatz
  });
});
