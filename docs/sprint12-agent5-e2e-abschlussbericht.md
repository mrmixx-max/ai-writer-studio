# Sprint 12 — Agent 5 (Retry): E2E Runde 2 — Abschlussbericht

**Status: abgeschlossen. 6 neue Spec-Dateien, 15 Tests, alle grün (headless, Chromium).**
Eigene Specs grün — einzeln UND im Vollsuite-Lauf (`npx playwright test e2e/`).

## Vollsuite-Einordnung (wichtig)

Im Vollsuite-Lauf bestehen alle 15 neuen Tests; 14 Fehler liegen ausschließlich in
**pre-existing Specs** (`ai`, `book-complete-flow`, `error-recovery`, `export`,
`job-recovery`, `project`, `style-tone`) — z. B. findet `project.spec.ts` den
„+ Projekt“-Button nicht mehr (Timeout in `helpers.ts:49`), reproduzierbar auch
isoliert. Ursache: Stand des geteilten Baums (Sibling-Änderungen an `src/`,
`Sidebar.tsx` seit 16:46 Uhr unverändert von mir). Agent 5 hat **keine einzige
`src/`-Datei modifiziert** (nur untracked `e2e/` + `docs/` hinzugefügt) und kann
diese Fehler per Konstruktion nicht verursacht haben; die betroffenen Specs
wurden bewusst nicht angefasst (fremde Zuständigkeit).

## Gelieferte Specs (`e2e/`)

| Datei | Tests | Was wird geprüft |
|---|---|---|
| `lektorat-findings.spec.ts` | 3 | Befunde offline (Wiederholung + Füllwort), Umformulierung via gemockter `CompleteFn` (Prompt belegt, 0 echte Calls), sauberer Text → 0 Befunde |
| `kdp-manifest.spec.ts` | 3 | Manifest-Vorschau (Dateien, SHA256-64-Hex, Titel), `verifyBundleHashes` ok, ohne Cover: `canUpload=false` |
| `help-overlay.spec.ts` | 3 | Öffnen per Shift+F1, Schließen per Escape, Schließen per Button, Suche (`searchHelp`: Treffer / leer / alles) |
| `goal-tracker.spec.ts` | 2 | Tagesziel setzen → Fortschrittsbalken + Zielwert, Entfernen → Roundtrip zur Eingabe |
| `updater-offline.spec.ts` | 2 | App-Updates-Sektion im Idle-Status, Check offline → Fehler-Status statt Crash, App bedienbar |
| `kdp-checklist.spec.ts` | 2 | KDP-Modus zeigt Checkliste mit Einträgen, Zusammenfassung mit Fortschritt |

## Muster (aus `mock-ollama.ts` / `offline-boot.spec.ts` übernommen)

- `pinGerman` per `addInitScript(localStorage app-lang=de)` — sonst flaky Selektoren.
- `goOffline`: route-Prädikat auf Host + `port !== "1420"` — keine Pfad-Globs (treffen eigene Module).
- `gotoApp` / `createProjectWithChapter` aus `helpers.ts` wiederverwendet, keine Duplikate.
- Echte Service-Logik im echten Browser via `page.evaluate(await import("/src/..."))`
  (Vite-Dev transformiert; `@/`-Alias wird zur Transform-Zeit aufgelöst — verifiziert).
  Seeding (`createRun`/`saveArtifact`) nutzt echte Services, keine Mocks.

## Befunde (alle in den Specs dokumentiert / behandelt)

1. `verifyBundleHashes(manifest, payloads)` — Signatur nimmt Manifest + Payload-Map, nicht Bundle.
2. `manifest.files` enthält nur Manuskript + Cover; `kdp-manifest.json` entsteht erst beim ZIP-Pack
   (`KDP_BUNDLE_MANIFEST_NAME`-Konstante asserted).
3. KDP-Checkliste braucht Bookwriter-Lauf + Metadaten-Artefakt — Spec seedet beides per Service.
4. Analytics-Balken bei 0 % Breite ist für Playwright „hidden“ → per `toHaveCount` asserted.
5. `UpdateCheck`-Mount wirft im reinen Browser `transformCallback` (Tauri-`listen()` ohne Backend) —
   bekanntes Browser-Rauschen, per Filter mit Begründung ausgenommen (Präzedenz: `smoke.spec.ts`
   filtert `ERR_CONNECTION_REFUSED`); kein ErrorBoundary, Status geht graceful auf Fehler.

## Dateien auf Disk

- `e2e/lektorat-findings.spec.ts`, `e2e/kdp-manifest.spec.ts`, `e2e/help-overlay.spec.ts`,
  `e2e/goal-tracker.spec.ts`, `e2e/updater-offline.spec.ts`, `e2e/kdp-checklist.spec.ts`
- `docs/sprint12-agent5-e2e-abschlussbericht.md` (dieser Bericht)
- Nachweis: `git status --short` listet alle 6 Specs + Bericht als untracked.
