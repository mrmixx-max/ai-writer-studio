// @vitest-environment jsdom
// Component-Tests: BookWriter-Dashboard (Sprint 6) — Tab-Inhalt, Live-Fortschritt
// via Polling, Steuerung, und App-Start-Job-Recovery-Dialog. DB/CLI werden gemockt.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/services/cli/jobRecovery", () => ({
  findInterruptedJobs: vi.fn(() => []),
}));

vi.mock("@/services/bookwriter/jobs", () => ({
  setBookJobStatus: vi.fn(async () => undefined),
  deleteBookJob: vi.fn(async () => undefined),
}));

// openProject liest Projekte/Kapitel aus der DB — im jsdom gemockt.
vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => [
    { id: "p1", name: "KI verstehen", createdAt: 0, updatedAt: 0 },
  ] as never),
  listChapters: vi.fn(() => [] as never),
  getChapter: vi.fn(() => null),
  getChapterDecrypted: vi.fn(async () => null),
  createProject: vi.fn(async (name: string) => ({ id: "p-new", name, createdAt: 0, updatedAt: 0 })),
  createChapter: vi.fn(async (pid: string, title: string) => ({ id: "c-new", title, content: "{}", projectId: pid, orderIndex: 0, createdAt: 0, updatedAt: 0 })),
  renameProject: vi.fn(async () => undefined),
  renameChapter: vi.fn(async () => undefined),
  deleteProject: vi.fn(async () => undefined),
  deleteChapter: vi.fn(async () => undefined),
  updateChapter: vi.fn(async () => undefined),
}));

import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BookWriterDashboardPanel,
  BookWriterRecoveryDialog,
  OPEN_BOOKWRITER_MODE_EVENT,
} from "./BookWriterDashboard";
import { findInterruptedJobs } from "@/services/cli/jobRecovery";
import { deleteBookJob, setBookJobStatus } from "@/services/bookwriter/jobs";
import { useProjectStore } from "@/store/projectStore";

// Typisierter Zugriff auf den vi.fn()-Mock (findInterruptedJobs selbst
// ist laut Modul-Typ keine Mock-Funktion — der Mock kommt aus vi.mock()).
const mockFindInterrupted = findInterruptedJobs as unknown as ReturnType<typeof vi.fn>;

import type { InterruptedJobInfo } from "@/services/cli/jobRecovery";

function makeInfo(overrides: Partial<Record<string, unknown>> = {}): InterruptedJobInfo {
  return {
    jobId: "bwj_a",
    job: {
      id: "bwj_a", projectId: "p1", config: {}, outline: null,
      status: "running", currentChapter: 5, error: null, createdAt: 0, updatedAt: Date.now() - 1000,
    },
    projectId: "p1",
    status: "running",
    currentChapter: 5,
    projectTitle: "KI verstehen",
    resumeAtChapter: 6,
    totalChapters: 8,
    updatedAt: Date.now() - 1000,
    ...overrides,
  } as InterruptedJobInfo;
}

