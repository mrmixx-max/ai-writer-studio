# Sprint 17 – Agent 5: Rewrite-Panel + Inline-Vorschläge — Abschlussbericht

## Auftrag
1. `QualityDashboard.tsx` (Agent 2) lesend übernehmen (Struktur kopieren).
2. NEU `src/components/BookWriter/RewritePanel.tsx`: Standalone-Panel mit
   Befund-Anzeige, Vorher/Nachher-Vorschau, Accept/Reject-Buttons,
   Rewrite-Optionen (Ton, Länge), Fortschrittsanzeige. `QualityDashboard`
   NICHT verändern.
3. NEU Testdatei mit 8+ Tests.
4. Dieser Bericht + Status-Selbstcheck.

## Ergebnis
- ✅ `src/components/BookWriter/RewritePanel.tsx` (NEU, ~190 Zeilen)
- ✅ `src/components/BookWriter/RewritePanel.test.tsx` (NEU, 12 Tests)
- ✅ `QualityDashboard.tsx` unverändert (nur gelesen)

## Panel-Design (Struktur von Agent 2 übernommen)
- Standalone, keine Imports aus anderen Panels; Daten rein über Props.
- Lokaler State für erledigte Befunde (wie `fixed` im Dashboard), Callbacks
  `onAccept`/`onReject` nach außen.
- `data-testid`-Konvention + `ws-btn`/`ws-muted`-Klassen aus `bookwriter.css`
  übernommen. Deutsche UI-Texte.

### Props
| Prop | Zweck |
|---|---|
| `findings: RewriteFinding[]` | Befunde (`id`, `chapterId`, `message`, `before`, `suggestion?`) |
| `rewrite?: RewriteFn` | Injizierbare Rewrite-Funktion `(finding, {tone, length}) => Promise<string>`; ohne sie arbeitet das Panel offline mit den mitgelieferten `suggestion`-Texten (analog zu `complete` in Lektorat-/ContinuityPanel) |
| `initialTone` / `initialLength` | Startwerte (Default `neutral` / `gleich`) |
| `onAccept(id, text)` / `onReject(id)` | Meldung nach außen; Accept übergibt den aktuellen Nachher-Text (Preview oder Original) |
| `className?` | Optionaler CSS-Override |

### Features
- **Befund-Anzeige**: Message + Kapitel + Vorher-Text (`rewrite-before`).
- **Vorher/Nachher-Vorschau**: Nachher-Text (`rewrite-after`) aus `suggestion`
  oder Rewrite-Ergebnis; Platzhalter (`rewrite-no-preview`) solange keines existiert.
- **Accept/Reject**: `rewrite-accept` / `rewrite-reject`; erledigte Befunde
  verschwinden aus der Liste, `rewrite-done` bei leerer Liste.
- **Optionen**: Ton-Select (`neutral`, `sachlich`, `lebendig`, `formal`),
  Längen-Select (`kürzer`, `gleich`, `ausführlicher`); werden an `rewrite` gereicht.
- **Fortschritt**: `rewrite-progress` („x von y erledigt“) + Balken
  (`rewrite-progress-bar`, `data-resolved`/`data-total`).
- **Loading**: Während `rewrite` läuft, zeigt der Button „Formuliert um …“
  und ist deaktiviert.

## Tests (12/12 grün)
`npx vitest run src/components/BookWriter/RewritePanel.test.tsx`
1. Rendert Panel mit allen Befunden
2. Vorher-Text je Befund
3. Mitgelieferter Vorschlag als Nachher-Vorschau
4. Platzhalter ohne Vorschlag
5. Accept: Callback (id + Vorschau-Text) + Entfernen
6. Reject: Callback + Entfernen
7. Fortschritt „0 von 2“ → „1 von 2“ + `data-resolved`
8. Ton-Wechsel
9. Längen-Wechsel
10. Rewrite-Button: Aufruf mit Befund + Optionen, Ergebnis-Render
11. Loading: „Formuliert um …“, Button disabled, Ergebnis nach Resolve
12. Leerzustand ohne Befunde

## Verifikation
- `npx vitest run src/components/BookWriter/RewritePanel.test.tsx` → **12/12 passed**
- `npx tsc --noEmit` → **keine Fehler** in `RewritePanel.tsx` / `.test.tsx`
- `git status` → nur eigene NEU-Dateien (+ dieser Bericht); keine
  Fremddateien angefasst

## Status-Selbstcheck
| Kriterium | Status |
|---|---|
| QualityDashboard gelesen, nicht modifiziert | ✅ |
| RewritePanel.tsx neu, standalone | ✅ |
| Before/After-Preview | ✅ |
| Accept/Reject-Buttons | ✅ |
| Rewrite-Optionen Ton + Länge | ✅ |
| Fortschrittsanzeige | ✅ |
| Loading-State | ✅ |
| ≥ 8 Tests, alle grün | ✅ (12/12) |
| Typecheck sauber | ✅ |
| Nur eigene Dateien + Bericht | ✅ |

## Offene Punkte / Hinweise
- Keine: Panel ist uncommitted im Shared-Tree (Commit Sache des Orchestrators).
- Hinweis: `QualityDashboard.tsx` existierte zu Beginn noch nicht (paralleler
  Agent 2) — Struktur wurde nach dessen Landung gelesen und übernommen.
