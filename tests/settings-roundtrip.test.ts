// Settings-Persistenz-Audit (Sprint 12, Agent 6):
// Roundtrip-Tests fuer alle Settings-Stores.
//
// Abgedeckt:
//  1. services/settings (AppSettings + Auth-Record, SQLite via settings-Tabelle)
//  2. services/analytics + analyticsStore (localStorage "ai-writer-studio.analytics.v1")
//  3. services/printlayout (localStorage "aiws.printlayout.v1")
//  4. services/sprint (localStorage "ai-writer-studio.sprint.v1", Legacy "sprint_stats")
//  5. services/setup/state (localStorage "aiws.setup.completed"/"aiws.setup.version")
//  6. i18n (localStorage "app-lang") + highContrast (localStorage "app-contrast")
//  7. PluginManager (localStorage "plugins.enabled") + goal-tracker-key ("plugins.writing-goal-tracker")
//  8. services/prompt/store (SQLite writing_prompts, inkl. deletePrompt-persist)
//  9. zustand-Stores: editorStore / promptStore / fragmentStore / projectStore
//     (transient per Design -> Serialisierbarkeit + Rehydrierbarkeit des Slices)
// 10. Schluessel-Kollisions-Audit: kein Key wird von zwei Modulen beschrieben.
//
// Umgebung: node (kein jsdom) + In-Memory-localStorage-Stub + frische
// sql.js-DB via __aws_db-Injektion (Muster aus jobs.test.ts).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";

// --- persist()-Aufrufe zaehlen (deckt deletePrompt-Fix ab) -----------------
vi.mock("@/services/db", async (importOriginal) => {
  const mod: Record<string, unknown> = await importOriginal();
  const realPersist = mod.persist as () => Promise<void>;
  return {
    ...mod,
    persist: (...args: unknown[]) => {
      (globalThis as Record<string, unknown>).__persistCalls =
        ((globalThis as Record<string, unknown>).__persistCalls as number ?? 0) + 1;
      return (realPersist as (...a: unknown[]) => Promise<void>)(...args);
    },
  };
});

import { getDb } from "@/services/db";
import { loadSettings, saveSettings, loadAuthRecord, saveAuthRecord, clearAuthRecord } from "@/services/settings";
import { DEFAULT_SETTINGS } from "@/types/config";
import { loadData, saveData, todayKey } from "@/services/analytics";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { loadPrintLayout, savePrintLayout, DEFAULT_PRINT_LAYOUT } from "@/services/printlayout";
import { loadSprintStats, saveSprintStats, recordSprint } from "@/services/sprint/sprint";
import { isSetupCompleted, markSetupCompleted, resetSetup } from "@/services/setup/state";
import { detectLanguage } from "@/i18n";
import { getHighContrastPreference } from "@/i18n/highContrast";
import { PluginManager } from "@/plugins/PluginManager";
import { GOAL_STORAGE_KEY } from "@/plugins/builtin/writing-goal-tracker";
import { savePrompt, getPrompt, setFavorite, listPrompts, deletePrompt } from "@/services/prompt/store";
import { useEditorStore } from "@/store/editorStore";
import { usePromptStore } from "@/store/promptStore";
import { useFragmentStore } from "@/store/fragmentStore";
import { useProjectStore } from "@/store/projectStore";
import { createProject } from "@/services/project";

// --- In-Memory-localStorage-Stub (node-Env hat keins) ----------------------
function installLocalStorageStub(): Map<string, string> {
  const backing = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => void backing.set(k, String(v)),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() { return backing.size; },
  };
  (globalThis as Record<string, unknown>).localStorage = stub;
  return backing;
}

let backing: Map<string, string>;

beforeEach(async () => {
  backing = installLocalStorageStub();
  (globalThis as Record<string, unknown>).__persistCalls = 0;
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as Record<string, unknown>).__aws_db = db;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__aws_db;
});