beforeEach(() => {
  vi.clearAllMocks();
  (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([]);
  useProjectStore.setState({
    activeProjectId: null,
    projects: [{ id: "p1", name: "KI verstehen", createdAt: 0, updatedAt: 0 }],
    chapters: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BookWriterDashboardPanel — Dashboard-Anzeige", () => {
  it("zeigt Kopf und Hinweis, wenn keine Läufe aktiv sind", () => {
    render(<BookWriterDashboardPanel />);
    expect(screen.getByTestId("bw-dash")).toBeInTheDocument();
    expect(screen.getByTestId("bw-dash-empty")).toBeInTheDocument();
  });

  it("listet aktive Läufe mit Titel, Fortschritt in Prozent und Kapitelzähler", () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([
      makeInfo(),
      makeInfo({ jobId: "bwj_b", job: { id: "bwj_b", projectId: "p1", config: {}, outline: null, status: "interrupted", currentChapter: 2, error: null, createdAt: 0, updatedAt: Date.now() - 60_000 } as never, projectTitle: "Thriller im Nebel", status: "interrupted", currentChapter: 2, totalChapters: 10, updatedAt: Date.now() - 60_000 }),
    ]);
    render(<BookWriterDashboardPanel />);
    expect(screen.getByTestId("bw-dash-row-bwj_a")).toHaveTextContent("KI verstehen");
    expect(screen.getByTestId("bw-dash-row-bwj_a")).toHaveTextContent("63 %");
    expect(screen.getByTestId("bw-dash-row-bwj_a")).toHaveTextContent("Kapitel 5 / 8");
    expect(screen.getByTestId("bw-dash-row-bwj_b")).toHaveTextContent("Thriller im Nebel");
    expect(screen.getByTestId("bw-dash-row-bwj_b")).toHaveTextContent("20 %");
  });

  it("markiert einen running-Job ohne Fortschritt als 'Stillstand' (stalled)", () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([
      makeInfo({
        status: "running",
        job: { id: "bwj_a", projectId: "p1", config: {}, outline: null, status: "running", currentChapter: 5, error: null, createdAt: 0, updatedAt: Date.now() - 600_000 } as never,
        updatedAt: Date.now() - 600_000,
      }),
    ]);
    render(<BookWriterDashboardPanel />);
    expect(screen.getByTestId("bw-dash-row-bwj_a")).toHaveTextContent("Stillstand");
  });
});

describe("BookWriterDashboardPanel — Live-Fortschritt (Polling)", () => {
  it("fragt den Job-Store erneut ab, sobald das Poll-Intervall verstreicht", () => {
    vi.useFakeTimers();
    render(<BookWriterDashboardPanel />);
    // Initial: Dashboard-Poll + Mount-Check des eingebetteten Recovery-Dialogs.
    expect(mockFindInterrupted.mock.calls.length).toBeGreaterThanOrEqual(1);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(mockFindInterrupted.mock.calls.length).toBeGreaterThanOrEqual(3);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(mockFindInterrupted.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("aktualisiert die Anzeige, wenn der Fortschritt zwischen zwei Polls steigt", () => {
    vi.useFakeTimers();
    let current = 5;
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockImplementation(() => [
      makeInfo({ currentChapter: current, job: { id: "bwj_a", projectId: "p1", config: {}, outline: null, status: "running", currentChapter: current, error: null, createdAt: 0, updatedAt: Date.now() } as never }),
    ]);
    render(<BookWriterDashboardPanel />);
    expect(screen.getByTestId("bw-dash-row-bwj_a")).toHaveTextContent("Kapitel 5 / 8");
    act(() => { current = 6; vi.advanceTimersByTime(2100); });
    expect(screen.getByTestId("bw-dash-row-bwj_a")).toHaveTextContent("Kapitel 6 / 8");
  });
});

describe("BookWriterDashboardPanel — Steuerung", () => {
  it("'Im Panel fortsetzen' öffnet das Projekt und schickt das Open-Mode-Event", async () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener(OPEN_BOOKWRITER_MODE_EVENT, listener);
    const user = userEvent.setup();
    render(<BookWriterDashboardPanel />);
    await user.click(screen.getByRole("button", { name: /Im Panel fortsetzen/ }));
    window.removeEventListener(OPEN_BOOKWRITER_MODE_EVENT, listener);
    expect(useProjectStore.getState().activeProjectId).toBe("p1");
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBe("bookwriter");
  });

  it("'Als unterbrochen markieren' setzt den Job-Status (Steuerung laufender CLI-Jobs)", async () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    const user = userEvent.setup();
    render(<BookWriterDashboardPanel />);
    await user.click(screen.getByRole("button", { name: /Als unterbrochen markieren/ }));
    expect(setBookJobStatus).toHaveBeenCalledWith("bwj_a", "interrupted", expect.any(String));
  });

  it("'Verwerfen' löscht den Job und entfernt die Zeile", async () => {
    // Die ersten zwei Abfragen (Dashboard-Poll + Recovery-Dialog-Mount)
    // liefern den Job, alle weiteren (nach dem Verwerfen) keine mehr.
    let calls = 0;
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockImplementation(() => {
      calls++;
      return calls <= 2 ? [makeInfo()] : [];
    });
    const user = userEvent.setup();
    render(<BookWriterDashboardPanel />);
    const row = screen.getByTestId("bw-dash-row-bwj_a");
    await user.click(within(row).getByRole("button", { name: /Verwerfen/ }));
    expect(deleteBookJob).toHaveBeenCalledWith("bwj_a");
    expect(screen.getByTestId("bw-dash-empty")).toBeInTheDocument();
  });
});

describe("BookWriterRecoveryDialog — Job-Recovery beim App-Start", () => {
  it("erscheint nicht, wenn keine abgebrochenen Jobs vorliegen", () => {
    const { container } = render(<BookWriterRecoveryDialog />);
    expect(container).toBeEmptyDOMElement();
  });

  it("erscheint als Dialog mit abgebrochenen Jobs und bietet Fortsetzen/Verwerfen", () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    render(<BookWriterRecoveryDialog />);
    expect(screen.getByRole("dialog", { name: /Unterbrochene Buchgenerierung/ })).toBeInTheDocument();
    expect(screen.getByText(/KI verstehen/)).toBeInTheDocument();
    expect(screen.getByText(/Kapitel 5 von 8 gespeichert/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fortsetzen/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verwerfen/ })).toBeInTheDocument();
  });

  it("Fortsetzen öffnet das Projekt, schickt das Open-Mode-Event und schließt", async () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    const events: CustomEvent[] = [];
    window.addEventListener(OPEN_BOOKWRITER_MODE_EVENT, (e) => events.push(e as CustomEvent));
    const user = userEvent.setup();
    render(<BookWriterRecoveryDialog />);
    await user.click(screen.getByRole("button", { name: /Fortsetzen/ }));
    expect(useProjectStore.getState().activeProjectId).toBe("p1");
    expect(events[0]?.detail).toBe("bookwriter");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Verwerfen löscht den Job; danach verschwindet der Dialog", async () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    const user = userEvent.setup();
    render(<BookWriterRecoveryDialog />);
    await user.click(screen.getByRole("button", { name: /Verwerfen/ }));
    expect(deleteBookJob).toHaveBeenCalledWith("bwj_a");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("'Später' schließt den Dialog ohne Datenänderung", async () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    const user = userEvent.setup();
    render(<BookWriterRecoveryDialog />);
    await user.click(screen.getByRole("button", { name: /Später/ }));
    expect(deleteBookJob).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
