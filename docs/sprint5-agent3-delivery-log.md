# Sprint 5 — Agent 3: Plattform-Metadaten & KDP-Templates (Log)

## Aufgabe

Upload-Vorbereiter für internationale Plattformen (AI Writer Studio v1.3.0-RC1):

1. **Upload-Spreadsheet** (`buildKdpUploadSheet`): KDP-Bulk-Upload-Metadaten als
   RFC-4180-CSV mit den Spalten
   `Title, Subtitle, Author, Description (HTML), Keyword 1–7,
   Primary Category, ISBN (Paperback/eBook/Hardcover),
   List Price (USD/EUR/GBP), Pricing Strategy, Language`.
   - Klartext-Klappentext → HTML (`<p>`-Absätze, HTML-Sonderzeichen escaped).
   - Genau 7 Keyword-Slots (KDP-Limit), Überzählige/Längere (>50 Zeichen)
     werden verworfen und als `warnings` gemeldet.
   - ISBN-Platzhalter: nicht vergebene Slots → Token `{{ISBN:FORMAT}}`
     (z.B. `{{ISBN:PAPERBACK}}`), substituierbar per `resolveIsbnPlaceholders`.
   - UTF-8-BOM-Option (`bom: true`) für Excel-Kompatibilität.
   - `buildSheetRowFromFacts` brückt ContextManager-Fakten (kinds `isbn`/
     `pricing`) in eine Sheet-Zeile.
2. **Preisstrategien** (`pricingStrategy.ts`): 4 konfigurierbare Strategien —
   `standard` (4.99), `launch` (2.99), `premium` (7.99),
   `series-loss-leader` (0.99), jeweils USD/EUR/GBP, plus pro-Währung-Overrides.
   `computePrices` deckelt auf KDP-Grenzen (0.99–200), rundet auf 2 Dezimalen;
   `parsePricingConfig` validiert Konfigurations-Strings.
3. **ContextManager-Erweiterung** (additiv, keine Breaking Changes):
   - Neue Fact-Kinds `isbn` (key = paperback|ebook|hardcover) und `pricing`
     (key = strategy|USD|EUR|GBP) in `FACT_KINDS` + `PUBLISHING_FACT_KINDS`.
   - `validatePublishingFact` in `upsertFact` einklinkend: ISBN-Formate,
     Strategie-Ids und Preise werden beim Speichern validiert (KDP-Grenzen).
   - `resolveProjectIsbns` (vergebene ISBNs + Platzhalter für offene Slots),
     `getProjectPricing` / `setProjectPricingStrategy` (Strategie-Id +
     Override-Preise persistiert als pricing-Fakten),
     `buildPublishingContextBlock` (deterministischer Publishing-Kontextblock
     für den Upload-Flow).
   - Kein DB-Schema-Change nötig: `bookwriter_facts` speichert kind/key/value
     generisch (Migration 021) — isbn/pricing Fakten nutzen dieselbe Tabelle.

## TDD

- Tests zuerst (RED: Module fehlten) → Implementierung → GREEN.
- `uploadSheet.test.ts` (13 Tests): Spalten-Vertrag, CSV-Escaping (RFC 4180),
  HTML-Konvertierung, 7-Keyword-Limit, ISBN-Platzhalter/Werte, Preisspalten,
  Mehrbuch-Zeilen, Determinismus, BOM, Validierungs-Fehler.
- `pricingStrategy.test.ts` (11 Tests): Registry, Strategie-Auswahl, Overrides,
  KDP-Grenzen (Min/Max-Deckelung), Konfig-Parsing, Fehlerfälle.
- `contextManager.publishing.test.ts` (12 Tests): neue Kinds, ISBN-Speicherung,
  Pricing-Validierung (Format/Strategie/numerisch/KDP-Grenzen),
  resolveProjectIsbns, get/setProjectPricingStrategy, Publishing-Kontextblock.
- Gesamt dieser Aufgabe: **36 neue Tests, alle grün**.

## Verifikation

- `vitest run` kdp/ + bookwriter/: **26 Dateien, 220 Tests grün** (inkl. aller
  neuen). Volle Suite: separat im Abschlussbericht (läuft als letzte Prüfung).
- `tsc --noEmit`: **0 Fehler in allen von mir berührten Dateien**; die
  verbleibenden 11 Fehler liegen ausschließlich in `src/services/bulk/*`
  (uncommittete Arbeit anderer Agents, vorbestehend — per `git stash`-A/B gegen
  HEAD verifiziert, dort 49 Fehler ohne meine Änderungen).
- Log-Eintrag: `logger.info("KDP-Upload-Sheet erstellt: …", "buildKdpUploadSheet")`
  bei jedem Sheet-Build; dieses File ist der persistente Sprint-Log-Eintrag.

## Dateien

- NEU: `src/services/kdp/uploadSheet.ts` (CSV-Builder + ISBN-Platzhalter-API)
- NEU: `src/services/kdp/uploadSheet.test.ts` (13 Tests)
- NEU: `src/services/kdp/pricingStrategy.ts` (4 Strategien + Overrides + Grenzen)
- NEU: `src/services/kdp/pricingStrategy.test.ts` (11 Tests)
- GEÄNDERT: `src/services/bookwriter/contextManager.ts` (kinds isbn/pricing,
  Validierung, resolveProjectIsbns, get/setProjectPricingStrategy,
  buildPublishingContextBlock — rein additiv)
- NEU: `src/services/bookwriter/contextManager.publishing.test.ts` (12 Tests)
- GEÄNDERT: `src/services/kdp/index.ts` (Exporte uploadSheet + pricingStrategy)
- NEU: `docs/sprint5-agent3-delivery-log.md` (dieses File)

## Bekannte Grenzen

- CSV statt .xlsx: KDP-Bulk-Upload erwartet CSV; .xlsx würde eine neue
  Abhängigkeit (exceljs/sheetjs) bedeuten — bewusst vermieden. BOM-Option
  stellt Excel-Öffnen sicher.
- Preisspalten fix USD/EUR/GBP (deckt KDP-Märkte US/DE/UK ab); weitere
  Währungen sind via `SheetPrices`-Typ erweiterbar.
- ISBN-13-Prüfsumme vorhanden (`isValidIsbn13`), aber im Sheet-Build nicht
  erzwungen (KDP selbst validiert beim Upload).

— Agent 3, Sprint 5, 2026-09-05