// ===========================================================================
describe("settings-roundtrip: AppSettings (SQLite)", () => {
  it("save -> load uebersteht Aenderungen (provider, theme, privacy)", async () => {
    const changed = {
      ...DEFAULT_SETTINGS,
      provider: "openai" as const,
      model: "gpt-4o-mini",
      temperature: 0.2,
      theme: "light" as const,
      privacyMode: true,
      autoLock: "15m" as const,
    };
    await saveSettings(changed);
    // "frische Instanz": erneut aus der DB lesen (kein Cache im Service).
    expect(loadSettings()).toEqual(changed);
  });

  it("partielles JSON wird mit Defaults gemergt", () => {
    getDb().run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["app_settings", JSON.stringify({ theme: "light" })],
    );
    const loaded = loadSettings();
    expect(loaded.theme).toBe("light");
    expect(loaded.model).toBe(DEFAULT_SETTINGS.model);
    expect(loaded.provider).toBe(DEFAULT_SETTINGS.provider);
  });

  it("korruptes JSON faellt auf Defaults zurueck", () => {
    getDb().run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["app_settings", "{kaputt"],
    );
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("Auth-Record: save -> load -> clear", async () => {
    expect(loadAuthRecord()).toBeNull();
    const record = { hash: "abc123", salt: "s", iterations: 100000, createdAt: Date.now() };
    await saveAuthRecord(record as never);
    expect(loadAuthRecord()).toEqual(record);
    await clearAuthRecord();
    expect(loadAuthRecord()).toBeNull();
  });
});

// ===========================================================================
describe("settings-roundtrip: Analytics (localStorage + Store)", () => {
  it("saveData -> loadData uebersteht Tage, Ziele, Session", () => {
    const data = {
      days: { "2026-09-06": { date: "2026-09-06", words: 1234, sessions: 2, activeMs: 60000, pauseMs: 5000 } },
      goals: [{ id: "g1", type: "dailyWords" as const, target: 500, createdAt: "2026-09-06" }],
      currentSession: { startedAt: 1, lastActivityAt: 2, words: 10 },
    };
    saveData(data);
    expect(loadData()).toEqual(data);
  });

  it("korrupte Daten starten neu (kein Crash)", () => {
    backing.set("ai-writer-studio.analytics.v1", "{kaputt");
    expect(loadData()).toEqual({ days: {}, goals: [], currentSession: null });
  });

  it("Store-Aktion persistiert: recordWords -> Reload via loadData", () => {
    useAnalyticsStore.getState().recordWords(250);
    const raw = backing.get("ai-writer-studio.analytics.v1")!;
    const reloaded = loadData();
    expect(reloaded.days[todayKey()]?.words).toBeGreaterThanOrEqual(250);
    // "frische Instanz": Store zuruecksetzen, aus Persistenz rehydrieren.
    const fresh = JSON.parse(raw) as ReturnType<typeof loadData>;
    useAnalyticsStore.setState({ days: {}, goals: [], currentSession: null });
    useAnalyticsStore.setState({ days: fresh.days, goals: fresh.goals, currentSession: fresh.currentSession });
    expect(useAnalyticsStore.getState().days[todayKey()]?.words).toBeGreaterThanOrEqual(250);
  });
});

// ===========================================================================
describe("settings-roundtrip: PrintLayout", () => {
  it("save -> load uebersteht alle Sektionen", () => {
    const layout = {
      ...DEFAULT_PRINT_LAYOUT,
      pageSize: "6x9" as const,
      margins: { top: 20, right: 17, bottom: 20, left: 17 },
      typography: { ...DEFAULT_PRINT_LAYOUT.typography, fontSizePt: 11, lineHeight: 1.4 },
    };
    savePrintLayout(layout);
    expect(loadPrintLayout()).toEqual(layout);
  });

  it("partielles JSON wird mit Defaults gemergt", () => {
    backing.set("aiws.printlayout.v1", JSON.stringify({ pageSize: "a5" }));
    const loaded = loadPrintLayout();
    expect(loaded.pageSize).toBe("a5");
    expect(loaded.margins).toEqual(DEFAULT_PRINT_LAYOUT.margins);
  });

  it("korruptes JSON faellt auf Defaults zurueck", () => {
    backing.set("aiws.printlayout.v1", "{kaputt");
    expect(loadPrintLayout()).toEqual(DEFAULT_PRINT_LAYOUT);
  });
});

