// @vitest-environment jsdom
// Component-Tests: VoiceLabPanel (Sprint 20, Agent 2) — Aufnahme-Button,
// Fehlerpfad ohne Mikrofon, Record→Stop→Transkript-Flow (gemockte Engine),
// Export-Buttons, "Im Editor öffnen".
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceLabPanel } from "./VoiceLabPanel";
import type { TranscriptionResult } from "@/services/voice/voiceLab";

// Aufnahme-Funktionen sind direkt im Panel importiert (ESM-Bindings) —
// deshalb via vi.mock steuerbar machen; Rest des Moduls bleibt original.
const mocks = vi.hoisted(() => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
}));

vi.mock("@/services/voice/voiceLab", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/voice/voiceLab")>();
  return {
    ...actual,
    startRecording: (...args: unknown[]) =>
      (mocks.startRecording as (...a: unknown[]) => unknown)(...args),
    stopRecording: (...args: unknown[]) =>
      (mocks.stopRecording as (...a: unknown[]) => unknown)(...args),
  };
});

const RESULT: TranscriptionResult = {
  text: "Hallo Welt. Dies ist ein Test.",
  segments: [
    { start: 0, end: 1.5, text: "Hallo Welt." },
    { start: 1.5, end: 3, text: "Dies ist ein Test." },
  ],
  language: "de",
  duration: 3,
};

beforeEach(() => {
  mocks.startRecording.mockReset();
  mocks.stopRecording.mockReset();
  URL.createObjectURL = vi.fn(
    () => "blob:fake-audio",
  ) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
});

describe("VoiceLabPanel (statisch)", () => {
  it("rendert Aufnahme-Button, Timer, Waveform, Transkript und Exporte", () => {
    render(<VoiceLabPanel transcribe={vi.fn()} />);
    expect(screen.getByTestId("voicelab-panel")).toBeTruthy();
    expect(screen.getByTestId("voicelab-record-btn")).toBeTruthy();
    expect(screen.getByTestId("voicelab-timer").textContent).toContain("00:00");
    expect(screen.getByTestId("voicelab-waveform")).toBeTruthy();
    expect(screen.getByTestId("voicelab-transcript")).toBeTruthy();
    expect(screen.getByTestId("voicelab-language")).toBeTruthy();
    expect(screen.getByTestId("voicelab-export-txt")).toBeTruthy();
    expect(screen.getByTestId("voicelab-export-srt")).toBeTruthy();
    expect(screen.getByTestId("voicelab-export-vtt")).toBeTruthy();
    expect(screen.getByTestId("voicelab-open-in-editor")).toBeTruthy();
  });

  it("Sprachauswahl bietet DE und EN", () => {
    render(<VoiceLabPanel transcribe={vi.fn()} />);
    const select = screen.getByTestId("voicelab-language") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "de",
      "en",
    ]);
  });

  it("Export-Buttons sind ohne Transkript deaktiviert", () => {
    render(<VoiceLabPanel transcribe={vi.fn()} />);
    expect(
      (screen.getByTestId("voicelab-export-txt") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("voicelab-open-in-editor") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("zeigt einen Fehler, wenn keine Aufnahme möglich ist", async () => {
    mocks.startRecording.mockRejectedValue(
      new Error("Mikrofon-Aufnahme wird nicht unterstützt (kein getUserMedia)."),
    );
    const user = userEvent.setup();
    render(<VoiceLabPanel transcribe={vi.fn()} />);
    await user.click(screen.getByTestId("voicelab-record-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("voicelab-error")).toBeTruthy();
    });
  });
});

describe("VoiceLabPanel (Record → Stop → Transkript)", () => {
  it("transkribiert nach Stop und füllt Transkript + Editor-Callback", async () => {
    mocks.startRecording.mockResolvedValue({
      state: "recording",
      mimeType: "audio/webm",
      stop: vi.fn(),
    });
    mocks.stopRecording.mockResolvedValue(new Blob(["audio"]));
    const transcribe = vi.fn(async () => RESULT);
    const onOpenInEditor = vi.fn();

    const user = userEvent.setup();
    render(
      <VoiceLabPanel transcribe={transcribe} onOpenInEditor={onOpenInEditor} />,
    );

    await user.click(screen.getByTestId("voicelab-record-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("voicelab-stop-btn")).toBeTruthy();
    });
    await user.click(screen.getByTestId("voicelab-stop-btn"));

    await waitFor(() => {
      expect(transcribe).toHaveBeenCalledOnce();
    });
    expect(screen.getByTestId("voicelab-transcript").textContent).toContain(
      "Hallo Welt.",
    );
    expect(
      (screen.getByTestId("voicelab-export-srt") as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    await user.click(screen.getByTestId("voicelab-open-in-editor"));
    expect(onOpenInEditor).toHaveBeenCalledWith(RESULT.text);
  });
});
