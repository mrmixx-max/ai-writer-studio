# Sprint 10 — Agent 5: CI-Härtung (Abschlussbericht)

Datum: 2026-09-06 · Repo: mrmixx-max/ai-writer-studio · Scope: nur `.github/` + `docs/` (kein App-Code, keine Secrets, keine Branch Protection).

## Geändert

- `.github/workflows/ci.yml` — neu strukturiert: 6 klar benannte Jobs (1 Lint+Typecheck / 2 Unit vitest / 3 Coverage-Gates / 4 Build+dist / 5 Playwright-E2E / 6 Release-Versions-Check), parallel ohne `needs`-Kette, `concurrency/cancel-in-progress`, `timeout-minutes`, npm-Cache mit `cache-dependency-path`, Playwright-Browser-Cache, `$GITHUB_STEP_SUMMARY`-Zeile pro Job. Irreführendes altes Coverage-Label („≥ 80 %/60 %“) korrigiert (Ratchet-Minima, Details in ci-status.md).
- `.github/workflows/verify.yml` — **Node 20 → 22** (Root-Fix, s. u.), npm-Cache gepinnt, Tests mit `--reporter=basic --maxWorkers=2`, PowerShell-Summary-Step, Doku-Header (warum Windows, warum kein E2E).
- `.github/ci-status.md` — neu: Job-Tabelle + lokale Repro-Befehle, „bewusst nicht in CI“, 7 dokumentierte Fehler → Fix, read-only `gh`-Diagnosebefehle.

## Verifiziert (read-only, keine Runs getriggert)

- `gh run list/view`: Linux-Quality-Job auf main grün (2:00), E2E rot (13 failed / 9 passed / 1 skipped, 7.8 m), Verify/Windows rot im Test-Step. YAML beider Workflows maschinell geparst (YAML OK).
- Fehler 1 — Verify: `TypeError: webidl.util.markAsUncloneable is not a function` in **allen** vitest-Fork-Workern, nur Windows/Node 20; Linux/Node 22 grün → Node-22-Bump ist der korrekte Fix.
- Fehler 2 — E2E: alle 13 Failures identischer Timeout am Selektor `'+ Projekt'` (`e2e/helpers.ts:49`, 2 Retries heilen nichts) → deterministischer App-/i18n-Bruch aus Sprint 9, **außerhalb meines Scopes** (e2e/ + src/ dürfen nicht angefasst werden). Dokumentiert + Report-Artefakt bleibt erhalten; Fix an App-Team übergeben.

## Offen / an andere Agents

- E2E-Selektor auf `data-testid`/i18n-Key umstellen (App-Seite) — danach sollte CI komplett grün sein.
- Optional später: Coverage-Ratchet Richtung 80/60 %-Roadmap anheben (mit Tests, nie durch Senken).

## Tests

tests_added: 0 (CI-/Doku-Task; keine App-Tests angefasst oder hinzugefügt).