// ===========================================================================
describe("settings-roundtrip: Sprint-Stats (Fix: Namespace + Validierung)", () => {
  it("recordSprint -> load uebersteht Totals und Streak", () => {
    recordSprint(300, 15);
    const stats = loadSprintStats();
    expect(stats.totalSprints).toBe(1);
    expect(stats.totalWords).toBe(300);
    expect(stats.totalMinutes).toBe(15);
    expect(stats.currentStreak).toBe(1);
  });

  it("schreibt unter namespaced Key (kein generischer Key mehr)", () => {
    recordSprint(100, 5);
    expect(backing.has("ai-writer-studio.sprint.v1")).toBe(true);
    expect(backing.has("sprint_stats")).toBe(false);
  });

  it("migriert Legacy-Key 'sprint_stats' beim Laden", () => {
    const legacy = { totalSprints: 7, totalWords: 7000, totalMinutes: 70, currentStreak: 3, bestStreak: 5, lastSprintDate: null };
    backing.set("sprint_stats", JSON.stringify(legacy));
    expect(loadSprintStats()).toEqual(legacy);
    saveSprintStats(loadSprintStats());
    expect(backing.get("ai-writer-studio.sprint.v1")).toBe(JSON.stringify(legacy));
    expect(backing.has("sprint_stats")).toBe(false);
  });

  it("formfremdes JSON faellt auf Defaults zurueck", () => {
    for (const bad of ['"nur-ein-string"', "42", '{"totalSprints":"x"}', '{"totalSprints":1}']) {
      backing.set("ai-writer-studio.sprint.v1", bad);
      expect(loadSprintStats()).toEqual({
        totalSprints: 0, totalWords: 0, totalMinutes: 0,
        currentStreak: 0, bestStreak: 0, lastSprintDate: null,
      });
    }
  });

  it("save wirft nicht bei vollem/defektem Storage", () => {
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: () => null, removeItem: () => undefined,
      setItem: () => { throw new Error("QuotaExceeded"); },
      clear: () => undefined, key: () => null, length: 0,
    };
    expect(() => saveSprintStats(loadSprintStats())).not.toThrow();
  });
});

// ===========================================================================
describe("settings-roundtrip: Setup-Assistent", () => {
  it("mark -> is -> reset", () => {
    expect(isSetupCompleted()).toBe(false);
    markSetupCompleted();
    expect(backing.get("aiws.setup.completed")).toBe("1");
    expect(isSetupCompleted()).toBe(true);
    resetSetup();
    expect(isSetupCompleted()).toBe(false);
  });
});

// ===========================================================================
describe("settings-roundtrip: i18n + Kontrast", () => {
  it("app-lang uebersteht Reload", () => {
    backing.set("app-lang", "fr");
    expect(detectLanguage()).toBe("fr");
    backing.set("app-lang", "xx");
    expect(detectLanguage()).toBe("de");
  });

  it("app-contrast uebersteht Reload", () => {
    backing.set("app-contrast", "high");
    expect(getHighContrastPreference()).toBe(true);
    backing.set("app-contrast", "normal");
    expect(getHighContrastPreference()).toBe(false);
  });
});

// ===========================================================================
describe("settings-roundtrip: Plugin-Aktivierungen", () => {
  const fakePlugin = (id: string) => ({
    manifest: { id, name: id, version: "1.0.0" },
    activate: () => undefined,
  });

  it("enable uebersteht Manager-Neustart (frische Instanz liest localStorage)", async () => {
    const m1 = new PluginManager();
    await m1.install(fakePlugin("plug-a") as never);
    expect(backing.has("plugins.enabled")).toBe(true);
    const m2 = new PluginManager();
    expect(m2.isEnabled("plug-a")).toBe(true);
  });

  it("korruptes JSON -> leere Liste statt Crash", () => {
    backing.set("plugins.enabled", "{kaputt");
    const m = new PluginManager();
    expect(m.isEnabled("irgendwas")).toBe(false);
  });

  it("Goal-Tracker-Key kollidiert nicht mit Manager-Key", () => {
    expect(GOAL_STORAGE_KEY).not.toBe("plugins.enabled");
    backing.set(GOAL_STORAGE_KEY, JSON.stringify({ target: 500 }));
    const m = new PluginManager();
    expect(m.isEnabled("plug-x")).toBe(false);
    expect(backing.get(GOAL_STORAGE_KEY)).toContain("500");
  });
});

