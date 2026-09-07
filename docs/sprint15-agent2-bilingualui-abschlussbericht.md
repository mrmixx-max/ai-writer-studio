# Sprint 15 – Agent 2: Bilingual-Panel (DE↔EN Toggle) — Abschlussbericht

## Auftrag
Standalone-Panel für Kapitel-Übersetzung DE↔EN: Sprachwahl, Translate-Button,
Side-by-Side-Vorschau, Apply-Callback. `BookWriterPanel` nicht anfassen.

## Lektüre (read-only)
- `src/components/BookWriter/BookWriterPanel.tsx` existiert in diesem Tree
  nicht (nur `BookWriterDashboard.tsx` + `ContinuityPanel.tsx` + `LektoratPanel.tsx`);
  UI-Konventionen (`ws-btn`, `ws-muted`, `ws-pre`, `data-testid`-Muster,
  injizierbares LLM-Callback, offline ohne Callback) aus `ContinuityPanel.tsx`
  und `LektoratPanel.tsx` übernommen.
- Übersetzungs-Service: kein neues Agent-1-„Bilingual“-Modul im Tree gefunden
  (`grep bilingual` leer) → Panel baut auf dem etablierten
  `translateChapter()` aus `src/services/bookwriter/translatorService.ts`
  (Sprint 3, Markup-Erhaltung via `markupGuard`) auf. Austausch gegen ein
  Sprint-15-Agent-1-Modul ist ein Einzeiler (Import + Call-Signatur).

## Neu
- `src/components/BookWriter/BilingualPanel.tsx` — Props: `chapter`,
  `sourceLanguage` (Default „Deutsch“), `initialTarget` (Default „Englisch“),
  `chat?: LLMChatFn` (Mock in Tests, Provider-Adapter in Produktion),
  `onApply?: (result: TranslationResult) => void`, `className?`.
  Elemente: `bilingual-lang-select` (DE/EN), `bilingual-translate-btn`
  („Translate Chapter“, deaktiviert ohne `chat`/während Lauf),
  `bilingual-preview` mit `bilingual-original` + `bilingual-translated`,
  `bilingual-apply-btn` („Apply“, erst nach Übersetzung + mit `onApply` aktiv),
  `bilingual-offline-note` / `bilingual-error` für die Randfälle.
  Sprachwechsel setzt das Ergebnis zurück (kein stale Preview).
- `src/components/BookWriter/BilingualPanel.test.tsx` — 10 Tests (jsdom,
  gemockter `chat`, kein Netz).

## Tests
`npx vitest run src/components/BookWriter/BilingualPanel.test.tsx` →
**1 Datei, 10/10 bestanden**: Panel-Render + Original, Default EN,
Selector→DE, Selector→EN zurück, Translate ruft `chat` + rendert Übersetzung,
übersetzter Titel, Apply vorher deaktiviert, Apply-Callback mit Ergebnis
(`chapterId`, `content`), ohne `chat` deaktiviert + Offline-Hinweis,
Sprachwechsel resettet Vorschau.

## Status-Selbstcheck
- [x] `BookWriterPanel`/Dashboard/Continuity nicht modifiziert
  (`git status` zeigt nur die 2 neuen Dateien)
- [x] 8+ Tests gefordert, 10 geliefert, alle grün
- [x] `chat` in Tests gemockt (complete-Mock), 0 echte API-Calls
- [x] Standalone, offline-fähig ohne `chat`
- Offen: auf Agent-1-Bilingual-Service umstellen, sobald es im Tree landet.
