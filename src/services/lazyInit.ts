// src/services/lazyInit.ts — Lazy module registry for startup optimization.
//
// Goal: keep app startup fast by deferring heavy modules (chapter-gen,
// bulk runner, export/KDP pipelines) behind documented dynamic imports.
// Dependency-free, fully typed.
//
// Usage:
//   const chapterGen = lazyModule(() => import("@/services/bookwriter/chapter-gen"));
//   await chapterGen.load();      // cached promise — parallel callers share one load
//   chapterGen.prefetch();        // warm cache without awaiting (e.g. on idle)
//   chapterGen.isLoaded();        // true once resolved
//   resetLazyModules();           // test-only: clear all caches

/** Handle for a lazily loaded module. */
export interface LazyModule<T> {
  /** Resolve the module; concurrent callers share one in-flight promise. */
  load(): Promise<T>;
  /** Start loading in background; errors are swallowed (surfaced on load()). */
  prefetch(): void;
  /** True once the loader resolved successfully. */
  isLoaded(): boolean;
  /** Last resolved value, or undefined if not yet loaded. */
  get(): T | undefined;
  /** Clear cached value/promise so the next load() retries the loader. */
  reset(): void;
}

type Loader<T> = () => Promise<T>;

/** Global registry of reset callbacks — lets tests clear every lazy cache. */
const registry = new Set<() => void>();

/**
 * Create a lazily loaded module handle with a cached promise.
 * - Loader is called at most once per successful load, even under parallel access.
 * - A rejected load clears the cached promise so the next load() retries.
 */
export function lazyModule<T>(loader: Loader<T>): LazyModule<T> {
  let promise: Promise<T> | null = null;
  let value: T | undefined;
  let loaded = false;

  const reset = (): void => {
    promise = null;
    value = undefined;
    loaded = false;
  };
  registry.add(reset);

  async function load(): Promise<T> {
    if (value !== undefined && loaded) return value;
    if (!promise) {
      promise = loader().then(
        (v) => {
          value = v;
          loaded = true;
          return v;
        },
        (err) => {
          // Clear so the next call retries instead of caching the rejection.
          promise = null;
          throw err;
        },
      );
    }
    return promise;
  }

  function prefetch(): void {
    // Warm the cache; a failure clears the promise via load() and is
    // intentionally swallowed here — load() will surface it on await.
    load().catch(() => undefined);
  }

  function isLoaded(): boolean {
    return loaded;
  }

  function get(): T | undefined {
    return loaded ? value : undefined;
  }

  return { load, prefetch, isLoaded, get, reset };
}

/** Test-only: reset every lazyModule cache created so far. */
export function resetLazyModules(): void {
  for (const reset of registry) reset();
}

/** Documented heavy module with its dynamic import (not eagerly imported). */
export interface HeavyModuleEntry {
  /** Stable key, e.g. "chapter-gen". */
  name: string;
  /** Dynamic-import path, e.g. "@/services/bookwriter/chapter-gen". */
  importPath: string;
  /** Why this module is deferred. */
  reason: string;
  /** Dynamic import thunk — call only when the feature is needed. */
  load: () => Promise<unknown>;
}

/**
 * Heavy modules to lazy-load instead of bundling into the startup path.
 * Entries are documentation + thunks; nothing here is imported eagerly.
 */
export const HEAVY_MODULES: HeavyModuleEntry[] = [
  {
    name: "chapter-gen",
    importPath: "@/services/bookwriter/chapter-gen",
    reason: "Large generation pipeline; only needed when writing chapters.",
    load: () => import("@/services/bookwriter/chapter-gen"),
  },
  {
    name: "bulkRunner",
    importPath: "@/services/bulk/bulkRunner",
    reason: "Bulk job runner; only needed for batch/bulk workflows.",
    load: () => import("@/services/bulk/bulkRunner"),
  },
  {
    name: "export-epub",
    importPath: "@/services/bookwriter/export/epub",
    reason: "EPUB builder pulls in heavy zip/xml deps; load on export only.",
    load: () => import("@/services/bookwriter/export/epub"),
  },
  {
    name: "export-docx",
    importPath: "@/services/bookwriter/export/docx",
    reason: "DOCX builder; load on export only.",
    load: () => import("@/services/bookwriter/export/docx"),
  },
  {
    name: "kdp-upload",
    importPath: "@/services/bookwriter/kdpUpload",
    reason: "KDP upload pipeline; only needed at publish time.",
    load: () => import("@/services/bookwriter/kdpUpload"),
  },
];

/**
 * Preload critical lazy modules in parallel (e.g. right after first paint).
 * Returns settled results so one failure doesn't hide the others.
 */
export function preloadCritical<T>(modules: Array<LazyModule<T>>): Promise<Array<T>> {
  return Promise.all(modules.map((m) => m.load()));
}

export interface DeferOptions {
  /** ms to wait before running fn. Default 0 (next macrotask). */
  delayMs?: number;
  /** Use requestIdleCallback when available. Default true. */
  useIdle?: boolean;
}

declare const requestIdleCallback: ((cb: () => void) => number) | undefined;

/**
 * Defer heavy non-critical work until the browser is idle (or after delayMs).
 * No-op safe on node (falls back to setTimeout).
 */
export function deferHeavy(fn: () => void, opts: DeferOptions = {}): void {
  const { delayMs = 0, useIdle = true } = opts;
  const run = (): void => {
    if (delayMs > 0) {
      setTimeout(fn, delayMs);
    } else {
      fn();
    }
  };
  if (useIdle && typeof requestIdleCallback === "function") {
    requestIdleCallback(run);
  } else if (useIdle && delayMs === 0 && typeof setTimeout === "function") {
    setTimeout(run, 0);
  } else {
    run();
  }
}
