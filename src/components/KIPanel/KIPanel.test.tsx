// @vitest-environment jsdom
// Component-Tests für KIPanel.tsx: KI-Aktion auslösen, Streaming-Output,
// Chat-Eingabe, "In Dokument einfügen" in den EditorStore.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

import { KIPanel } from "./KIPanel";
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
