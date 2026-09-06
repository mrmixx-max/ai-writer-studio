# Sprint 9 Agent 4 — Local-Model-Manager-GUI: Abschlussbericht

Branch: `sprint9/agent4-models` · Stand: 2026-09-06

## Geliefert

1. **`src/services/ollama/modelManager.ts`** (neu, ~230 Zeilen)
   - `listInstalledModels(baseUrl?)` — `GET /api/tags`, liefert `InstalledModel[]`
     (name, size, digest, modifiedAt, parameterSize, quantization). Fehlendes
     `models`-Feld → `[]` statt Crash.
   - `pullModel(name, onProgress?, {baseUrl, signal})` — `POST /api/pull`
     (`stream:true`), parst den NDJSON-Stream zeilenweise, meldet
     `PullProgress {status, completed, total, percent}`; `percent` ist `null`
     ohne `total`, `100` bei `success`. `error`-Zeilen und Stream-Ende ohne
     `success` werfen `ModelManagerError` (kein stiller Erfolg). Abbruch via
     `AbortSignal` wird als `AbortError` durchgereicht.
   - `deleteModel(name, {baseUrl})` — `DELETE /api/delete`; 404 → sprechende
     Meldung („nicht installiert“).
   - `formatModelSize(bytes)` — deutsche Formatierung (B/KB/MB/GB/TB,
     Komma-Dezimal); ungültig → „–“.
   - `isLowDiskSpace(freeBytes, threshold?)` — Default-Schwelle 10 GB
     (`LOW_DISK_THRESHOLD_BYTES`).
   - Konstanten: `DEFAULT_OLLAMA_BASE_URL = http://127.0.0.1:11434`,
     `OLLA­MA_MODELS_DIR_HINT = D:\ollama\models` (nur Anzeige).
   - Alle Fehler als `ModelManagerError` mit deutscher Nachricht inkl.
     `ollama serve`-Hinweis bei Nichterreichbarkeit.

2. **`src/components/Settings/ModelManager.tsx`** (neu, standalone)
   - Liste mit Größe/Parametern, Gesamtgröße, Aktualisieren-Button.
   - Pull per Namenseingabe (Enter/ Button) + `<progress>`-Balken mit
     Prozent + Status + Abbrechen-Button.
   - Delete mit `window.confirm`-Rückfrage, optimistisches Entfernen aus der Liste.
   - Warnbanner (`role="alert"`) bei `freeDiskBytes` unter der Schwelle;
     `freeDiskBytes = null` (Default) = keine Warnung. Bestehende
     `SettingsPanel.tsx` wurde **nicht** umgebaut (nur `settings.css`
     wiederverwendet); Einbettung als `<ModelManager />` ist trivial möglich.

3. **`src/services/ollama/modelManager.test.ts`** (neu) — **19 Tests**,
   alle mit global gemocktem `fetch` (kein echter Pull/Delete möglich):
   Liste (6: Erfolg, leer, fehlendes Feld, HTTP-500, Server aus, eigene baseUrl),
   Pull (6: Prozent-Fortschritt, percent-null, error-Zeile, HTTP-Fehler,
   ohne Callback, Leername ohne Request), Delete (3: Methode/Body, 404,
   Leername), Format (2), Low-Disk (2).

## Verifiziert

- `vitest run src/services/ollama/modelManager.test.ts` → **19/19 grün**.
- `eslint` auf allen 3 neuen Dateien → Exit 0.
- `tsc --noEmit` → keine Fehler in den neuen Dateien.
- Keine Breaking Changes: nur neue Dateien, keine bestehenden geändert.

## Bekannt / fremdverursacht (nicht angefasst)

- `src/i18n/locales/de.ts` (u. a.) ist im Shared Tree von einem anderen Agenten
  kaputt editiert (unescaped `„…"` in Zeile 67 → Parse-Error); dadurch schlagen
  `tsc` (15 Fehler) und `SettingsPanel.test.tsx` (Suite-Fail) aktuell fehl.
  Betrifft meine Dateien nicht; Fix obliegt dem verursachenden Agenten.

## Offen / Vorschlag

- `freeDiskBytes` muss noch aus einer echten Quelle gespeist werden
  (Tauri-FS-API); Komponente ist dafür vorbereitet (Prop).
- Optionale Einbettung in `SettingsPanel.tsx` als `<ModelManager />`
  (ein Import + eine Zeile), sobald de.ts wieder parst.
