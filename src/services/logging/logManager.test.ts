// Tests für den Log-Manager (Sprint 6, Agent 4): Konsole + rotierende Dateien.

import { describe, it, expect, vi } from "vitest";
import { LogManager, type LogPersistenceAdapter } from "./logManager";
import { monthlyLogFileName, parseMonthlyLogFileName } from "./logRotation";

/** In-Memory-Dateisystem-Adapter. */
function memoryAdapter() {
  const files = new Map<string, string>();
  const adapter: LogPersistenceAdapter = {
    async list() {
      return [...files.keys()];
    },
    async sizeOf(name) {
      return (files.get(name) ?? "").length;
    },
    async append(name, line) {
      files.set(name, (files.get(name) ?? "") + line);
    },
    async rename(from, to) {
      const content = files.get(from);
      if (content === undefined) throw new Error(`rename: fehlt ${from}`);
      files.delete(from);
      files.set(to, content);
    },
    async remove(name) {
      files.delete(name);
    },
  };
  return { adapter, files };
}

describe("LogManager", () => {
  it("ist ohne Adapter ein No-op (kein Crash)", async () => {
    const mgr = new LogManager(null, { mirrorToConsole: false });
    mgr.write("info", "hallo");
    await expect(mgr.flush()).resolves.toBeUndefined();
    expect(mgr.activeFileName()).toBe(monthlyLogFileName());
  });

  it("spiegelt Einträge auf die Konsole (Standard)", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { adapter } = memoryAdapter();
    const mgr = new LogManager(adapter);
    mgr.write("info", "Konsole an", "ctx");
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0][0])).toContain("[INFO/ctx]");
    spy.mockRestore();
  });

  it("schreibt Einträge in die aktive Monatsdatei", async () => {
    const { adapter, files } = memoryAdapter();
    const mgr = new LogManager(adapter, { mirrorToConsole: false });
    mgr.write("info", "Zeile 1", "app");
    mgr.write("error", "Zeile 2", "export", { boom: true });
    await mgr.flush();

    const active = monthlyLogFileName();
    expect(files.has(active)).toBe(true);
    const content = files.get(active)!;
    expect(content).toContain("Zeile 1");
    expect(content).toContain("Zeile 2");
    expect(content).toContain(" ERROR ");
    // Zeilenformat parsebar
    expect(content.split("\n").filter(Boolean).length).toBe(2);
  });

  it("rotiert bei Größenüberschreitung in app-*.1.log", async () => {
    const { adapter, files } = memoryAdapter();
    const tiny = 64; // Byte-Limit
    const mgr = new LogManager(adapter, { mirrorToConsole: false, maxFileBytes: tiny });
    for (let i = 0; i < 10; i++) {
      mgr.write("info", `Nachricht ${i} mit ordentlich Text zum Füllen der Datei`, "rot");
      await mgr.flush();
    }

    const all = [...files.keys()];
    const rotated = all.filter((f) => parseMonthlyLogFileName(f)?.rotated === 1);
    expect(rotated.length).toBeGreaterThan(0);
    // Aktive Datei existiert weiter ODER fehlt, weil die letzte Rotation
    // auf den finalen Flush fiel (sie wird beim nächsten Eintrag neu angelegt).
    const active = monthlyLogFileName();
    const activeContent = files.get(active);
    if (activeContent !== undefined) {
      expect(activeContent.length).toBeLessThanOrEqual(tiny + 200);
    }
    // Rotierte Dateien: die mit der höchsten Nummer enthält die ältesten
    // Zeilen ("Nachricht 0"), die .1.log die neuesten vor der Rotation.
    const rotName = rotated[0];
    expect(files.get(rotName)).toContain("Nachricht 9");
  });

  it("retentiert: löscht älteste rotierte Dateien bei maxFiles", async () => {
    const { adapter, files } = memoryAdapter();
    const mgr = new LogManager(adapter, {
      mirrorToConsole: false,
      maxFileBytes: 50,
      maxFilesPerMonth: 2,
    });
    for (let i = 0; i < 20; i++) {
      mgr.write("info", `Eintrag ${i} — genug Text um mehrere Rotationen zu erzwingen`, "ret");
      await mgr.flush();
    }
    const all = [...files.keys()];
    // Nie mehr als maxFiles pro Monat übrig
    expect(all.length).toBeLessThanOrEqual(2);
    // Aktive Datei immer dabei
    expect(all).toContain(monthlyLogFileName());
  });

  it("Puffer wird bei flush geleert (keine Duplikate)", async () => {
    const { adapter, files } = memoryAdapter();
    const mgr = new LogManager(adapter, { mirrorToConsole: false });
    mgr.write("info", "nur einmal", "dup");
    await mgr.flush();
    await mgr.flush();
    const content = files.get(monthlyLogFileName())!;
    expect(content.split("nur einmal").length - 1).toBe(1);
  });
});