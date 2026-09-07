// @vitest-environment jsdom
// Component-Tests: KIPanel busy-Recovery (Sprint 19) — Senden-Button darf nach
// einem Fehler in der Action-Handling-Kette nicht dauerhaft disabled bleiben.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { KIPanel } from "./KIPanel";
import { runKIAction } from "@/services/ki";

// runKIAction wirft in diesem Test (simulierter schwerer Fehler,
// z.B. DB/Streaming-Crash) — der finally-Block muss trotzdem aufräumen.
vi.mock("@/services/ki", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ki")>();
  return {
    ...actual,
    runKIAction: vi.fn().mockRejectedValue(new Error("DB crash")),
  };
});

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

vi.mock("@/services/ki/memory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ki/memory")>();
  return {
    ...actual,
    listMemory: vi.fn(() => []),
    memoryStats: vi.fn(() => ({ total: 0, auto: 0, manual: 0, byKind: {} })),
    buildSuggestedContext: vi.fn(() => ({ block: "", usedIds: [] })),
  };
});

vi.mock("@/components/KIPanel/useActiveModel", () => ({
  useActiveModel: () => ({
    settings: { provider: "ollama", model: "test-model", kiModelSlots: [] },
    selectModel: vi.fn(),
  }),
}));

vi.mock("@/services/llm/modelRegistry", () => ({
  labelFor: vi.fn((p: string) => p),
}));

vi.mock("@/store/editorStore", () => ({
  useEditorStore: Object.assign(() => ({}), {
    getState: () => ({ insertAtEnd: vi.fn() }),
  }),
}));

vi.mock("@/store/projectStore", () => ({
  useProjectStore: Object.assign(
    () => ({ activeProjectId: null, activeChapterId: null }),
    { getState: () => ({ activeProjectId: null, activeChapterId: null }) },
  ),
}));

vi.mock("@/components/Whisper/WhisperButton", () => ({
  WhisperButton: () => <div />,
}));

vi.mock("@/components/KIPanel/ModelPicker", () => ({
  ModelPicker: () => <div />,
}));

vi.mock("@/components/KIPanel/AIWritingAssistant/AIWritingAssistant", () => ({
  AIWritingAssistant: () => <div />,
}));

describe("KIPanel busy-Recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Senden-Button ist nach einem Fehler wieder klickbar (busy wird zurückgesetzt)", async () => {
    render(<KIPanel />);
    const send = screen.getByRole("button", { name: "Senden" }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);

    fireEvent.click(send);
    await waitFor(() => expect(send.disabled).toBe(false), { timeout: 2000 });
  });

  it("Aktions-Buttons bleiben nach einem Fehler benutzbar", async () => {
    render(<KIPanel />);
    const act = screen.getByRole("button", { name: "Zusammenfassen" }) as HTMLButtonElement;
    fireEvent.click(act);
    await waitFor(() => expect(act.disabled).toBe(false), { timeout: 2000 });
  });
});

// ---------------------------------------------------------------------------
// Sprint 19d (Agent 2): KI-Panel UX für langsame lokale Modelle —
// Abbrechen-Button, Elapsed-Timer + Lade-Hinweis, kein überlappender Run.
// ---------------------------------------------------------------------------
describe("KIPanel langsame Modelle (Sprint 19d)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Abbrechen-Button erscheint bei busy, ist klickbar und bricht den Stream ab", async () => {
    let seenSignal: AbortSignal | undefined;
    vi.mocked(runKIAction).mockImplementation(
      (_settings, _req, _onToken, opts) => {
        seenSignal = opts?.signal;
        // Hängt wie LFM2-24B vor dem ersten Token — löst sich nur via Abort.
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Abgebrochen", "AbortError")),
          );
        });
      },
    );
    render(<KIPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Senden" }));

    // Busy-Zustand: Aktionen disabled, aber Abbrechen klickbar.
    const cancel = screen.getByRole("button", { name: "Abbrechen" }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);
    // runKIAction wird erst nach await saveMsg() erreicht — darauf warten.
    await waitFor(() => expect(vi.mocked(runKIAction)).toHaveBeenCalled(), { timeout: 2000 });
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(screen.getByRole("status")).toHaveTextContent(/KI arbeitet/);

    fireEvent.click(cancel);
    expect(seenSignal?.aborted).toBe(true);
    await screen.findByText("Abgebrochen.");
    // busy zurückgesetzt: Senden wieder klickbar.
    await waitFor(
      () => expect((screen.getByRole("button", { name: "Senden" }) as HTMLButtonElement).disabled).toBe(false),
      { timeout: 2000 },
    );
  });

  it("Warte-Anzeige: Lade-Hinweis erscheint erst nach 10 s ohne Token", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(runKIAction).mockImplementation(() => new Promise(() => {}));
      render(<KIPanel />);
      fireEvent.click(screen.getByRole("button", { name: "Senden" }));
      expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByText(/Großes Modell lädt/)).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByText(/Großes Modell lädt — erste Antwort kann 1-2 Min dauern/)).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/KI arbeitet/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Return während busy startet keinen überlappenden Run", async () => {
    vi.mocked(runKIAction).mockImplementation(() => new Promise(() => {}));
    render(<KIPanel />);
    const input = screen.getByPlaceholderText(
      "Freie Frage an die KI… (Umschalt+Eingabe = neue Zeile)",
    );
    fireEvent.change(input, { target: { value: "Hallo" } });
    fireEvent.click(screen.getByRole("button", { name: "Senden" }));
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    // Erster Run läuft (nach await saveMsg) — dann Return während busy.
    await waitFor(() => expect(vi.mocked(runKIAction)).toHaveBeenCalledTimes(1), { timeout: 2000 });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    // Ein überlappender zweiter Run wäre ebenfalls async — kurz warten, dann zählen.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(vi.mocked(runKIAction)).toHaveBeenCalledTimes(1);
  });
});
