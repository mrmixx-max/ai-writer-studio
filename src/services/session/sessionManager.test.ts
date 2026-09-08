// Unit-Tests: SessionManager (Sprint 24, Agent 3) — CRUD + Restore.
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveSession,
  loadSession,
  getSessions,
  deleteSession,
  renameSession,
  restoreState,
  getLastRestoredId,
  __resetSessionState,
} from "./sessionManager";

beforeEach(async () => {
  await __resetSessionState();
});

describe("sessionManager", () => {
  it("saveSession() erzeugt eine Session mit Name, ID und Zeitstempeln", async () => {
    const session = await saveSession("Forschungsstand");
    expect(session.id).toMatch(/^session-/);
    expect(session.name).toBe("Forschungsstand");
    expect(session.createdAt).toBeGreaterThan(0);
    expect(session.updatedAt).toBeGreaterThanOrEqual(session.createdAt);
    expect(Array.isArray(session.openTabs)).toBe(true);
    const all = await getSessions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(session.id);
  });

  it("saveSession() wirft bei leerem Namen", async () => {
    await expect(saveSession("   ")).rejects.toThrow();
    expect(await getSessions()).toHaveLength(0);
  });

  it("loadSession() gibt die Session zurueck, unbekannte ID wirft", async () => {
    const saved = await saveSession("Kapitel 3");
    const loaded = await loadSession(saved.id);
    expect(loaded.id).toBe(saved.id);
    expect(loaded.name).toBe("Kapitel 3");
    await expect(loadSession("session-gibt-es-nicht")).rejects.toThrow();
  });

  it("getSessions() gibt alle Sessions neueste-zuerst zurueck", async () => {
    const first = await saveSession("Erste");
    const second = await saveSession("Zweite");
    const all = await getSessions();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.id)).toContain(first.id);
    expect(all.map((s) => s.id)).toContain(second.id);
    expect(all[0].updatedAt).toBeGreaterThanOrEqual(all[1].updatedAt);
  });

  it("renameSession() benennt um, leere Namen und unbekannte IDs werfen", async () => {
    const saved = await saveSession("Alt");
    await renameSession(saved.id, "Neu");
    expect((await loadSession(saved.id)).name).toBe("Neu");
    await expect(renameSession(saved.id, "  ")).rejects.toThrow();
    await expect(renameSession("session-gibt-es-nicht", "X")).rejects.toThrow();
  });

  it("deleteSession() loescht gezielt, unbekannte ID wirft", async () => {
    const a = await saveSession("A");
    const b = await saveSession("B");
    await deleteSession(a.id);
    const rest = await getSessions();
    expect(rest).toHaveLength(1);
    expect(rest[0].id).toBe(b.id);
    await expect(deleteSession(a.id)).rejects.toThrow();
  });

  it("restoreState() setzt den Zustand, merkt sich die Session, unbekannte ID wirft", async () => {
    const saved = await saveSession("Arbeitsstand");
    await restoreState(saved);
    expect(getLastRestoredId()).toBe(saved.id);
    await expect(
      restoreState({ ...saved, id: "session-gibt-es-nicht" }),
    ).rejects.toThrow();
    expect(getLastRestoredId()).toBe(saved.id);
  });
});
