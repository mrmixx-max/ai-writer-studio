// @vitest-environment jsdom
// Component-Tests: KIPanel busy-Recovery (Sprint 19) — Senden-Button darf nach
// einem Fehler in der Action-Handling-Kette nicht dauerhaft disabled bleiben.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KIPanel } from "./KIPanel";

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
