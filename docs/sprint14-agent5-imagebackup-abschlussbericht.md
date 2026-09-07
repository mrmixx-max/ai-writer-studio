# Sprint 14, Agent 5 — Bilder-Backup: Abschlussbericht

**Datum:** 2026-09-07 · **Agent:** Agent 5 (Bilder-Backup) · **Status:** ✅ abgeschlossen

## Auftrag

`src/services/db/backup.ts` (Sprint 12, Agent 4) um Bild-Assets (Cover + generierte
Bilder) erweitern: Manifest mit Image-Hashes, Restore mit Integritaetspruefung,
Infrastruktur wiederverwenden statt duplizieren, 8+ Tests (TDD).

## Geliefert

| Datei | Art | Inhalt |
|---|---|---|
| `src/services/db/backup-images.ts` | neu (~500 Zeilen) | Export/Validierung/Restore mit Bildanteil, SHA-256 (pure-TS, sync, keine neue Dependency) |
| `src/services/db/backup-images.test.ts` | neu | **12 Tests**, alle gruen |
| `docs/sprint14-agent5-imagebackup-abschlussbericht.md` | neu | dieser Bericht |

`backup.ts` wurde **nicht** angefasst (kein Diff).

## Design

- **Wiederverwendung:** Export ruft `exportBackup()` auf, Validierung ruft
  `validateBackup()` auf, Restore ruft `restoreBackup()` auf. Alle Basis-Regeln
  (Formatkennung, Version, Schema-Check, „wirft nie") gelten unveraendert.
- **Bilder als Eingabe:** Bilder leben ausserhalb der DB (Data-URLs aus CoverGen/
  ImageGen) und werden dem Export als `ImageAssetInput[]` (`id`, `kind:
  "cover" | "generated"`, `projectId?`, `mimeType`, `dataUrl`) uebergeben.
- **Manifest:** Jedes Bild wird als `StoredImageAsset` mit `sha256` (SHA-256 ueber
  die dataUrl-Zeichenkette) + `byteLength` gespeichert; `imageCounts` zaehlt
  gesamt/cover/generated. Format: `BackupFile` + `imageBackupVersion: 1`,
  `imageCounts`, `images`.
- **Restore-Policies:** `onCorrupt` / `onMissing`: `"fail"` (Default, Restore bricht
  ab, DB bleibt unberuehrt) oder `"skip"` (DB wird wiederhergestellt, Probleme in
  `imageIssues` gelistet). Optionaler `imageStore.save()`-Hook schreibt validierte
  Bilder ins Ziel; Restore ist async und wirft nie.
- **Rueckwaertskompatibilitaet:** Alt-Backups ohne `images`-Feld validieren und
  restaurieren fehlerfrei (0 Bilder).

## Verifikation (Tool-Output, 2026-09-07)

- `npx vitest run src/services/db/backup-images.test.ts` → **12/12 bestanden**
  (SHA-256-Known-Answer `abc` + Leer-Hash, Roundtrip mit Cover+Generated,
  Hash-Stabilitaet, Leer-Export, Alt-Backup-Kompat, Korrupt-Erkennung,
  Missing-Meldung, Invalid-Abweisung, Roundtrip-Restore mit ImageStore,
  fail-Policy, skip-Policy).
- `npx vitest run src/services/db/backup.test.ts` → **17/17 bestanden** (Regression frei).
- `npx tsc -p tsconfig.json --noEmit` → **0 Fehler** in den neuen Dateien; einziger
  Repo-Fehler in `src/services/llm/promptBuilder.test.ts` (TS2493, fremde Datei,
  pre-existing, nicht von diesem Agenten verursacht).

## Selbstcheck (Status)

- [x] `backup.ts` gelesen, Pattern (export/restore/validate/checkIntegrity) verstanden
- [x] `backup-images.ts` neu, importiert + ruft `backup.ts` auf (kein Duplikat)
- [x] Manifest enthaelt Image-Hashes (SHA-256) + Laengen
- [x] Restore validiert Bildintegritaet (Hash-Nachberechnung)
- [x] 12 Tests ≥ 8 gefordert (Roundtrip, Korrupt-Erkennung, Missing-Handling)
- [x] Abschlussbericht + Selbstcheck geschrieben
- [x] Keine fremden Dateien geaendert (nur 2 neue Quelldateien + dieser Bericht)

## Offene Punkte / Hinweise an den Integrator

- Bilder muessen beim Export vom Aufrufer eingesammelt werden (z. B. aus dem
  ImageGen-Verlauf/CoverGen-State) — es gibt bewusst keinen impliziten Zugriff auf
  localStorage oder Dateisystem in diesem Modul.
- `imageStore` ist injizierbar; ein Default-Store (z. B. IndexedDB-Persistenz) kann
  spaeter von Agent 4/6 ergänzt werden, ohne dieses Modul zu aendern.
