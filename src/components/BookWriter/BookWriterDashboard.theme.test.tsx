// @vitest-environment jsdom
// Sprint 18, Agent 4 — BookWriter Bloomberg-Terminal-Theme: 5 Tests.
// TDD: Button-Click funktioniert, Progress rendert, Theme-Klassen/Vars sitzen.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/cli/jobRecovery", () => ({
  findInterruptedJobs: vi.fn(() => []),
}));

vi.mock("@/services/bookwriter/jobs", () => ({
  setBookJobStatus: vi.fn(async () => undefined),
  deleteBookJob: vi.fn(async () => undefined),
}));

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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BookWriterDashboardPanel, OPEN_BOOKWRITER_MODE_EVENT } from "./BookWriterDashboard";
import { findInterruptedJobs } from "@/services/cli/jobRecovery";
import { useProjectStore } from "@/store/projectStore";
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

describe("BookWriter Bloomberg-Theme (Sprint 18, Agent 4)", () => {
  it("Root trägt die Terminal-Theme-Klasse bw-terminal", () => {
    render(<BookWriterDashboardPanel />);
    expect(screen.getByTestId("bw-dash")).toHaveClass("bw-terminal");
  });

  it("Button-Click funktioniert weiterhin: 'Im Panel fortsetzen' feuert das Open-Mode-Event", async () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener(OPEN_BOOKWRITER_MODE_EVENT, listener);
    const user = userEvent.setup();
    render(<BookWriterDashboardPanel />);
    await user.click(screen.getByRole("button", { name: /Im Panel fortsetzen/ }));
    window.removeEventListener(OPEN_BOOKWRITER_MODE_EVENT, listener);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBe("bookwriter");
  });

  it("Progress rendert: Balken-Breite entspricht Prozent, Text zeigt Kapitelzähler", () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    const { container } = render(<BookWriterDashboardPanel />);
    const row = screen.getByTestId("bw-dash-row-bwj_a");
    expect(row).toHaveTextContent("Kapitel 5 / 8");
    expect(row).toHaveTextContent("63 %");
    const fill = container.querySelector('[data-testid="bw-dash-progress-bwj_a"] .bw-progress-fill') as HTMLElement | null;
    expect(fill).not.toBeNull();
    expect(fill!.style.width).toBe("63%");
  });

  it("Progress-/Wordcount-Text nutzt Monospace-Klasse, State-Badge trägt data-state", () => {
    (findInterruptedJobs as ReturnType<typeof vi.fn>).mockReturnValue([makeInfo()]);
    render(<BookWriterDashboardPanel />);
    const progress = screen.getByTestId("bw-dash-progress-bwj_a");
    expect(progress.querySelector(".bw-progress-text")).toHaveClass("bw-wordcount-mono");
    expect(screen.getByTestId("bw-dash-state-bwj_a")).toHaveAttribute("data-state");
  });

  it("bookwriter.css definiert Bloomberg-Vars (Amber, Dark-BG, Mono)", () => {
    const css = readFileSync(join(__dirname, "bookwriter.css"), "utf8");
    expect(css).toContain("--bw-amber");
    expect(css).toContain("--bw-bg");
    expect(css).toContain("--bw-mono");
    expect(css).toContain(".bw-progress-fill");
    expect(css).not.toMatch(/border:\s*1px\s+(dashed|solid)\s+#ccc/i);
  });
});
