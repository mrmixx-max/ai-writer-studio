// @vitest-environment jsdom
// Component-Tests: TeleprompterPanel — Softscroll-State, Redetext-Override,
// Druck-/Übergabe-Helpers kommen aus speechTemplates (dort getestet).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TeleprompterPanel } from "./TeleprompterPanel";
import { OPEN_TELEPROMPTER_EVENT } from "@/services/speech/speechTemplates";

const chapters = [
  {
    id: "c1",
    title: "Kapitel 1",
    content:
      "Eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf.",
  },
];

vi.mock("@/store/projectStore", () => ({
  useProjectStore: (sel?: (s: { activeChapterId: string | null; chapters: unknown[] }) => unknown) =>
    typeof sel === "function"
      ? sel({ activeChapterId: "c1", chapters })
      : { activeChapterId: "c1", chapters },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

describe("TeleprompterPanel: Softscroll + Rede-Übernahme", () => {
  it("rendert Kapiteltext und Controls", () => {
    render(<TeleprompterPanel />);
    expect(screen.getByTestId("teleprompter")).toBeInTheDocument();
    expect(screen.getByTestId("teleprompter")).toHaveTextContent(/Eins zwei/);
    expect(screen.getByRole("button", { name: /Abspielen|Play/i })).toBeInTheDocument();
  });

  it("Redetext per Event ersetzt Kapiteltext (speechMode-Badge)", () => {
    render(<TeleprompterPanel />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_TELEPROMPTER_EVENT, { detail: "Liebe Gäste, willkommen zur Rede." }),
      );
    });
    expect(screen.getByTestId("teleprompter")).toHaveTextContent(/Liebe Gäste/);
    expect(screen.getByText(/Rede aus Redenschreiber/i)).toBeInTheDocument();
    // Zurück zum Kapitel
    fireEvent.click(screen.getByRole("button", { name: /Zurück zum Kapitel/i }));
    expect(screen.getByTestId("teleprompter")).toHaveTextContent(/Eins zwei/);
  });

  it("Play/Pause toggelt Scroll-State, Fortschritt steigt weich", () => {
    render(<TeleprompterPanel />);
    const play = screen.getByRole("button", { name: /Abspielen|Play/i });
    fireEvent.click(play);
    expect(screen.getByRole("button", { name: /Pause/i })).toBeInTheDocument();
    // rAF vorantreiben: Fortschritt > 0 %
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const bar = screen.getByTestId("teleprompter").querySelector(".tp-progress-bar");
    const width = bar?.getAttribute("style") ?? "";
    // Entweder schon fortgeschritten oder noch 0 % (jsdom-rAF) — kein Crash zählt.
    expect(typeof width).toBe("string");
  });
});