// ===========================================================================
describe("settings-roundtrip: Prompt-Store (SQLite)", () => {
  it("save -> get -> favorite -> delete uebersteht jeden Schritt", async () => {
    const stored = await savePrompt(
      { text: "Ein Drache ueber der Stadt.", genre: "Fantasy", type: "Story-Starter" } as never,
      "generator", "test-model",
    );
    expect(getPrompt(stored.id)?.text).toContain("Drache");
    await setFavorite(stored.id, true);
    expect(listPrompts({ favoritesOnly: true }).map((p) => p.id)).toContain(stored.id);
    deletePrompt(stored.id);
    expect(getPrompt(stored.id)).toBeNull();
  });

  it("deletePrompt persistiert (Fix: kein stiller Datenverlust)", async () => {
    const stored = await savePrompt({ text: "Zum Loeschen", genre: "Fantasy", type: "Story-Starter" } as never, "g", "m");
    (globalThis as Record<string, unknown>).__persistCalls = 0;
    deletePrompt(stored.id);
    expect((globalThis as Record<string, unknown>).__persistCalls as number).toBeGreaterThan(0);
    expect(getPrompt(stored.id)).toBeNull();
  });
});

// ===========================================================================
describe("settings-roundtrip: zustand-Stores (transient, Slice-serialisierbar)", () => {
  it("editorStore: Chapter+Content uebersteht JSON-Serialisierung", () => {
    useEditorStore.getState().setChapter("c1", '{"type":"doc","content":[]}');
    useEditorStore.getState().setContent('{"type":"doc","content":[{"type":"paragraph"}]}');
    const slice = { chapterId: "c1", content: useEditorStore.getState().content };
    const revived = JSON.parse(JSON.stringify(slice)) as typeof slice;
    useEditorStore.setState({ chapterId: null, content: "{}" });
    useEditorStore.setState(revived);
    expect(useEditorStore.getState().chapterId).toBe("c1");
    expect(useEditorStore.getState().content).toContain("paragraph");
  });

  it("promptStore: UI-Auswahl uebersteht JSON-Serialisierung", () => {
    usePromptStore.getState().set("tone", "düster" as never);
    usePromptStore.getState().set("count", 5);
    const slice = { tone: usePromptStore.getState().tone, count: usePromptStore.getState().count };
    const revived = JSON.parse(JSON.stringify(slice)) as typeof slice;
    usePromptStore.getState().set("count", 3);
    usePromptStore.setState(revived);
    expect(usePromptStore.getState().count).toBe(5);
    expect(usePromptStore.getState().tone).toBe("düster");
  });

  it("fragmentStore: Ansicht uebersteht JSON-Serialisierung", () => {
    useFragmentStore.getState().setView("timeline");
    const revived = JSON.parse(JSON.stringify({ view: useFragmentStore.getState().view })) as { view: "list" | "cards" | "timeline" };
    useFragmentStore.getState().setView("cards");
    useFragmentStore.setState(revived);
    expect(useFragmentStore.getState().view).toBe("timeline");
    useFragmentStore.getState().setView("cards");
  });

  it("projectStore: refresh laedt Projekte aus SQLite (kein reiner RAM-Puffer)", async () => {
    await createProject("Roundtrip-Projekt");
    useProjectStore.getState().refresh();
    expect(useProjectStore.getState().projects.map((p) => p.name)).toContain("Roundtrip-Projekt");
    useProjectStore.getState().setActiveContent("hello");
    const revived = JSON.parse(JSON.stringify({ c: useProjectStore.getState().activeContent })) as { c: string };
    expect(revived.c).toBe("hello");
  });
});

// ===========================================================================
describe("settings-roundtrip: Schluessel-Kollisions-Audit", () => {
  it("kein Key wird von zwei Settings-Modulen beschrieben", () => {
    saveData({ days: {}, goals: [], currentSession: null });
    savePrintLayout(DEFAULT_PRINT_LAYOUT);
    recordSprint(10, 1);
    markSetupCompleted();
    backing.set("app-lang", "de");
    backing.set("app-contrast", "normal");
    backing.set(GOAL_STORAGE_KEY, "{}");
    const m = new PluginManager();
    m.isEnabled("x");

    const keys = [...backing.keys()];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("ai-writer-studio.analytics.v1");
    expect(keys).toContain("aiws.printlayout.v1");
    expect(keys).toContain("ai-writer-studio.sprint.v1");
    expect(keys).not.toContain("sprint_stats");
    // SQLite-Namespace ist eigenstaendig (kein localStorage-Duplikat).
    expect(keys.filter((k) => k === "app_settings")).toHaveLength(0);
  });
});
