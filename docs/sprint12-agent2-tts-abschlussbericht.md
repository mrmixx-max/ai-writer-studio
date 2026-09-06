# Sprint 12 — Agent 2: TTS-Queue Abschlussbericht

## Auftrag
Queue-Management für WebSpeech-TTS in `src/services/tts/`: sequenzielle
Sprechqueue mit Cancel/Skip/Reorder, pro-Item Voice + Rate, Progress-Callbacks,
graceful Handling ohne WebSpeech (Feature-Detect + stiller No-Op mit Warnung, nie throw).
TDD mit gemockter speechSynthesis (kein echtes Audio).

## Bestand gelesen
- `src/services/tts/tts.ts` — Provider-Interface + Factory (openai-tts, edge-tts, piper)
- `src/services/tts/batch.ts` — Buch-Batch (Chunking + sequenzielle Synthese, eigener Cancel-Mechanismus)
- `src/services/tts/tts.test.ts`, `tts.providers.test.ts`, `batch.test.ts` — 26 bestehende Tests, alle grün

## Geliefert
- **Neu: `src/services/tts/queue.ts`** (~230 Zeilen)
  - `SpeechQueue` + `createSpeechQueue()`-Factory
  - API: `enqueue()`, `remove(id)`, `reorder(id, toIndex)`, `skip()`, `cancel()`/`clear()`,
    `getQueue()`, `size`, `isSpeaking`, `currentId`, `isSupported()`, `onProgress()`
  - Sequenziell: `onend`/`onerror` rücken automatisch zum nächsten Item vor, am Ende `queue-done`
  - Pro Item: `voice` (best-effort Match per `name`/`voiceURI` aus `getVoices()`), `rate` (geclampt 0.1–10)
  - Progress-Phasen: `started | ended | skipped | cancelled | queue-done | error`
  - Ohne WebSpeech: jede Methode No-Op mit `console.warn`, **nie throw**; `cancel()` setzt lokalen Zustand trotzdem zurück
  - Listener-Fehler werden geschluckt (Queue läuft weiter); `speak()`-Throw wird als `error`-Event gemeldet
- **Neu: `src/services/tts/queue.test.ts`** — 15 Tests, gemockte `speechSynthesis` + `SpeechSynthesisUtterance`, null echtes Audio
- **Fix:** unlesbares Ternary in `enqueue()` zu `playFrom(currentIndex === -1 ? 0 : currentIndex)` vereinfacht

## Verifikation
- `npx vitest run src/services/tts/` → **4 Files, 41 Tests, alle grün** (26 Bestand + 15 neu)
- `npx tsc --noEmit` → sauber, keine Fehler
- `git status --short` → nur eigene Dateien (siehe Self-Check)

## Testliste (15 neu)
Ohne WebSpeech (3): isSupported=false; enqueue gibt ID ohne throw; cancel/skip/clear No-Op mit Warnung.
Mit Mock (12): sofortiges Sprechen + started; Voice-Match; unbekannte Stimme bricht nichts ab;
Rate-Anwendung; onend-Sequenz bis queue-done; skip→skipped+next; cancel→cancelled+leer;
remove (aktuell geschützt, unbekannt=false); reorder (ok/unbekannt/Out-of-Range);
onerror→error+weiter; werfender Listener stoppt nichts; Factory mit Listener.

## Abgrenzung / Offen
- Nur `src/services/tts/` angefasst; `whisper/` und alles andere unberührt
- Kein UI, keine echte WebSpeech-Integration im Browser getestet (nur Mock)
- Batch (`batch.ts`) und Queue sind bewusst getrennt: Batch = Datei-Synthese via Provider, Queue = Live-Vorlesen via WebSpeech
