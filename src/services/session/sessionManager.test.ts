// @vitest-environment jsdom
// Tests: sessionManager (Sprint 24, Agent 3) — CRUD + Restore.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetSessionsForTests,
  deleteSession,
  getSessions,
  loadSession,
  renameSession,
  restoreState,
  saveSession,
} from "./sessionManager";
import { useProjectStore } from "@/store/projectStore";

beforeEach(() => {
  __resetSessionsForTests();
  localStorage.clear();
  useProjectStore.setState({
    projects: [],
    activeProjectId: "p1",
    chapters: [
      { id: "c1", projectId: "p1", title: "K1", content: "", orderIndex: 0, createdAt: 0, updatedAt: 0 },
      { id: "c2", projectId: "p1", title: "K2", content: "", orderIndex: 1, createdAt: 0, updatedAt: 0 },
    ] as never,
    activeChapterId: "c1",
  });
});

describe("sessionManager", () => {
  it("saveSession() erzeugt Session mit Snapshot", async () => {
    const s = await saveSession("Test-Session");
    expect(s.id).toBeTruthy();
    expect(s.name).toBe("Test-Session");
    expect(s.projectId).toBe("p1");
    expect(s.openTabs).toEqual(["c1", "c2"]);
    expect(s.activeTab).toBe("c1");
    expect(await getSessions()).toHaveLength(1);
  });

  it("loadSession() gibt Session zurück, unbekannte ID wirft", async () => {
    const s = await saveSession("A");
    await expect(loadSession(s.id)).resolves.toMatchObject({ id: s.id, name: "A" });
    await expect(loadSession("nope")).rejects.toThrow(/nicht gefunden/);
  });

  it("renameSession() benennt um, leere Namen werfen", async () => {
    const s = await saveSession("Alt");
    await renameSession(s.id, "Neu");
    expect((await getSessions())[0].name).toBe("Neu");
    await expect(renameSession(s.id, "   ")).rejects.toThrow();
    await expect(renameSession("nope", "X")).rejects.toThrow();
  });

  it("deleteSession() entfernt Session", async () => {
    const a = await saveSession("A");
    const b = await saveSession("B");
    await deleteSession(a.id);
    const rest = await getSessions();
    expect(rest).toHaveLength(1);
    expect(rest[0].id).toBe(b.id);
  });

  it("restoreState() setzt Projekt + Kapitel im Store", async () => {
    const openProject = vi.spyOn(useProjectStore.getState(), "openProject");
    const openChapter = vi.spyOn(useProjectStore.getState(), "openChapter");
    const s = await saveSession("R");
    useProjectStore.setState({ activeProjectId: null, activeChapterId: null });
    await restoreState({ ...s, projectId: "p1", activeTab: "c2" });
    expect(openProject).toHaveBeenCalledWith("p1");
    expect(openChapter).toHaveBeenCalledWith("c2");
  });
});
