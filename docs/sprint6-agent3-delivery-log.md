# Sprint 6 — Agent 3: Multilingual Pipeline (Log)

## Aufgabe

Automatische Übersetzung fertiger Manuskripte (AI Writer Studio v1.4.0):

1. **Translation-Service**: Fertiges Buchprojekt (Kapitel-Artefakt der
   Manuskript-Phase) kapitelweise in die Zielsprachen EN, ES, FR übersetzen.
   - `TRANSLATION_TARGETS` (en/„Englisch", es/„Spanisch", fr/„Französisch"),
     Teilmenge via `options.targets` wählbar.
   - `translateBookToLanguages(chapters, chat, options, onProgress, signal)`:
     je Sprache über das bestehende `translateBook()` (Sprint 3) — globaler
     Fortschritt über alle Sprachen, Abort liefert Teilstand.
2. **Markup-Erhalt**: strikt erhalten durch Wiederverwendung des bewährten
   `markupGuard` (maskMarkup/restoreMarkup/markupIntact, ⟦M##⟧-Platzhalter).
   Jedes übersetzte Kapitel trägt `markupIntact`-Verifikation; Tests
   asserten Headings/Bold/Listen/HTML-Blöcke in der EN/ES/FR-Ausgabe.
3. **Metadaten-Lokalisierung**: KDP-Spreadsheet-Felder automatisch übersetzt.
   - `translateKdpMetadata`: EIN JSON-Call je Sprache (Titel, Untertitel,
     Klappentext, Kurzbeschreibung, Keywords). KDP-Limits erzwungen
     (max. 7 Keywords, je max. 50 Zeichen; Verstöße → warnings).
     Ungültige Antworten → deterministischer Fallback (Original, viaLlm=false).
   - `buildLocalizedUploadSheet(sourceRow, translations)`: eine Sheet-Zeile
     pro Sprache (Quellsprache + en/es/fr) über das bestehende
     `buildKdpUploadSheet` (RFC-4180, 20 Spalten); ISBNs/Preise/Kategorie
     unangetastet, Language-Spalte je Zeile, HTML-Klappentext je Sprache.
   - `runMultilingualPipeline()`: Buch + Metadaten in einem Aufruf.
   - `estimateTranslationApiCalls(chapters, targets?)`: Budget-Schätzung
     vor dem Start (Kapitel×Sprachen + 1 Metadaten-Call je Sprache).

## TDD

- Tests zuerst (RED: Modul fehlte) → Implementierung → GREEN.
- `multilingualPipeline.test.ts` (18 Tests):
  - Buch-Übersetzung (10): EN/ES/FR-Vollübersetzung mit Markup-Assertion,
    Fortschritt 1/6…6/6, Ziel-Teilmenge, Abort-Teilstand,
    Glossar-/Quellsprache-Weitergabe in den Kapitel-Prompt.
  - Metadaten (8): JSON-Vertrag im Prompt, JSON in Fences, Keyword-Kappung
    (>7) + Längenverwerfung (>50) mit Warnings, Fallback bei Müll-Antwort,
    Abort, 3-Sprachen-Lokalisierung, Sheet-Zeilen-pro-Sprache
    (Language-Spalte en/es, HTML/ISBN/Preise erhalten), Determinismus.

## Verifikation

- `vitest run` (3 Dateien: multilingualPipeline + translatorService +
  uploadSheet): **39/39 grün** — 18 neu, 21 Regression.
- Volle Suite: **1520/1522** (136 Dateien). Die 2 Fehler liegen in
  `src/services/logging/logManager.test.ts` (fremde uncommittete Datei,
  vorbestehend, nichts mit der Pipeline zu tun); 2 weitere leere Suiten
  (`BookWriterDashboard.test.tsx`, `progress.test.ts`) importieren Module,
  die andere Agents noch nicht committed haben.
- `tsc --noEmit`: 0 Fehler in allen 3 von mir berührten Dateien.
- `eslint`: clean für alle neuen/geänderten Dateien.
- Log-Eintrag: `logger.info(...)` in translateBookToLanguages /
  translateKdpMetadata / buildLocalizedUploadSheet / runMultilingualPipeline;
  dieses File + Eintrag in `docs/agent-log.md` sind die persistenten Logs.
- Budget: 0 echte API-Calls (alle Calls über LLMChatFn-Fakes).

## Dateien

- NEU: `src/services/bookwriter/multilingualPipeline.ts`
- NEU: `src/services/bookwriter/multilingualPipeline.test.ts` (18 Tests)
- GEÄNDERT: `src/services/bookwriter/index.ts` (Export, additiv)
- NEU: `docs/sprint6-agent3-delivery-log.md` (dieses File)
- GEÄNDERT: `docs/agent-log.md` (Sprint-6-Eintrag)

## Bekannte Grenzen

- Sheet bleibt CSV (bewusste Entscheidung aus Sprint 5, keine neue Dependency).
- Metadaten-Lokalisierung nutzt das erste blurbVariants-Element als Klappentext;
  mehrere Varianten je Sprache sind Erweiterungspotenzial.
- Call-Budget wird geschätzt (estimateTranslationApiCalls), aber im Service
  nicht hart erzwungen — Aufrufer können vor dem Start prüfen.

— Agent 3, Sprint 6, 2026-09-05
