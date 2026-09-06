# Unreleased — Entwurf für v1.1.0 (Stand: Sprint 11, 2026-09-06)

> **Entwurf, kein Ersatz für `CHANGELOG.md` / `docs/CHANGELOG.md`.**
> Diese Datei sammelt kuratiert und in Anwendersprache, was sich seit **v1.0.0**
> getan hat (Sprints 8–11). Beim Release wird daraus per
> `node scripts/release.mjs --changelog` die offizielle Changelog-Sektion erzeugt.

## Neu: Schreiben & Buchprojekte

- **Kontinuitätsprüfung (Sprint 10):** Das Programm merkt sich Figuren, Orte und
  Fakten im Hintergrund und warnt bei Widersprüchen (z. B. geänderte Augenfarbe
  in Kapitel 7). Jedes Kapitel bekommt einen Kurzbrief für den roten Faden.
- **Lektorat (Sprint 11):** Deutsche Regelprüfung direkt in der App — mit
  eigenem Lektorats-Panel, ohne dass Text das Gerät verlassen muss.
- **Schreibziele-Plugin (Sprint 10):** Tages- und Projektziele (Wörter, Kapitel)
  mit Fortschrittsanzeige; lässt sich wie alle Plugins ein-/ausschalten.

## Neu: Export & KDP

- **Export-Prüfung (Sprint 10):** DOCX-, EPUB- und PDF-Export werden vor dem
  Schreiben validiert — inkl. Windows-Sonderzeichen und PDF-Metadaten.
- **KDP-Upload mit Wiederaufnahme (Sprint 9):** Abgebrochene Uploads werden
  fortgesetzt statt neu gestartet; verständliche Fehlermeldungen plus
  Checkliste vor dem Hochladen.
- **KDP-Paket (Sprint 11):** Paket mit Manifest, Prüfsummen und Pre-Flight-Test —
  Sie sehen vor dem Upload, ob alles vollständig ist.

## Neu: Updates, Modelle & Sprachen

- **Update-Benachrichtigung (Sprint 9/11):** Die App meldet neue Versionen in
  den Einstellungen; der Update-Feed lässt sich auch ohne Signaturschlüssel
  als Entwurf bauen.
- **Lokaler Modell-Manager (Sprint 9):** Ollama-Modelle verwalten, Status sehen,
  umschalten — direkt in den Einstellungen.
- **Vier Sprachen (Sprint 9/11):** Oberfläche auf Deutsch, Englisch, Spanisch
  und Französisch, inkl. Modell-Manager und Update-Dialogen.
- **Benutzerhandbuch + In-App-Hilfe (Sprint 10):** Vollständiges Handbuch
  (`docs/handbuch.md`) und Hilfe-Panel in der App.

## Technik & Zuverlässigkeit (kurz)

- **Schnellerer Start (Sprint 11):** Schwere Oberflächen-Teile laden erst bei
  Bedarf (Start-Paket ca. −32 %); eine Leitplanke verhindert Rückschritte.
- **Sicherheit (Sprint 8):** Sicherheitsprüfung, Bereinigung von Datei- und
  Eingabewerten, keine Geheimnisse in Protokollen.
- **Stabilität (Sprint 8/10):** Last-, Chaos- und Speichertests; automatische
  End-zu-End-Tests (Offline-Start, Buch-Ablauf, Einstellungen, Fehler-Erholung).
- **Release-Automatisierung (Sprint 9):** Versionsabgleich, Changelog- und
  Release-Notes-Erzeugung sowie Prüfsummen per Knopfdruck — weniger Handarbeit,
  weniger Fehler.
- **Barrierefreiheit (Sprint 11):** Dialoge sind per Tastatur bedienbar und
  halten den Fokus (Focus-Trap).

## Kennzahlen (Stand Sprint 11)

- Tests: **2188 grün**, Typecheck/Lint sauber.
- Versionen synchron auf **1.0.0**; Dry-Run belegt den Weg nach **1.1.0**
  (`--bump minor --dry-run`).
