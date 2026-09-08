# Sprint 22 — Agent 5: Outliner — Abschlussbericht

**Modus:** `outliner` 🌳 — manuelle strukturierte Gliederung (Baum + Drag & Drop + Import/Export).
**Status:** ✅ fertig, kein Commit, kein Build (gemäß Vorgabe).

## Was gebaut wurde

### 1. Outliner Engine — `src/services/outliner/outliner.ts` (neu)
- Typen `OutlineNode` (`id, title, content?, children, collapsed, order`) und `Outline` wie spezifiziert.
- `OutlinerEngine`-Klasse (isolierte Instanz, vom Panel genutzt): `addNode(parentId, title)`, `removeNode(id)`,
  `moveNode(id, newParentId, newOrder)` (Drag & Drop, mit Zyklus-Schutz: kein Drop auf sich selbst/Nachfahren),
  `toggleCollapse(id)`, zusätzlich `renameNode`, `setContent`, `setTitle`, `loadOutline`, `importMarkdown`.
- Singleton-API mit exakt den spezifizierten Signaturen: `createOutline(title)`, `addNode`, `removeNode`,
  `moveNode`, `toggleCollapse` (+ `getActiveOutline`, `renameNode`, `findNode` als Helfer).
- `toMarkdown(outline)`: `# Titel` + `- `-Listen (2 Spaces/Ebene), Inhalte als eingerückte Textzeilen.
- `fromMarkdown(markdown)`: liest Titel, Bullets (`-`/`*`/nummeriert, Tab-tolerant), `##+`-Überschriften
  als Knoten, Fließtext/`>`-Zitate als Knoten-Inhalt. Roundtrip-sicher für eigenes Exportformat.

### 2. OutlinerPanel — `src/components/Outliner/OutlinerPanel.tsx` (neu)
- Baumansicht (`role=tree/treeitem`, Einrückung 18 px/Ebene), HTML5-Drag & Drop (auf Knoten = einhängen,
  auf Container = Wurzelebene), `+`-Button und `🗑`-Button pro Knoten, `▸/▾`-Pfeile,
  Inline-Umbenennung (Input, Enter/Blur = speichern, Esc = abbrechen, Doppelklick), `✎`-Button.
- Buttons: **Als Projekt erstellen** (Default: `projectStore.newProject` + 1 Kapitel je Wurzelknoten,
  injizierbar via `onCreateProject`), **Als Markdown exportieren** (Download, Clipboard-Fallback,
  `onExport`-Hook), **Markdown importieren** (Textarea-Import).
- Bloomberg-Terminal-Stil (Inline-Styles: `#000`/`#ffa028`/`#333`, IBM Plex Mono). Keine neuen Dependencies.

### 3. Sidebar-Mode `outliner`
- `src/types/mode.ts`: Union um `"outliner"` erweitert.
- `src/components/Sidebar/Sidebar.tsx`: MODES-Eintrag
  `{ id: "outliner", key: "sidebar.mode.outliner", icon: "🌳", description: "Strukturierte Gliederung" }`
  (Schlüssel-Form folgt bestehender `key`-Konvention), `WIDE_EXTRA_MODES` + `"outliner"`,
  Lazy-Import + `ModePanel`-Branch als standalone (kein offenes Kapitel nötig).
- `src/i18n/locales/de.ts` + `en.ts`: `sidebar.mode.outliner` + 15 `outliner.*`-Keys (DE/EN).

## Tests — 19/19 grün ✅
- `src/services/outliner/outliner.test.ts` (13 Tests): leeres `createOutline`, Root-/Kind-`addNode`
  (Singleton + Klasse), `removeNode` (Teilbaum, Neuindizierung, No-op), `moveNode` (Reihenfolge,
  Umhängen, Zyklus-Schutz), `toggleCollapse`, `renameNode`, `toMarkdown`-Format, Roundtrip,
  `##`-Überschriften + Inhalte.
- `src/components/Outliner/OutlinerPanel.test.tsx` (6 Tests): Baum-Render, Hinzufügen, Löschen,
  Zu-/Aufklappen, Export via `onExport`, `onCreateProject`-Aufruf.
- Befehl: `npx vitest run src/services/outliner src/components/Outliner` → 2 Files, 19 Tests, passed.

## Verifikation / bekannte Fremdfehler (nicht von mir)
- `npx tsc --noEmit`: eigene Dateien fehlerfrei. Baseline war bereits rot (parallele Agenten:
  `importer`/`CharactersPanel`/`ImporterPanel`, `en.ts`-Orphan `websearch`, fr/es-Lücken).
- `src/i18n/parity.test.ts` + `i18n.test.ts` (fr/es-Parität) waren schon vor mir rot
  (fehlten `style-analyzer`/`websearch`); meine 16 DE-Keys verlängern nur die Missing-Liste.
  Fix = fr/es-Nachtrag (außerhalb meines Schreib-Scopes) — Laufzeit ist sicher (`t()` fällt auf DE zurück).
- `sidebar.bilingual.test.tsx` (2 Tests) scheitert mit `projects.map is not a function` im Store-Mock —
  unberührt von meinen Änderungen (kein Eingriff in Projekt-Tree/Store-Pfad), ebenfalls vorbestehend.
- Hinweis Shared Tree: Sibling-Einträge in `Sidebar.tsx`/`mode.ts`/`de.ts`/`en.ts` wurden erhalten
  (ein versehentlich kollidierter `WIDE_EXTRA_MODES`-Eintrag wurde sofort wiederhergestellt).
