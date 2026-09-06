# Sprint 9 Agent 3 — KDP-Publishing-Pipeline härten: Abschlussbericht

**Branch:** `sprint9/agent3-kdp` · **Basis:** Sprint-7-Dateien (`kdpUpload.ts`, `kdpCredentials.ts`, `kdpUploadTracker.ts`, `kdpUploadValidation.ts`) — gelesen, nur additiv erweitert, keine bestehenden Interfaces geändert.

## Was geliefert wurde

### 1. Upload-Retry mit Backoff + Resume (`src/services/bookwriter/kdpUploadRetry.ts`, neu)
- `computeBackoffDelay(attempt, opts)` — reine Funktion: `base * factor^(n-1)`, gedeckelt (Defaults: 1000 ms / ×2 / 30 s).
- `uploadWithRetry(file, metadata, opts)` — wiederholt `uploadToKdp` bei retrybaren Fehlern (Taxonomie: Netzwerk/Abbruch), sonst sofortiger Abbruch; liefert `{ result, attempts, retried }`. Timer via `delayFn` injizierbar (Tests ohne Wartezeit).
- `canResumeUpload(state)` — fortsetzbar nur bei Tracker-Status `uploading`/`processing` mit `startedAt` und ohne `finishedAt` (terminale Stati `live`/`rejected` und `idle` ausgeschlossen).
- `resumeUpload(state, pkg, opts)` — setzt abgebrochene Uploads ohne Re-Validierung fort: `uploading` → Transport-Retry + Poll, `processing` → nur Review-Poll; wirft bei nicht-fortsetzbarem Status.

### 2. Pre-Upload-Checkliste (`src/components/KDP/KdpPreUploadChecklist.tsx`, neu)
- `buildPreUploadChecklist({ file, metadata, isbn })` (rein, testbar): 6 Punkte — Dateiformat, Dateigröße, Metadaten (Titel/Klappentext/Keywords), Preis, Cover, ISBN. Pflicht vs. optional getrennt.
- `KdpPreUploadChecklist`-Komponente: Ampelliste mit Summary-Zähler, blockiertem Hinweis und Upload-Button, der bis zur Erfüllung aller Pflichtpunkte disabled ist. Bestehendes `KdpChecklistPanel` unverändert.

### 3. Fehlertaxonomie (`src/services/bookwriter/kdpUploadErrors.ts`, neu)
- Codes: `validation` / `format` / `rejected` / `network` / `auth` / `aborted` / `unknown` — je mit deutscher Meldung, Recovery-Hinweis und `retryable`-Flag.
- `classifyUploadError()` (Reihenfolge: auth → format → rejected → network → validation → unknown), `KdpUploadError`-Klasse, `isRetryableUploadError()`, `renderUploadFailure()` für die UI.

### 4. Tests — 31 neue Tests (gefordert: 10+)
| Datei | Tests |
|---|---|
| `kdpUploadErrors.test.ts` | 10 (Klassifikation aller Codes, Retryability, Render) |
| `kdpUploadRetry.test.ts` | 14 (Backoff ×3, Retry ×5, Resume-Guard ×3, Resume ×3) |
| `KdpPreUploadChecklist.test.tsx` | 7 (reine Checklist-Logik ×5, Komponenten-Render/Block ×2) |

## Verifikation
- Neue Tests: **31/31 grün** (`vitest run`, injizierte Fakes — 0 echte API-Calls, 0 Wartezeiten).
- Regression: **38 Testdateien / 398 Tests** in `bookwriter/`, `kdp/`, `KDP/` — alle grün.
- `tsc -p tsconfig.json --noEmit`: keine Fehler in den neuen/geänderten Dateien.

## Design-Notizen / Abweichungen
- Retry/Resume liegen in einer **neuen Datei** statt in `kdpUpload.ts`, um Breaking-Change-Risiko auf null zu halten; `kdpUpload.ts` selbst ist unberührt.
- `uploadWithRetry` akzeptiert `delayFn` sowohl top-level als auch in `retry` (Test-Komfort).
- Cover ist Pflichtpunkt der Checkliste (KDP-Review lehnt ohne Cover ab), ISBN und Preis bleiben optional mit Hinweisen.
- Während der Arbeit gefunden & gefixt: Klassifikation brauchte zusätzlich `timedout`/`abgebrochen`-Muster (deutsche Meldungen aus `uploadToKdp`-Reasons).

## Offen / Follow-up
- Echte Transport-Anbindung (`uploadFn` gegen KDP) existiert weiterhin nicht (Sprint-7-Design: kein öffentliches KDP-Upload-API) — Retry/Resume greifen, sobald sie injiziert wird.
- Optionale Persistierung des Resume-Pakets (Reload-sicher) ist vorbereitet (`pkg` + `state` sind serialisierbar), aber nicht implementiert.
