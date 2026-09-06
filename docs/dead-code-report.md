# Dead-Code-Report — AI Writer Studio (Sprint 9, Agent 6)

Stand: 2026-09-06 · Methode: Export-Heuristik (alle `export`-Symbole in `src/`,
Trefferzählung via grep) + **Hand-Verifikation** jedes unten genannten Kandidaten
(Import-Suche über `src/` + `tests/`). Es wurde **nichts gelöscht**.

## Ergebnis: 0 Löschungen

Begründung: Alle verifizierten Kandidaten sind entweder öffentliche Service-API
mitPending-Verdrahtung (UI-Buttons fehlen, Service + DB-Tabelle existieren) oder
falsch-positive Treffer der Heuristik (genau 1 legitimer Verwender). Löschen wäre
ein Breaking Change bzw. würde geplante Features kappen — das verletzt die
Kehrwochen-Regel „kein Refactoring der Breite".

## Hand-verifizierte Kandidaten (Bereich tts/voice/whisper)

| Symbol | Datei | Befund | Entscheidung |
|---|---|---|---|
| `recordAndTranscribe` | `src/services/whisper/index.ts` | 0 Aufrufer in `src/`/`tests/` | **Behalten**: öffentliche STT-API; kein Diktier-Button verdrahtet bisher. Neu: 4 Tests sichern Verhalten. |
| `stopRecording` (whisper) | `src/services/whisper/index.ts` | 0 Aufrufer (Namensvetter `stopRecording` in `AudioNotes.tsx` ist eine lokale Komponentefunktion) | **Behalten**: Gegenstück zu `recordAndTranscribe`, mitgetestet. |
| `deleteVoice` | `src/services/voice/index.ts` | 0 Aufrufer (`VoiceLab.tsx` nutzt nur `createVoice`/`listVoices`) | **Behalten**: CRUD-Vervollständigung zur `voices`-Tabelle; UI-Löschbutton fehlt (Feature-Lücke, kein Dead Code). Neu: Test sichert Verhalten. |
| `toggleFavoriteVoice` | `src/services/voice/index.ts` | 0 Aufrufer (wie oben) | **Behalten**: dito (Favoriten-Toggle). Neu: Test sichert Verhalten. |
| `chunkChapterText` | `src/services/tts/batch.ts` | 1 Verwender (`batchSynthesizeBook` intern) + neue Tests | **Behalten**: bewusst exportierte, jetzt getestete Unit. |
| `listTranscriptions` / `updateTranscriptionText` / `deleteTranscription` | `src/services/whisper/index.ts` | Verwendet von `TranscriptEditor.tsx` | Kein Dead Code (No-op-Implementierung ist dokumentierte Session-Semantik). |

## Vergessene TODOs (vollständig, Stand 2026-09-06)

Kein TODO wurde entfernt oder umgeschrieben — Liste zur Ablage:

- `src/components/Fragment/FragmentPanel.tsx:77` — „in Kapitel schreiben (via projectStore)"
- `src/components/PromptGenerator/PromptGenerator.tsx:69` — „Schritt 5: echtes Kapitel im aktiven Projekt anlegen"
- `src/components/Writing/BookWriterPanel.tsx:363` — „DB-Delete implementieren"
- `src/services/bookwriter/workflow.ts:426,437` — „runDiagnostics aufrufen", „Buch-Level-Checks"
- `src/components/KIPanel/KIPanel.test.tsx:231` — Test-TODO (markierte Assertions)

## Unverifizierte Heuristik-Treffer (Repo-weit, NICHT geprüft)

Die Zählung fand 263 Exporte mit ≤ 2 Erwähnungen (von 1873). Stichprobe auffälliger
Namen zur späteren Prüfung durch die jeweiligen Feature-Owner — **keine Lösch-
empfehlung**, da Verwendung via dynamische Imports/Stores möglich ist:

`setLoggingEnabled` (logger), `regenerateChapter` (chapter-gen),
`getDocument` (documents), `reorderChapter` (project), `reorderFragment`/`getFragment`
(fragment), `deleteSuggestion` (collaboration), `deleteNode`/`deleteEdge` (semantic),
`fetchWithRetry` (resilience/retry), `queryOne`/`enqueueWrite` (db),
`parseIsbnPlaceholder`/`buildSheetRowFromFacts` (kdp/uploadSheet),
`recordGeneration`/`exportCsv`/`clearMetrics` (monitoring/metrics),
`withCorrelation`/`getCorrelationId` (monitoring/correlation),
`registerDefaultShutdownTasks` (monitoring/shutdown),
`loadAuthRecord`/`saveAuthRecord`/`clearAuthRecord` (settings),
`recoverDbBytes` (resilience/crashRecovery), `buildHitlHooks` (cli),
`relationshipsFor` (characters), `emptyDoc`/`plainParagraph` (import/tiptap),
`syncChapterSource`/`chapterPlainText` (knowledge/sync), `markAllStale` (knowledge/sources),
`runningJob`/`getJob`/`recentJobs`/`resetStaleJobs` (knowledge/jobs),
`updateCharacter`/`updateNote`/`deleteNote` (knowledge/profiles),
`deleteChunksForProject`/`embeddingModelsInUse` (knowledge/chunks),
`getTemplate` (ki/templates), `buildMemoryPrompt` (ki/memory),
`APP_PUBLISHER` (version), `ContrastMode` (i18n/highContrast),
`useModelStatus` (KIPanel), `CompareSelection` (CompareView).

Empfehlung: pro Datei vom Owner mit `ts-prune`/`unimport` gegenprüfen, bevor etwas
gelöscht wird. Nächste Kehrwoche kann diese Liste abarbeiten.
