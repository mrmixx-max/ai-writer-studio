# Sprint 24 Agent 2 — Volltextsuche: Abschlussbericht

Datum: 2026-09-08 · Agent: agent2-search · Scope: Search Engine + SearchPanel + Sidebar-Mode `search`

## Ergebnis

Volltextsuche über alle Projekte ist implementiert, getestet und verifiziert.
12/12 Tests in den beiden neuen Testdateien bestehen; keine neuen Dependencies,
kein Commit, kein Build (gemäß Auftrag).

## Geänderte / neue Dateien

| Datei | Status | Inhalt |
|---|---|---|
| `src/services/search/search.ts` | neu | Search Engine: `SearchQuery`, `SearchResult`, `SearchStats`, `search()`, `replace()`, `replaceAll()`, `getRecentSearches()`, `clearRecentSearches()` (+ `buildSearchRegex`-Helper) |
| `src/services/search/search.test.ts` | neu | 7 Engine-Tests |
| `src/components/Search/SearchPanel.tsx` | neu | Suchfeld (Enter-Suche), Optionen (Case Sensitive, Regex, Whole Word), Scope-Auswahl, Projekt-Filter, Ergebnisliste mit `<mark>`-Highlighting, Ersetzen/Alle-ersetzen, Recent-Searches-Dropdown; Bloomberg-Stil (`#000`/`#ffa028`/`#333`, IBM Plex Mono) |
| `src/components/Search/SearchPanel.test.tsx` | neu | 5 Panel-Tests |
| `src/types/mode.ts` | erweitert (vorhanden) | `EditorMode` enthält `"search"` |
| `src/components/Sidebar/Sidebar.tsx` | erweitert (vorhanden) | MODES-Eintrag `{ id: "search", icon: "🔎", label: "Suche", description: "Volltextsuche + Ersetzen" }`, `mode === "search"` rendert `<SearchPanel />`, in `WIDE_EXTRA_MODES` |
| `src/i18n/locales/de.ts` | erweitert (vorhanden) | `"sidebar.mode.search": "Suche"` |
| `src/i18n/locales/en.ts` | erweitert (vorhanden) | `"sidebar.mode.search": "Search"` |

## Design-Entscheidungen

- **Keine LLM-Abhängigkeit:** reines Text-Matching (kompilierte `RegExp`, `escapeRegExp` für Literal-Suche, `\b`-Whole-Word, `i`-Flag für case-insensitiv).
- **Scope `notes`:** Kapitel haben kein separates Notizfeld; durchsucht werden `synopsis` + `purpose` als notizartige Metadaten. `title` deckt Projektname + Kapiteltitel ab.
- **Ersetzen persistiert** über den Projekt-Service (inkl. Verschlüsselung für Inhalte); `replace()` ersetzt nur das erste Vorkommen, `replaceAll()` alle und meldet die Anzahl.
- **Verlauf** in `localStorage` (mit Guards für Node-Testumgebung), max. 20 Einträge, neueste zuerst.
- **Sichere Regex:** ungültige Patterns und leerer Suchtext geben 0 Treffer / 0 Ersetzungen statt zu werfen; leere Matches (`a*`) laufen nicht endlos.

## Verifikation

- `npx vitest run src/services/search/search.test.ts src/components/Search/SearchPanel.test.tsx` → **2 Dateien, 12/12 Tests bestanden.**
- Engine-Tests decken: Treffer in Inhalt+Titel (Zeile/Spalte/Match-Offsets), projektübergreifende Suche + Projekt-Filter, `caseSensitive`/`wholeWord`/`regex`/`scope`, `replace()` (genau 1), `replaceAll()` (Anzahl), Recent-Verlauf + Löschen, leere/ungültige Eingaben.
- Panel-Tests decken: Render aller Bedienelemente, Enter-Suche mit Ergebnisliste + `<mark>`-Highlight + Statistik, Options-/Scope-/Filter-Weitergabe, Replace/ReplaceAll mit Ersatztext, Start-Ergebnisse.
- `npx vitest run src/components/Sidebar` → 57/59 bestanden. Die 2 Fehler in `sidebar.bilingual.test.tsx` (`projects.map is not a function`, Store-Mock-Problem) sind **vorhanden und suchunabhängig** (Arbeitsbaum war clean, keine eigenen Änderungen an diesen Dateien).

## Offen / Hinweise

- `es.ts`/`fr.ts` haben noch kein `sidebar.mode.search`-Label (Auftrag verlangte nur de/en).
- SearchPanel lädt die Projektliste für den Filter aus dem Projekt-Service; injizierbare `searchFn`/`replaceFn`/`replaceAllFn`-Props existieren für Tests.
