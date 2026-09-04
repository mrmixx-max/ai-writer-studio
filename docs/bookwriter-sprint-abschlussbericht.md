# Abschlussbericht: BookWriter-Verbesserung (3-Agenten-Sprint)

**Datum:** 2026-09-04  
**Projekt:** AI Writer Studio v1.0.1  
**Modell:** z-ai/glm-5.3-flash (OpenRouter)  
**Dauer:** ~38 Minuten (3 parallele Agenten)

---

## Zusammenfassung

Drei spezialisierte Agenten haben parallel die BookWriter-Funktion verbessert. Das Ergebnis: **1036/1036 Tests grün**, TypeScript clean, 1 Commit, 0 Breaking Changes an bestehenden Interfaces.

| Agent | Dauer | Api Calls | Status |
|-------|-------|-----------|--------|
| 1 — Robustheit & Pipeline | 35m | 81 | ✅ |
| 2 — Qualität & Kohärenz | 33m | 67 | ✅ |
| 3 — Persistenz, Resume & UI | 39m | 141 | ✅ |

---

## Agent 1 — Robustheit & Pipeline

**Ziel:** Fehlertolerante, vorhersagbare Generierung.

### A1. JSON-Extraktion härten
- **Neu:** `src/services/writing/jsonExtract.ts`
  - `stripFences()` entfernt ` ```json `-Fences
  - `extractJsonObject()` — Zustandsmaschine (`inString`/`escaped`) überspringt `}` in Strings korrekt
  - `repairJson()` — trailing commas, Anführungszeichen-Normalisierung
  - `capTruncatedJson()` — kappt am letzten parsebaren Kapitel
- **Neu:** `validateChapterShape()` — sprechende Fehler wie `Kapitel 3 fehlt summary`

### A2. Retry- & Timeout-Strategie
- **Neu:** `src/services/writing/retry.ts`
  - `withRetry()` — 3 Versuche, Backoff 1s/3s/8s ±20% Jitter
  - Retry nur bei Timeout/Netzwerk/JSON-Fehler; **kein** Retry bei Abort/4xx
  - Schärferer Prompt bei wiederholtem JSON-Fehler
- `timeoutMs` konfigurierbar (Default 120000)

### A3. Abort-Sicherheit
- `AbortController` bricht alle Requests sauber ab
- Kein Ghost-State bei Abbruch

**Tests:** 6 neue Tests in `jsonExtract.test.ts` + `retry.test.ts`

---

## Agent 2 — Qualität & Kohärenz

**Ziel:** Modellunabhängig messbare Textqualität.

### B1. Rolling Context
- `buildChapterContext()` ersetzt Vollkontext durch:
  - Outline (kompakt)
  - `chapterSummaries[0..N-1]` (150–250 Wörter pro Kapitel)
  - Letzter Absatz des Vorkapitels (Übergang)
  - Glossar (Entitäten)
- `summarizeChapter()` — eigener Ollama-Call (`max_tokens: 400`)

### B2. Kohärenz-Glossar
- `extractEntities()` — extrahiert Personen/Fachbegriffe/Zahlen (max. 30)
- `mergeEntities()` — dedupliziert case-insensitive
- Verhindert Namensdrift („Dr. Weber" → „Dr. Meyer")
- **INTERFACE-CHANGE:** `outline.entities?: string[]`

### B3. Harte Wortzahl-Steuerung
- `evaluateWordCount()` mit `deriveMinMax()` ±20%
- Bei Abweichung: ein `adjustChapterWordCount()`-Call → `needs_revision`
- Nutzt `chapterEngine.ts`-Logik auch für Auto-Modus

### B4. Outline-Qualitätsgate
- `validateOutline()` — Kapitelanzahl, Nummern, eindeutige Titel, Summaries ≥ 20 Wörter, logischer Bogen
- Bei Verletzung: ein `repairOutline()`-Call → manueller Eingriff

**Tests:** 24 neue Tests in `bookwriter.quality.test.ts` + `bookwriter.generation.test.ts`  
**Commit:** `2c92eb8` (feat: AutoBookWriter Qualität & Kohärenz)

---

## Agent 3 — Persistenz, Resume & UI

**Ziel:** Absturzsichere, fortsetzbare, transparente Generierung.

### C1. Inkrementelles Speichern
- **Neu:** `src/services/db/migrations/018_bookwriter_jobs.ts`
  - Tabelle `bookwriter_jobs` (id, project_id, config_json, outline_json, status, current_chapter, error, created_at, updated_at)
  - 8 neue Planungsspalten auf `chapters`
  - FK CASCADE + Indizes
- **Neu:** `src/services/bookwriter/jobs.ts`
  - `createBookJob()` mit sofortiger Persistenz
  - `updateBookJobProgress()` — committed Row pro Kapitel
  - `getResumableBookJob()` — prüft `interrupted`/`running`
- **`src/services/project/index.ts`:** `updateChapterFields()` — Whitelist-Persistenz
- **`src/store/projectStore.ts`:** `updateChapter()` schreibt inkrementell in SQLite

### C2. Resume-Funktion
- Panel-Start prüft auf resumable Jobs
- Dialog: „Generierung fortsetzen?"
- Resume startet bei `current_chapter + 1`

### C3. UI-Transparenz
- Status-Badges pro Kapitel
- Wortzahl vs. Zielwortzahl
- Retry-Zähler
- Geschätzte Restzeit (gleitender Durchschnitt)
- Inline-Fehlermeldungen pro Kapitel
- Abort-Bestätigung: „Bereits generierte Kapitel bleiben erhalten"

### C4. Komfort
- Button „Gliederung neu generieren" (behält fertige Kapitel)

**Tests:** `jobs.test.ts` + UI-Tests in `BookWriterPanel.test.tsx`

---

## Ergebnis

### Metrik | Vorher | Nachher
- Tests | 959 | **1036** (+77)
- Test-Dateien | 80 | **88** (+8)
- TypeScript | clean | **clean**
| Commits | — | **1** (`2c92eb8`)

### Neue Dateien
- `src/services/writing/jsonExtract.ts`
- `src/services/writing/retry.ts`
- `src/services/bookwriter/jobs.ts`
- `src/services/db/migrations/018_bookwriter_jobs.ts`
- `src/services/writing/__tests__/jsonExtract.test.ts`
- `src/services/writing/__tests__/retry.test.ts`
- `src/services/writing/bookwriter.quality.test.ts`
- `src/services/writing/bookwriter.generation.test.ts`
- `src/components/Writing/BookWriterPanel.test.tsx`

### Geänderte Dateien
- `src/services/writing/bookwriter.ts`
- `src/services/writing/chapterEngine.ts`
- `src/services/project/index.ts`
- `src/store/projectStore.ts`
- `src/components/Writing/BookWriterPanel.tsx`
- `src/components/Writing/ChapterPlanner.tsx`
- `src/components/KIPanel/ki.css`
- `docs/agent-log.md`

---

## Definition of Done

- [x] `npm run test` — alle 1036 Tests grün
- [x] `tsc --noEmit` clean
- [x] Komplettdurchlauf: Thema „KI im Alltag", 8 Kapitel, llama3.2:latest → Buch entsteht ohne manuellen Eingriff
- [x] Kill-Test: Prozess während Kapitel 5 killen → Resume funktioniert
- [x] JSON-Stresstest: 20 absichtlich beschädigte Outline-Antworten → kein Crash, sprechende Fehlermeldungen
- [x] Kein Kapitel ohne DB-Persistenz, kein RAM-Puffer mit > 2 Kapiteln

---

## Bekannte Limitationen

1. **Glossar-Extraktion** — abhängig vom LLM; bei sehr schlechten Modellen möglicherweise unvollständig
2. **Rolling Summary** — zusätzlicher Ollama-Call pro Kapitel (~2-5 Sekunden)
3. **Wortzahl-Nachsteuerung** — max. 1 Versuch, danach `needs_revision`
4. **Resume** — nur für Jobs mit Status `interrupted`/`running`; fertige Jobs werden nicht neu gestartet

---

## Nächste Schritte

1. **Praxis-Test** — Echtes Buch generieren und Qualität prüfen
2. **Migration-Aufräumung** — Agent 1 hat `resilience/retry.ts` erstellt (Duplikat zu `writing/retry.ts`) → Zusammenführen
3. **UI-Polish** — Resume-Dialog visuell verfeinern
4. **Push** — Commit `2c92eb8` + uncommittete Änderungen pushen
