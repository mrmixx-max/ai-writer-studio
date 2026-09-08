# Sprint 20, Agent 2 — Voice-Lab: Abschlussbericht

**Modus:** `voice` — Sprachaufnahme + Transkription + Export
**Status:** ✅ fertig (kein Commit, kein Build)

## Was gebaut wurde

### 1. Voice-Lab-Engine — `src/services/voice/voiceLab.ts` (neu)
- Typen: `VoiceLabConfig`, `TranscriptionResult`, `TranscriptionSegment`
- `transcribeAudio(audioBlob, config, deps?)` — Whisper-kompatibler
  `/v1/audio/transcriptions`-Endpunkt (`verbose_json`, toleriert `{text}`-Minimalantworten);
  `fetchFn`/`endpoint` injizierbar; Auto-Punktuierung + einfache
  Sprecher-Diarisierung (alternierend Sprecher 1/2) als Post-Processing
- `startRecording(deps?)` — `getUserMedia({audio:true})` + `MediaRecorder.start()`,
  mit klaren Fehlern ohne Mikrofon-/Recorder-Support
- `stopRecording(recorder)` — sammelt `dataavailable`-Chunks, löst beim
  `stop`-Event mit `Blob` auf
- `exportTranscription(result, format)` — TXT (eine Zeile pro Segment),
  SRT (`HH:MM:SS,mmm`), VTT (`WEBVTT`-Header, `<v>`-Sprecher-Tags);
  Helfer `formatSrtTimestamp` / `formatVttTimestamp` / `punctuate` exportiert
- Keine neuen Dependencies, keine Änderung an bestehenden Services/Stores

### 2. VoiceLab-Panel — `src/components/VoiceLab/VoiceLabPanel.tsx` (neu)
- Großer roter Aufnahme-Button, Stop-Button, Timer (MM:SS), Canvas-Waveform
  (AnalyserNode, Accent-Farbe, degradiert lautlos ohne AudioContext),
  scrollbare Transkript-Anzeige, Sprachauswahl DE/EN, Modell-Feld,
  Audio-Playback, Export TXT/SRT/VTT (Download), „Im Editor öffnen“
  (Default: `useEditorStore.insertAtEnd`, per Prop überschreibbar),
  Retry-Button „Erneut transkribieren“ im Fehlerfall
- `transcribe`-Prop injizierbar (Tests); Bloomberg-Stil inline
  (`#000` / `#ffa028` / `#333`, IBM Plex Mono)
- Bestehendes `VoiceLab.tsx` (voices-Modus) unangetastet

### 3. Sidebar-Mode `voice`
- `src/types/mode.ts`: Union um `"voice"` erweitert
- `src/components/Sidebar/Sidebar.tsx`: MODES-Eintrag
  `{ id: "voice", icon: "🎙️", label: "Voice Lab", description: "Sprachaufnahme + Transkription" }`,
  lazy importiert, `ModePanel`-Case **vor** dem Kapitel-Guard (standalone ohne
  offenes Kapitel), `"voice"` in `WIDE_EXTRA_MODES`
- Labels `sidebar.mode.voice` in `de.ts` / `en.ts` / `es.ts` / `fr.ts`

## Tests (15 neu, alle grün)
- `src/services/voice/voiceLab.test.ts` — 10 Tests: `transcribeAudio` mit
  gemocktem fetch (Result + FormData-Assert), HTTP-Fehler, Textaufbau aus
  Segmenten + Optionen, SRT-Exaktheit, TXT/VTT, Sprecher-Darstellung,
  Zeitstempel, Punktuierung, `startRecording`-Mock, `stopRecording`-Blob
- `src/components/VoiceLab/VoiceLabPanel.test.tsx` — 5 Tests: Rendering aller
  UI-Elemente, DE/EN-Optionen, deaktivierte Exporte ohne Transkript,
  Fehler ohne Mikrofon, Record→Stop→Transkript-Flow mit Editor-Callback

## Verifikation
- `npx tsc --noEmit` — sauber
- `vitest run` (voiceLab, VoiceLabPanel, Sidebar/navigation) — 24/24 grün
- Sidebar-Suite gesamt: 62/64 — die 2 Fehler in `sidebar.bilingual.test.tsx`
  sind **vorbestehend** (veralteter `projectStore`-Mock: erwartet Store ohne
  Selektor-Form; von dieser Arbeit unberührt, gleicher Fehler auf HEAD)

## Hinweise / Offen
- Transkriptions-Endpunkt-Default `http://localhost:11434/v1/audio/transcriptions`
  ist per `deps.endpoint` bzw. Modell-Feld im Panel anpassbar; kein
  Settings-UI verdrahtet (bewusst außerhalb des Auftrags)
- Hinweis an Nachbar-Agenten: parallele MODES-/Locale-Edits (templates/collab)
  wurden per Re-Read + Deduplizierung zusammengeführt; `es.ts`/`fr.ts` enthalten
  jetzt alle Keys
