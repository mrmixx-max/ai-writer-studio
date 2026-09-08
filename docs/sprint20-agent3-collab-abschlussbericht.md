# Sprint 20 – Agent 3: Collaboration – Abschlussbericht

Datum: 2026-09-08 · Modus: `collab` (Kommentare + Reviews)

## Geliefert

**1. CollabManager (`src/services/collab/collabManager.ts`, neu)**
In-Memory-Store (projektgetrennte Maps, keine neuen Dependencies), Async-API
damit spätere DB-Persistenz die Signaturen nicht ändert. Exakt die
vorgegebenen Typen `Comment` / `ReviewRequest` plus alle 6 Funktionen:
`addComment` (mit Validierung: projectId/Text nicht leer, Selektion
`start >= 0`, `end >= start`), `resolveComment`, `getComments`,
`createReviewRequest` (Status `open`, Kommentarverlauf als Snapshot),
`approveReview`, `rejectReview`. Zusätzlich `getReview`,
`currentAuthor` (via `COLLAB_AUTHOR` überschreibbar) und
`__resetCollabStore` (Test-Isolation).

**2. CollabPanel (`src/components/Collab/CollabPanel.tsx`, neu)**
Alle geforderten UI-Elemente: Kommentar-Liste, Textarea + Hinzufügen-Button,
Selektions-Inputs (Start/Ende) + „Markierung“-Button (übernimmt
`window.getSelection`), Review-Request-Button, Review-Status mit
Genehmigen/Ablehnen, Resolve-Button pro (unerledigtem) Kommentar.
Bloomberg-Stil per Inline-Styles (bg `#000`, accent `#ffa028`, border
`#333`, IBM Plex Mono) — keine geteilte CSS-Datei angefasst. API über
`api`-Prop injizierbar (Mock in Tests, Default: echter Manager);
`data-testid`s: `collab-panel`, `collab-comment-list`, `collab-comment`,
`collab-comment-input`, `collab-selection-start/end`,
`collab-take-selection`, `collab-add-btn`, `collab-resolve-<id>`,
`collab-review-btn/status/state`, `collab-approve-btn`,
`collab-reject-btn`, `collab-error`.

**3. Sidebar-Mode `collab`**
`src/types/mode.ts`: Union um `"collab"` erweitert. `Sidebar.tsx`:
MODES-Eintrag `{ id: "collab", icon: "👥", label: "Collab", description:
"Kommentare + Reviews" }`, Lazy-Import, `ModePanel`-Branch
(`<CollabPanel projectId={…}>`, braucht kein offenes Kapitel).
Labels `sidebar.mode.collab` in `de.ts` („Collab“) und `en.ts` („Collab“);
zusätzlich `fr.ts`/`es.ts` ergänzt, weil die Paritäts-Tests sonst rot wären.

## Tests (15 neu, alle grün)

- `collabManager.test.ts` (9): ID/Autor/Timestamp, Selektion,
  Validierungs-Fehler, Projekt-Trennung, resolve-Status, unbekannte IDs,
  Review-Erzeugung mit Verlauf, approve/reject-Wechsel.
- `CollabPanel.test.tsx` (6, jsdom, gemockte API): Liste rendert,
  Eingabe/Buttons vorhanden, Hinzufügen + Eingabe leeren, Resolve-Flow,
  Review-Flow + Status, Genehmigen → `approved`.
- Befehl: `npx vitest run src/services/collab src/components/Collab` →
  **2 Files, 15 Tests, alle passed.**

## Bestehende Tests nicht gebrochen

- `src/i18n/*`: nach fr/es-Ergänzung ist `sidebar.mode.collab` überall
  abgedeckt. Verbleibende Fehler (`sidebar.mode.voice`,
  `sidebar.mode.templates` fehlen in fr/es; `navigation.test.ts`
  „templates fehlt in MODES“; `sidebar.bilingual.test.tsx`
  `projects.map is not a function`) stammen aus paralleler,
  uncommitteter Arbeit anderer Agenten im selben Tree (Templates-,
  VoiceLab-Dateien) und sind von dieser Lieferung unabhängig.

## Hinweise / Offenes

- Store ist bewusst In-Memory (Desktop-Single-User); Persistenz
  (z. B. via `settings`/DB-Service) ist der natürliche nächste Schritt,
  API-kompatibel möglich.
- Kein Commit, kein Build (vorgabengemäß); nur `vitest run` zur Verifikation.
- Geänderte Dateien: `src/types/mode.ts`, `Sidebar.tsx`, `de/en/fr/es.ts`
  (+ 4 neue Dateien unter `src/services/collab/`, `src/components/Collab/`).
