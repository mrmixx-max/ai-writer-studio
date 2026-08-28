// Globales Test-Setup: jest-dom + Browser-API-Stubs + Tauri/sql.js-Mocks.
// Gilt für alle Tests; jsdom wird pro Component-Test via Docblock gewählt.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Browser-API-Stubs (jsdom kennt sie nicht, Komponenten setzen sie voraus)
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  }
  if (!window.ResizeObserver) {
    class ResizeObserverStub {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tauri-API-Mock: In Tests gibt es keinen Tauri-Kontext. Alle IPC-Aufrufe
// werden mit einem no-op/mockbaren invoke ersetzt. Einzelne Tests können
// per vi.mock das Verhalten überschreiben (Datei-Mock gewinnt).
// ---------------------------------------------------------------------------
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    throw new Error(`Tauri invoke("${cmd}") ist im Test nicht verfügbar`);
  }),
  convertFileSrc: vi.fn((p: string) => p),
  transformCallback: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
  emit: vi.fn(async () => undefined),
  emitTo: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
  save: vi.fn(async () => null),
  message: vi.fn(async () => undefined),
  ask: vi.fn(async () => false),
  confirm: vi.fn(async () => false),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(async () => ""),
  writeTextFile: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  mkdir: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  BaseDirectory: { AppData: "AppData", AppLocalData: "AppLocalData", Document: "Document" },
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  exit: vi.fn(async () => undefined),
  relaunch: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// sql.js-Mock: NUR in jsdom-Component-Tests (window vorhanden). Service-Tests
// laufen im node-Environment und nutzen echtes sql.js mit In-Memory-DB.
// initSqlJs gibt eine minimale Fake-DB zurück; Services, die echte DB-Semantik
// brauchen, werden in den jeweiligen Component-Tests explizit gemockt.
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  vi.doMock("sql.js", async () => {
    class FakeStatement {
      bind() { return true; }
      step() { return false; }
      get() { return []; }
      free() { return true; }
      getAsObject() { return {}; }
      run() { /* no-op */ }
    }
    class FakeDatabase {
      exec() { return []; }
      prepare() { return new FakeStatement(); }
      run() { return this; }
      export() { return new Uint8Array(0); }
      close() { /* no-op */ }
      createFunction() { /* no-op */ }
    }
    const initSqlJs = vi.fn(async () => ({
      Database: FakeDatabase,
      Statement: FakeStatement,
    }));
    return { default: initSqlJs };
  });
}
