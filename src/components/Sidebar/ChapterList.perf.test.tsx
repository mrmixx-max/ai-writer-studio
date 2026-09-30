// @vitest-environment jsdom
// Sprint 13 Agent 4 — Kapitel-Listen-Perf: Render-Ceiling-Tests für die
// Kapitel-Liste (Sidebar chapter-tree / ChapterRow / ProjectRow).
//
// Methode: memoisierte Zähl-Hülle um die reale ChapterRow. Die Hülle hat
// dieselbe Shallow-Compare-Semantik wie ChapterRow selbst — ihr Render-Zähler
// entspricht exakt den ChapterRow-Renders (Hülle skippt ⟺ Row skippt).
// (Pro-Row-<Profiler> wäre falsch: der Profiler misst sich selbst, weil sich
// seine eigenen Props bei jedem Eltern-Render ändern.)
// Fixture: 200 Kapitel (N=200), jsdom, keine neuen Dependencies.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { memo, act } from "react";
import { render } from "@testing-library/react";
import { ChapterRow, ProjectRow, Sidebar, type RowActions } from "./Sidebar";
import { useProjectStore } from "@/store/projectStore";
import type { Chapter, Project } from "@/types/project";

vi.mock("@/services/project", () => ({
  listProjects: vi.fn(() => [] as never),
  listChapters: vi.fn(() => [] as never),
  createProject: vi.fn(async (name: string) => ({ id: "p-new", name, createdAt: 0, updatedAt: 0 })),
  createChapter: vi.fn(async (_pid: string, title: string) => ({ id: "c-new", title, content: "{}", projectId: _pid, orderIndex: 0, createdAt: 0, updatedAt: 0 })),
  renameProject: vi.fn(async () => undefined),
  renameChapter: vi.fn(async () => undefined),
  deleteProject: vi.fn(async () => undefined),
  deleteChapter: vi.fn(async () => undefined),
  getChapter: vi.fn(() => null),
  getChapterDecrypted: vi.fn(async () => null),
  updateChapter: vi.fn(async () => undefined),
  updateChapterFields: vi.fn(async () => undefined),
}));

const N = 200;

function makeChapter(i: number): Chapter {
  return {
    id: `c-${i}`,
    projectId: "p1",
    title: `Kapitel ${i + 1}`,
    content: "{}",
    orderIndex: i,
    createdAt: 0,
    updatedAt: 0,
    status: "planned",
    targetWordCount: 1000,
    minimumWordCount: 800,
    maximumWordCount: 1200,
    currentWordCount: 0,
  };
}

function makeFixture(n: number): Chapter[] {
  return Array.from({ length: n }, (_, i) => makeChapter(i));
}

const PROJECT: Project = { id: "p1", name: "Leistungs-Roman", createdAt: 0, updatedAt: 0 };

// Modul-stabile Actions (eine Identität für alle Rerenders — genau der
// Vertrag, den Sidebar.rowActions per useMemo einhält).
const stableActions: RowActions = {
  onOpenProject: () => {},
  onOpenChapter: () => {},
  onRenameProject: () => {},
  onDeleteProject: () => {},
  onRenameChapter: () => {},
  onDeleteChapter: () => {},
};

function freshActions(): RowActions {
  return {
    onOpenProject: () => {},
    onOpenChapter: () => {},
    onRenameProject: () => {},
    onDeleteProject: () => {},
    onRenameChapter: () => {},
    onDeleteChapter: () => {},
  };
}

type Counts = Map<string, number>;

