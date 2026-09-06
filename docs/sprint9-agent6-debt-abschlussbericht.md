# Sprint 9 — Agent 6: Tech-Debt-Kehrwoche (Abschlussbericht)

Branch: `sprint9/agent6-debt` · Datum: 2026-09-06 · Prinzip: konservativ, keine Breaking Changes.

## 1. `__dirname`-Warning in vitest.config.ts — gefixt

`path.resolve(__dirname, …)` (2 Stellen: `@`-Alias, sql.js-WASM-Stub) ersetzt durch
`path.resolve(import.meta.dirname, …)`. Kein Verhaltenswechsel (gleicher absoluter
Pfad, Node 22 unterstützt `import.meta.dirname`), ESM-sauber, keine Warnung mehr.
Verifiziert: betroffene Test-Suites lösen `@`-Imports und WASM-Stub weiter auf (35/35 grün).

## 2. Coverage-Lücken tts/voice/whisper — 35 neue Tests (Soll: 8+)

| Datei | Tests | Technik |
|---|---|---|
| `src/services/tts/tts.providers.test.ts` (neu) | 12 | `fetch` via `vi.stubGlobal` gemockt |
| `src/services/tts/batch.test.ts` (neu) | 9 | reine Chunking-Units + Batch-Ablauf mit Mock-fetch |
| `src/services/voice/voice.test.ts` (neu) | 4 | echte Test-DB (`initDb`, sql.js In-Memory) |
| `src/services/voice/audioNotes.test.ts` (neu) | 4 | Test-DB + `FileReader`-Mock (inkl. FK-Fallstrick, s. u.) |
| `src/services/whisper/whisper.test.ts` (neu) | 6 | `SpeechRecognition`-Mockklasse auf `window` |
| Bestand `tts.test.ts` | 5 | unverändert, weiter grün |

Abgedeckt u. a.: `isAvailable`-Fehlerpfade aller 3 Provider, Input-Trunkierung (4096),
Piper-Fallbackstimme, Satz-/Wort-Chunking ohne Textverlust, Batch-Fortschritt +
`cancelled`-Phase, Voice-CRUD + Favoriten, Audio-Memo CRUD + Kapitel-Isolation,
Transkript-Erfolg/-Fehler/No-ops, `stopRecording`-No-op. **Kein echtes Audio/Netz.**
Bewusst ungetestet: `startMemoRecording` (braucht `MediaRecorder` + Mikrofon).

Fallstricke: DB ist ein Singleton — Tests räumen per `DELETE FROM` in `beforeEach`
auf (Muster aus `project/index.test.ts`); `audio_notes.chapter_id` hat FK auf
`chapters(id)`, daher wird ein echtes Projekt + Kapitel angelegt.

Ergebnis: **35/35 grün**, ESLint sauber, `tsc --noEmit` meldet nur fremde
Sibling-Änderungen in `src/i18n/locales/` (nicht angefasst).

## 3. Dead-Code-Report — 0 Löschungen

Siehe `docs/dead-code-report.md`. Hand-verifizierte Kandidaten
(`recordAndTranscribe`, `stopRecording`, `deleteVoice`, `toggleFavoriteVoice` —
alle 0 Aufrufer) wurden **behalten**: öffentliche Service-API mit fehlender
UI-Verdrahtung bzw. CRUD-Vervollständigung; Löschen wäre ein Breaking Change.
Alle vier sind nun durch die neuen Tests gesichert. Alle 7 TODOs unverändert
dokumentiert. Löschbegründungen entfallen daher (keine Löschung erfolgt).

## 4. docs-Konsolidierung — Index angelegt, nichts gelöscht

`docs/README.md` neu: Einstieg, Qualität/Sicherheit, chronologische Sprint-Berichte,
Delivery-Logs. Alle bestehenden Berichte unangetastet.

## Geänderte Dateien (nur eigene)

- `vitest.config.ts` (2 Zeilen)
- 5 neue Testdateien (s. o.), `docs/dead-code-report.md`, `docs/README.md`, diese Datei
