// @vitest-environment jsdom
// Tests für die Live-Konsistenz-Anzeige (WP3.1).
//
// Kernaussage: Die Anzeige ist ein HINWEIS, keine Blockade. Sie erscheint
// diskret, lässt sich zuklappen und stört das Schreiben nicht.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveConsistencyPanel, LIVE_CHECK_DEBOUNCE_MS } from "./LiveConsistencyPanel";
import { useProjectStore } from "@/store/projectStore";

const listCharactersMock = vi.fn();

vi.mock("@/services/characters/characters", () => ({
  listCharacters: (...a: unknown[]) => listCharactersMock(...a),
}));

function makeChar(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    projectId: "p1",
    name: "Anna",
    aliases: [],
    age: "34",
    role: "Protagonistin",
    traits: "blaue Augen",
    notes: "",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  listCharactersMock.mockReset();
  listCharactersMock.mockReturnValue([makeChar()]);
  useProjectStore.setState({ activeProjectId: "p1" });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Wartet das Prüfintervall ab. */
async function advanceCheck() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LIVE_CHECK_DEBOUNCE_MS + 100);
  });
}

describe("LiveConsistencyPanel", () => {
  it("zeigt nichts, wenn kein Widerspruch vorliegt", async () => {
    const { container } = render(
      <LiveConsistencyPanel text="Anna blickte auf. Ihre blauen Augen musterten den Raum." />,
    );
    await advanceCheck();
    expect(container.querySelector(".live-consistency")).toBeNull();
  });

  it("zeigt einen Hinweis bei abweichender Augenfarbe", async () => {
    render(<LiveConsistencyPanel text="Anna blickte auf. Ihre braunen Augen musterten den Raum." />);
    await advanceCheck();
    expect(screen.getByText("1 Hinweis")).toBeInTheDocument();
    expect(screen.getByText("Anna")).toBeInTheDocument();
  });

  it("nennt Erwartung und Fund", async () => {
    render(<LiveConsistencyPanel text="Anna blickte auf. Ihre braunen Augen musterten den Raum." />);
    await advanceCheck();
    expect(screen.getByText(/blau laut Figurendaten/)).toBeInTheDocument();
    expect(screen.getByText(/braun.*im Text/)).toBeInTheDocument();
  });

  it("zeigt die Belegstelle", async () => {
    render(<LiveConsistencyPanel text="Anna blickte auf. Ihre braunen Augen musterten den Raum." />);
    await advanceCheck();
    expect(screen.getByText(/braunen Augen/)).toBeInTheDocument();
  });

  it("lässt sich zuklappen", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LiveConsistencyPanel text="Anna blickte auf. Ihre braunen Augen musterten den Raum." />);
    await advanceCheck();

    const toggle = screen.getByRole("button", { expanded: true });
    await user.click(toggle);
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    // Der Hinweis bleibt sichtbar, nur die Liste ist zu.
    expect(screen.getByText("1 Hinweis")).toBeInTheDocument();
  });

  it("zählt mehrere Hinweise", async () => {
    // Die Figur muss BEIDE Merkmale nennen, sonst ist die Haarfarbe eine
    // Lücke in den Daten und kein Widerspruch.
    listCharactersMock.mockReturnValue([makeChar({ traits: "blaue Augen, blondes Haar" })]);
    render(<LiveConsistencyPanel text="Anna. Ihre braunen Augen und ihr schwarzes Haar." />);
    await advanceCheck();
    expect(screen.getByText("2 Hinweise")).toBeInTheDocument();
  });

  it("zeigt nichts bei leerem Text", async () => {
    const { container } = render(<LiveConsistencyPanel text="   " />);
    await advanceCheck();
    expect(container.querySelector(".live-consistency")).toBeNull();
  });

  it("zeigt nichts ohne aktives Projekt", async () => {
    useProjectStore.setState({ activeProjectId: null });
    const { container } = render(
      <LiveConsistencyPanel text="Anna. Ihre braunen Augen." />,
    );
    await advanceCheck();
    expect(container.querySelector(".live-consistency")).toBeNull();
  });

  it("zeigt nichts, wenn die Prüfung abgeschaltet ist", async () => {
    const { container } = render(
      <LiveConsistencyPanel text="Anna. Ihre braunen Augen." enabled={false} />,
    );
    await advanceCheck();
    expect(container.querySelector(".live-consistency")).toBeNull();
  });

  it("stürzt bei einem Fehler in der Prüfung nicht ab", async () => {
    // Ein fehlgeschlagener Wächter darf das Schreiben nicht stören.
    listCharactersMock.mockImplementation(() => {
      throw new Error("DB weg");
    });
    const { container } = render(<LiveConsistencyPanel text="Anna. Ihre braunen Augen." />);
    await advanceCheck();
    expect(container.querySelector(".live-consistency")).toBeNull();
  });

  it("prüft nicht bei jedem Tastendruck, sondern entprellt", async () => {
    const { rerender } = render(<LiveConsistencyPanel text="Anna. Ihre braunen Augen." />);
    // Drei schnelle Änderungen vor Ablauf des Intervalls.
    rerender(<LiveConsistencyPanel text="Anna. Ihre braunen Augen. Und noch etwas." />);
    rerender(<LiveConsistencyPanel text="Anna. Ihre braunen Augen. Und noch mehr Text." />);
    await advanceCheck();
    // Nur eine Prüfung nach dem letzten Stand.
    expect(listCharactersMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