function bump(counts: Counts, id: string) {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function totalCommits(counts: Counts): number {
  let s = 0;
  for (const v of counts.values()) s += v;
  return s;
}

// Zähl-Hülle: memo + identische Props wie ChapterRow → der Zähler entspricht
// exakt den ChapterRow-Renders (skippt die Hülle, skippt die Row).
const CountedRow = memo(function CountedRow({
  chapter, projectId, active, actions, counts,
}: {
  chapter: Chapter;
  projectId: string;
  active: boolean;
  actions: RowActions;
  counts: Counts;
}) {
  bump(counts, chapter.id);
  return <ChapterRow chapter={chapter} projectId={projectId} active={active} actions={actions} />;
});

function rowList(chapters: Chapter[], activeId: string | null, actions: RowActions, counts: Counts) {
  return (
    <ul>
      {chapters.map((c) => (
        <CountedRow
          key={c.id}
          chapter={c}
          projectId="p1"
          active={c.id === activeId}
          actions={actions}
          counts={counts}
        />
      ))}
    </ul>
  );
}

const CountedProject = memo(function CountedProject({
  chapters, activeChapterId, actions, counts,
}: {
  chapters: Chapter[];
  activeChapterId: string | null;
  actions: RowActions;
  counts: Counts;
}) {
  bump(counts, "project-p1");
  return (
    <ProjectRow
      project={PROJECT}
      active
      activeChapterId={activeChapterId}
      chapters={chapters}
      actions={actions}
    />
  );
});

beforeEach(() => {
  useProjectStore.setState({
    projects: [],
    activeProjectId: null,
    chapters: [],
    activeChapterId: null,
  });
});

describe("ChapterRow Render-Ceiling (200 Kapitel)", () => {
  it("mountet jede Zeile exakt einmal (Ceiling = N)", () => {
    const chapters = makeFixture(N);
    const counts: Counts = new Map();
    render(rowList(chapters, "c-0", stableActions, counts));
    expect(counts.size).toBe(N);
    for (const [, v] of counts) expect(v).toBe(1);
  });

  it("Eltern-Rerender mit stabilen Props rendert keine Zeile neu", () => {
    const chapters = makeFixture(N);
    const counts: Counts = new Map();
    const view = render(rowList(chapters, "c-0", stableActions, counts));
    expect(totalCommits(counts)).toBe(N);
    view.rerender(rowList(chapters, "c-0", stableActions, counts));
    expect(totalCommits(counts)).toBe(N);
  });

  it("Selektionswechsel rendert nur die 2 betroffenen Zeilen neu", () => {
    const chapters = makeFixture(N);
    const counts: Counts = new Map();
    const view = render(rowList(chapters, "c-0", stableActions, counts));
    expect(totalCommits(counts)).toBe(N);
    view.rerender(rowList(chapters, "c-1", stableActions, counts));
    expect(totalCommits(counts)).toBe(N + 2);
    expect(counts.get("c-0")).toBe(2);
    expect(counts.get("c-1")).toBe(2);
    expect(counts.get("c-100")).toBe(1);
  });

  it("neue Actions-Identität rendert alle Zeilen neu (Stabilisierungs-Vertrag)", () => {
    const chapters = makeFixture(N);
    const counts: Counts = new Map();
    const view = render(rowList(chapters, "c-0", stableActions, counts));
    expect(totalCommits(counts)).toBe(N);
    view.rerender(rowList(chapters, "c-0", freshActions(), counts));
    // Jede Zeile genau 1 Zusatz-Render — belegt, warum Sidebar.rowActions
    // per useMemo stabil bleiben muss (Sprint-13-Fix: tRef + lang-Deps).
    expect(totalCommits(counts)).toBe(2 * N);
  });

  it("einzelnes ersetztes Chapter-Objekt (Store-updateChapter-Semantik) rendert nur diese Zeile neu", () => {
    const chapters = makeFixture(N);
    const counts: Counts = new Map();
    const view = render(rowList(chapters, "c-0", stableActions, counts));
    expect(totalCommits(counts)).toBe(N);
    // Wie projectStore.updateChapter: neues Array, aber identische
    // Objektreferenzen für alle unveränderten Kapitel.
    const next = chapters.map((c, i) => (i === 50 ? { ...c, title: "Kapitel 51 (neu)" } : c));
    view.rerender(rowList(next, "c-0", stableActions, counts));
    expect(totalCommits(counts)).toBe(N + 1);
    expect(counts.get("c-50")).toBe(2);
  });
});

describe("ProjectRow Render-Ceiling (200 Kapitel)", () => {
  it("stabile Props: kein einziger Zusatz-Render", () => {
    const chapters = makeFixture(N);
    const counts: Counts = new Map();
    const view = render(
      <ul>
        <CountedProject chapters={chapters} activeChapterId="c-0" actions={stableActions} counts={counts} />
      </ul>,
    );
    expect(counts.get("project-p1")).toBe(1);
    view.rerender(
      <ul>
        <CountedProject chapters={chapters} activeChapterId="c-0" actions={stableActions} counts={counts} />
      </ul>,
    );
    expect(counts.get("project-p1")).toBe(1);
  });

  it("ProjectRow rendert 200 Zeilen, Selektion wandert korrekt", () => {
    const chapters = makeFixture(N);
    const counts: Counts = new Map();
    const view = render(
      <ul>
        <CountedProject chapters={chapters} activeChapterId="c-0" actions={stableActions} counts={counts} />
      </ul>,
    );
    const items = () => Array.from(view.container.querySelectorAll(".chapter-tree > li"));
    expect(items().length).toBe(N);
    expect(items().filter((li) => li.classList.contains("active")).length).toBe(1);
    view.rerender(
      <ul>
        <CountedProject chapters={chapters} activeChapterId="c-5" actions={stableActions} counts={counts} />
      </ul>,
    );
    // activeChapterId-Prop ändert sich → genau 1 ProjectRow-Zusatz-Render.
    expect(counts.get("project-p1")).toBe(2);
    const active = items().filter((li) => li.classList.contains("active"));
    expect(active.length).toBe(1);
    expect(active[0].textContent).toContain("Kapitel 6");
  });
});

describe("Sidebar Kapitel-Liste Integration (200 Kapitel)", () => {
  function chapterItems(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(".chapter-tree > li"));
  }

  function mountWithFixture(activeChapterId: string | null = "c-0") {
    const ui = render(<Sidebar />);
    const chapters = makeFixture(N);
    act(() => {
      useProjectStore.setState({
        projects: [PROJECT],
        activeProjectId: "p1",
        chapters,
        activeChapterId,
      });
    });
    return { ui, chapters };
  }

  it("200-Kapitel-Fixture rendert 200 Zeilen (DOM-Ceiling)", () => {
    const { ui } = mountWithFixture();
    expect(chapterItems(ui.container).length).toBe(N);
  });

  it("Selektionswechsel: genau 1 aktive Zeile, kein Listen-Neuaufbau", () => {
    const { ui } = mountWithFixture("c-0");
    const before = chapterItems(ui.container);
    expect(before.length).toBe(N);
    expect(before.filter((li) => li.classList.contains("active")).length).toBe(1);

    // Entspricht store.openChapter bei erfolgreichem getChapter (Service ist
    // hier gemockt): nur die Selektion ändert sich, Chapter-Refs bleiben.
    act(() => {
      useProjectStore.setState({ activeChapterId: "c-199" });
    });

    const after = chapterItems(ui.container);
    expect(after.length).toBe(N);
    const activeAfter = after.filter((li) => li.classList.contains("active"));
    expect(activeAfter.length).toBe(1);
    expect(activeAfter[0].textContent).toContain("Kapitel 200");
    // Kein Remount: dieselben DOM-Knoten (stabile Keys + memo-Rows).
    for (let i = 0; i < N; i += 20) {
      expect(after[i]).toBe(before[i]);
    }
  });

  it("unverwandter Rerender baut die 200-Zeilen-Liste nicht neu", () => {
    const { ui } = mountWithFixture();
    const before = chapterItems(ui.container);
    expect(before.length).toBe(N);
    // Unverwandter Rerender (gleiche Props/State) — Liste muss stehen bleiben.
    ui.rerender(<Sidebar />);
    const after = chapterItems(ui.container);
    expect(after.length).toBe(N);
    for (let i = 0; i < N; i += 20) {
      expect(after[i]).toBe(before[i]);
    }
  });
});
