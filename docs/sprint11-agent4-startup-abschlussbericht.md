# Sprint 11 — Agent 4 (Retry): Startup-Performance — Abschlussbericht

**Stand:** 2026-09-06 · **Scope:** App-Shell only (`src/App.tsx`), keine Komponenten-Rewrites ·
**Eigentümer-Konflikt:** keiner — Settings/i18n (Sibling-Agent) unangetastet.

## 1. Befund: Wo hängen BookWriter-/KDP-Panels am Startup?

| Panel | Import-Ort | Status |
|---|---|---|
| `BookWriterPanel` | `BookWriterDashboard.tsx` → `ClassicBookWriterPanel = lazy(...)` | bereits lazy ✅ |
| `BookWriterDashboardPanel` / `BookWriterRecoveryDialog` | `Sidebar.tsx` / `App.tsx` | bereits lazy ✅ |
| `KdpChecklistPanel` | `Sidebar.tsx` | bereits lazy ✅ |
| `KdpPackagePanel` (Sprint 11, Agent 3) | **nirgends verdrahtet** (Standalone) | kein Startup-Einfluss ✅ |
| `LektoratPanel` (Sprint 11, Agent 2) | **nirgends verdrahtet** (Standalone) | kein Startup-Einfluss ✅ |
| `KIPanel`, `ExportBar` | `src/App.tsx` (synchron!) | **Regression — gefixt** 🔧 |

Die Shell (`App` + `Sidebar` + `Dashboard`) war bereits fast vollständig lazy.
Die einzigen verbliebenen synchronen Schwergewichte im Main-Bundle waren
`KIPanel` (zieht LLM-/KI-Servicegraph + `AIWritingAssistant`) und `ExportBar`
(zieht Export-/Preflight-Libs). Beide sind für die erste Darstellung nicht
kritisch (Seitenpanel / Header-Dialog) → exakt die erlaubten max. 2 Module.

Bewusst **nicht** angefasst: `Editor` (inkl. tiptap-Chunk, kritisch für First
Paint), `Sidebar` (Modus-Verdrahtung ist per `navigation.test.ts` /
`bookwriterMode.test.ts` quellgeprüft — z. B. muss
`mode === "bookwriter") return <BookWriterDashboardPanel/` byte-identisch
bleiben), sowie die unwired Sprint-11-Panels (Verdrahtung ist Produktarbeit
der Eigentümer-Agenten; synchrones Einbinden wäre eine Regression).

## 2. Änderung (nur `src/App.tsx`)

- `KIPanel` + `ExportBar`: statischer Import → `React.lazy()` + `Suspense`
  (Fallback-Platzhalter `KI-Panel lädt…` / `Export…`, Layout- und
  Tastaturwege unverändert, keine Prop-/Logikänderung).
- `lazy`/`Suspense` waren bereits importiert; keine neuen Dependencies.

## 3. Messung: `npx vite build`, `dist/assets` (vorher → nachher)

| Chunk | vorher | nachher | Δ |
|---|---|---|---|
| Main-Einstieg (`index-*.js`) | 322,49 kB (`index-EDNn8Pgn.js`, 324.769 B raw) | 220,93 kB (`index-Br6yFQdT.js`, 222.134 B raw) | **−102.635 B (−31,6 %)** |
| `KIPanel-D0rcUGkd.js` (+ CSS) | im Main-Bundle (synchron) | eigener Chunk, 38.452 B JS | ausgelagert ✅ |
| `ExportBar-D9b0TWmJ.js` | im Main-Bundle (synchron) | eigener Chunk, 2.652 B JS | ausgelagert ✅ |
| `index-DVTU5Bur.js` | 346,40 kB | 346,40 kB | ±0 |
| `index-DtfFThju.js` | 433,78 kB | 433,78 kB | ±0 |
| `tiptap-DTqVEWcw.js` | 440,42 kB | 440,42 kB | ±0 (Editor bleibt bewusst synchron) |
| `jszip.min-SPD4npON.js` | 97,42 kB | 97,42 kB | ±0 (separat, unverändert) |
| `dist/assets` gesamt (nachher) | — | 2.946.694 B, 79 Dateien | − |

Netto: Main-Einstieg um rund ein Drittel kleiner; Rest (KIPanel 38 kB,
ExportBar 2,6 kB) lädt erst bei Bedarf nach. tiptap bleibt der größte Chunk —
dessen Lazy-Auslagerung hieße Leeredarstellung des Editors und ist
außerhalb des Shell-Auftrags.

## 4. Absicherung

- **Neu:** `tests/startup-perf.test.ts` (7 Tests, deterministisch, ohne Build):
  kein synchroner Import der Lazy-Module in `App.tsx` (kommentarbereinigt),
  `lazy()`-Verdrahtung vorhanden, Suspense-Grenzen ≥ 4, Sidebar-BookWriter/KDP
  bleiben lazy, plus dist-Chunk-Decke 1,5 MB (greift nur bei vorhandenem
  Build-Artefakt, skipped in CI ohne `dist/`).
- **Verifiziert:** `npx tsc --noEmit` ✅ · `vitest run` (startup-perf +
  navigation + bookwriterMode): **22/22 grün** ✅

## 5. Geliefert (3 Pfade)

1. `src/App.tsx` (M) — 2 Lazy-Konvertierungen + Suspense.
2. `tests/startup-perf.test.ts` (neu) — Startup-Guard.
3. `docs/sprint11-agent4-startup-abschlussbericht.md` (neu) — dieser Bericht.

`git status --short` listet alle drei Pfade (Nachweis siehe Arbeitslog).
