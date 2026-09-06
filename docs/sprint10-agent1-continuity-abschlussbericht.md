# Sprint 10 — Agent 1: BookWriter Continuity — Abschlussbericht

**Datum:** 2026-09-06 · **Agent:** Agent 1 (BookWriter continuity)
**Scope:** Entity-Ledger, Widerspruchs-Flags, Kapitel-Brief, Panel, TDD (mocked `complete`, zero network)
**Constraints eingehalten:** keine bestehende bookwriter-Datei verändert (nur NEUE Dateien), keine Breaking Changes, kein neuer Netzwerk-Code.

## Neue Dateien (3)

| Datei | Zweck |
|---|---|
| `src/services/bookwriter/continuity.ts` | Entity-Ledger, NER-Heuristik, Widerspruchserkennung, Brief-Generator, LLM-Hook |
| `src/services/bookwriter/continuity.test.ts` | 24 Tests, gemockte `complete`-Fn, zero network |
| `src/components/BookWriter/ContinuityPanel.tsx` | Standalone-UI (kein Import/Änderung an BookWriterPanel) |

## Was gebaut wurde

**1. Entity-Ledger** (`buildLedger`, `extractEntities`)
- Kategorien: `character` | `place` | `term` | `timeline`.
- Deterministische NER-Heuristik offline: Großschreibungs-Sequenzen (1–3 Wörter, Stopwort-Filter), zitierte Begriffe → `term`, 4-stellige Jahre/Monate/Jahreszeiten → `timeline`.
- Orts-Klassifikation bewusst eng (Fix nach TDD-Rot): nur starke Präpositionen (`in/nach/aus/bei/am/im/zum/zur`) + Ortsnomen *im Kandidaten selbst*. Weite Fenster-Heuristik und `auf/vor`-Präpositionen wurden entfernt, weil sie Personen („auf Anna warten", „Hafen" im 60-Zeichen-Fenster) fälschlich zu Orten machten.
- Kapitelnübergreifendes Mergen: Drift-Varianten (`Ann Weber` → `Anna Weber`) landen in `aliases`, kanonisch ist die längste Variante.

**2. Widerspruchs-Flags** (`detectContradictions`)
- `name_variant` (warning): Alias ≠ kanonischer Ledger-Name.
- `timeline_order` (error): Jahreszahl fällt gegenüber früherem Kapitel zurück (Monotonie-Check).
- `attribute_conflict` (error): Altersangaben weichen > 2 Jahre ab.
- `missing_entity` (warning): Charakter aus frühen Kapiteln fehlt in den letzten beiden (ab ≥ 4 Kapiteln).

**3. Kapitel-Brief** (`buildChapterBrief`)
- Komprimierter Prompt-Baustein: nächstes Kapitelziel + kanonische Entitäten (max. 12) + offene Widersprüche + letzte Zusammenfassungen, Standard-Budget 2000 Zeichen (mit Kürzungs-Fallback).

**4. LLM-Hook** (`enrichLedgerWithLlm`, `buildEnrichmentPrompt`, `createOllamaComplete`)
- Einzige LLM-Schnittstelle ist die injizierbare `CompleteFn`; ungültiges JSON / unbekannte `kind`-Werte sind kein Fehler (`added = 0`), Duplikate werden zu Notizen statt neuen Einträgen.
- `createOllamaComplete()` verdrahtet nur den bestehenden Service (`loadSettings` + `completeOnce`, Lazy-Imports) — **kein neuer Netzwerk-Code**; das Modul bleibt ohne diesen Aufruf seitenffektfrei (kein DB-/Netzwerk-Import zur Ladezeit).

**5. UI** (`ContinuityPanel`)
- Props: `chapters`, optional `nextChapter`, `prevSummaries`, `complete`. Rendert Ledger-Tabelle, Widersprüche, Brief-`<pre>`; LLM-Button nur wenn `complete` übergeben. `data-testid`s: `continuity-panel`, `-ledger-table`, `-contradictions`, `-brief`, `-enrich-btn/-note`.

## Verifikation
- `npx vitest run src/services/bookwriter/continuity.test.ts` → **24/24 grün** (TDD: erst 2 rot durch Fehlklassifikation, nach Heuristik-Fix grün).
- `npx tsc --noEmit` → **keine Fehler** in den neuen Dateien.
- `git status` → nur die 3 neuen Dateien von diesem Agenten (keine Modifikation bestehender bookwriter-Dateien; andere ungetrackte Dateien im Tree stammen von parallelen Agenten und wurden nicht angefasst).

## Bewusste Abweichung / Hinweis
- Namensnormalisierung (`normalizeContinuityName`, `continuityNamesLikelySame`) ist lokal in `continuity.ts` dupliziert statt aus `consistency.ts` importiert — begründet: `consistency.ts` zieht die DB-Schicht in den Modulgraphen; so bleibt `continuity.ts` hermetisch und ohne DB-Mock testbar. Verhalten ist kompatibel.

## Offene Punkte / Follow-ups
- Ledger-Persistenz (DB-Tabelle) und Verdrahtung in den Generierungs-Prompt (`chapter-gen.ts`) sind absichtlich *nicht* enthalten (Constraint: keine Änderung bestehender Dateien) — Vorschlag für Folge-Sprint: `buildChapterBrief(...).promptBlock` in `generateChapter` als `researchNotes`-Präfix einspeisen.
- `ContinuityPanel` ist noch nirgends gemountet (keine bestehende Komponente angerührt) — Einbindung z. B. im Dashboard als separater Tab in einem Folge-Ticket.
