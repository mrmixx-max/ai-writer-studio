// @vitest-environment jsdom
// Bilingual UI-Integration (Sprint 19f, Agent 1):
// - Sidebar listet den "bilingual"-Mode im Modus-Switcher (wide-Klasse).
// - BookWriterDashboard zeigt einen "🌐 Bilingual"-Tab, der per Lazy-Import
//   das BilingualPanel mit dem aktiven Kapitel öffnet.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/cli/jobRecovery", () => ({
  findInterruptedJobs: vi.fn(() => []),
}));

vi.mock("@/services/bookwriter/jobs", () => ({
  setBookJobStatus: vi.fn(async () => undefined),
  deleteBookJob: vi.fn(async () => undefined),
}));

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => [] as never),
  listChapters: vi.fn(() => [] as never),
  getChapter: vi.fn(() => null),
  getChapterDecrypted: vi.fn(async () => null),
  createProject: vi.fn(),
  createChapter: vi.fn(),
  renameProject: vi.fn(async () => undefined),
  renameChapter: vi.fn(async () => undefined),
  deleteProject: vi.fn(async () => undefined),
  deleteChapter: vi.fn(async () => undefined),
  updateChapter: vi.fn(async () => undefined),
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { BookWriterDashboardPanel } from "@/components/BookWriter/BookWriterDashboard";
import { useProjectStore } from "@/store/projectStore";

const CHAPTER = {
  id: "c1",
  title: "Kapitel 1",
  content: "Es war einmal.",
  projectId: "p1",
  orderIndex: 0,
  createdAt: 0,
  updatedAt: 0,
  status: "planned",
  targetWordCount: 2000,
  minimumWordCount: 1600,
  maximumWordCount: 2400,
  currentWordCount: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.setState({
    projects: [{ id: "p1", name: "Roman", createdAt: 0, updatedAt: 0 }],
    activeProjectId: "p1",
    chapters: [],
    activeChapterId: null,
  } as never);
});

describe("Bilingual UI-Integration — Sidebar-Mode", () => {
  it("listet bilingual im Modus-Switcher mit 🌐-Icon", () => {
    render(<Sidebar />);
    const btn = screen.getByRole("button", { name: /bilingual/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("data-mode", "bilingual");
    expect(btn.textContent).toContain("🌐");
  });

  it("rendert die Sidebar im bilingual-Mode als wide", async () => {
    useProjectStore.setState({
      chapters: [CHAPTER],
      activeChapterId: "c1",
    } as never);
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: /bilingual/i }));
    expect(document.querySelector("#app-sidebar.wide")).toBeInTheDocument();
  });
});

describe("Bilingual UI-Integration — Dashboard-Tab", () => {
  it("zeigt einen 🌐-Bilingual-Toggle im Dashboard", () => {
    render(<BookWriterDashboardPanel />);
    const toggle = screen.getByTestId("bw-dash-bilingual-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveTextContent(/bilingual/i);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("öffnet per Klick das BilingualPanel mit dem aktiven Kapitel", async () => {
    useProjectStore.setState({
      chapters: [CHAPTER],
      activeChapterId: "c1",
    } as never);
    const user = userEvent.setup();
    render(<BookWriterDashboardPanel />);
    await user.click(screen.getByTestId("bw-dash-bilingual-toggle"));
    const panel = await screen.findByTestId("bilingual-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("Kapitel 1");
    expect(screen.getByTestId("bw-dash-bilingual-toggle")).toHaveAttribute("aria-expanded", "true");
  });

  it("zeigt ohne aktives Kapitel einen Hinweis statt des Panels", async () => {
    const user = userEvent.setup();
    render(<BookWriterDashboardPanel />);
    await user.click(screen.getByTestId("bw-dash-bilingual-toggle"));
    expect(await screen.findByTestId("bw-dash-bilingual-no-chapter")).toBeInTheDocument();
    expect(screen.queryByTestId("bilingual-panel")).not.toBeInTheDocument();
  });
});
