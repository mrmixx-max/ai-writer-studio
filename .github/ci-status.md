# CI-Status — was jeder Job macht, lokale Repro, Fehler → Fix

Stand: 2026-09-06 (Sprint 10, Agent 5). Workflows: `.github/workflows/ci.yml` (Linux) + `verify.yml` (Windows).
Stack: npm (mit `package-lock.json`, **immer** `--legacy-peer-deps`), Node **22** in beiden Workflows.

## Jobs

| # | Job (CI, ubuntu) | Was läuft | Repro lokal |
|---|---|---|---|
| 1 | Lint + Typecheck | `npm run typecheck` (tsc --noEmit), `npm run lint` (ESLint) | `npm run typecheck && npm run lint` |
| 2 | Unit-Tests | `npm run test` = `vitest run` (ohne Coverage, schnell) | `npm run test` |
| 3 | Coverage-Gates | `npm run test:coverage` — Ratchet-Minima aus `vitest.config.ts` | `npm run test:coverage` |
| 4 | Build | `npm run build` (tsc + vite build), dist-Artefakt (7 Tage) | `npm run build` |
| 5 | Playwright E2E | `npx playwright test` — Chromium vs. Vite-Dev-Server (Port 1420, In-Memory-DB, kein Tauri nötig); Browser-Cache via `actions/cache` | `npx playwright test` |
| 6 | Release-Assets | `npm run release:check` = Versions-Sync package.json ↔ tauri.conf.json ↔ Cargo.toml | `npm run release:check` |
| – | Verify (Windows) | Typecheck → Lint → Test (`--maxWorkers=2`) → Build auf `windows-latest`; dist-Artefakt nur bei Push auf main/master | auf Windows: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` |

Alle Jobs: eigene npm-Caches (`cache-dependency-path: package-lock.json`), `timeout-minutes`, `cancel-in-progress` bei neuem Push, Statuszeile in `$GITHUB_STEP_SUMMARY`. Jobs laufen parallel (kein `needs`), damit ein langsamer E2E-Job schnelles Lint-Feedback nicht blockiert.

## Bewusst NICHT in CI

- `npm run release` (Voll-Pipeline mit ZIP) — läuft lokal/auf Windows, braucht kein Secret, aber dauert lang.
- `scripts/build-windows.ps1` (Tauri-EXE + Installer) — nur manuell für Releases, nie in Push-CI (Rust-Toolchain + Minuten Bauzeit).
- Tauri-E2E gegen die EXE — Playwright testet bewusst nur den Browser-Fallback (In-Memory-DB).

## Bekannte Fehler → Fix (Stand heute, per `gh run view` verifiziert)

1. **Verify/Windows: alle vitest-Worker sterben mit `TypeError: webidl.util.markAsUncloneable is not a function`**
   Ursache: Node 20 + jsdom ≥ 30 + vitest 4. Fix (umgesetzt): `verify.yml` auf Node 22 angehoben — Linux-CI (Node 22) war schon grün.
2. **E2E: 13/23 Playwright-Tests rot — `waiting for locator('#app-sidebar button').filter({ hasText: '+ Projekt' })` (`e2e/helpers.ts:49`)**
   Ursache: App-seitig — Sprint-9-i18n hat das Sidebar-Label umbenannt, der Helper sucht noch den alten Text. Retries (2×) heilen das nicht, es ist deterministisch.
   Fix (offen, **App-Code, nicht CI**): Selektor auf `data-testid` oder aktuellen i18n-Key umstellen — an das zuständige Agenten-Team übergeben. CI-seitig nur dokumentiert + Report-Artefakt.
3. **Coverage-Gate rot nach neuem Service/Component ohne Tests**
   Die Schwellen in `vitest.config.ts` sind Ratchet-Minima (services ~58/47/58/59, components niedrig) — **nicht** die 80 %/60 %-Ziele aus der Roadmap. Fix: Tests nachziehen oder Schwelle bewusst anheben, nie still senken.
4. **`npm ci` löst Peer-Deps nicht auf** → immer `npm ci --legacy-peer-deps` (Tauri-Pinning). Ohne Flag bricht schon der Install-Step.
5. **Playwright: Browser fehlt / Download langsam** → `npx playwright install --with-deps chromium`; CI cached `~/.cache/ms-playwright` per package-lock-Hash.
6. **`Node.js 20 is deprecated`-Warnung bei actions/*@v4** → nur Kosmetik (Runner erzwingt Node 24 für die Actions selbst); verschwindet mit zukünftigen Actions-Major-Releases, kein Handlungsbedarf.
7. **Windows: vitest-Flakiness (Handles/OOM)** → Verify nutzt `--maxWorkers=2`. Lokal bei Hängern: `npx vitest run --maxWorkers=2 <datei>`.

## Nach einem roten Run (read-only, keine Waste-Runs triggern)

```bash
gh run list --limit 10
gh run view <RUN-ID>              # Job-Übersicht + Annotationen
gh run view <RUN-ID> --log-failed # nur die fehlgeschlagenen Steps
```

Branch Protection und Secrets werden nicht angefasst (keine Rechte, kein Bedarf).
