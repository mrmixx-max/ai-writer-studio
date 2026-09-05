# Sprint 6 — Agent 5: GUI-Integration (Delivery-Log)

**Datum:** 2026-09-05
**Projekt:** AI Writer Studio v1.4.0
**Umfang:** BookWriter-Panel in die Tauri-React-Frontend integriert

---

## Ergebnis

**Alle Akzeptanzkriterien erfüllt:**

| Kriterium | Status | Nachweis |
|-----------|--------|----------|
| BookWriter-Tab in Sidebar | ✅ | Modus `bookwriter` (Label "BookWriter", Icon 📖) rendert `BookWriterDashboardPanel` — projektunabhängig, vor dem Kapitel-Guard in `ModePanel` |
| Live-Fortschritt wird angezeigt | ✅ | Polling (2 s) über `findInterruptedJobs()` auf `bookwriter_jobs` — sieht Fortschritt von App- UND CLI-Läufen; Statusableitung running/stalled/interrupted/completed inkl. Stillstands-Erkennung (5 min ohne Update) |
| Job-Recovery-Dialog bei abgebrochenen Jobs | ✅ | `BookWriterRecoveryDialog` beim App-Start (App.tsx, phase "ready") UND panel-intern; listet Läufe mit Kapitel-Fortschritt, bietet Fortsetzen (öffnet Projekt + schickt Open-Mode-Event an die Sidebar) / Verwerfen / Später |

**Gates:**
- `npm run typecheck` — clean
- `npx eslint` (alle neuen/geänderten Dateien) — clean
- `npm test` — **140 Dateien / 1562 Tests grün** (34 neue Tests aus Agent 5; Rest der Differenz zu Sprint 5 aus parallelen Sprint-6-Agenten)

---

## Neue Dateien

- `src/services/bookwriter/progress.ts` — reine GUI-Logik: `deriveJobProgressState` (Stillstands-Erkennung), `formatProgressPercent`, `formatRelativeTime`, `isJobRecoverable`, Labels/Farben, `PROGRESS_POLL_INTERVAL_MS = 2000`
- `src/services/bookwriter/progress.test.ts` — 15 Unit-Tests (node, keine DB)
- `src/components/BookWriter/BookWriterDashboard.tsx` — `BookWriterDashboardPanel` (Dashboard + Live-Fortschritt + Steuerung), `BookWriterRecoveryDialog`, `OPEN_BOOKWRITER_MODE_EVENT`
- `src/components/BookWriter/BookWriterDashboard.test.tsx` — 14 Component-Tests (jsdom, Polling mit Fake-Timern)
- `src/components/BookWriter/bookwriter.css` — Dashboard- und Dialog-Styling
- `src/components/Sidebar/bookwriterMode.test.ts` — Struktur-Guards nach navigation.test.ts-Muster (Modus im Typ + Switcher + vor Kapitel-Guard + App.tsx-Mount)

## Geänderte Dateien

- `src/components/Sidebar/Sidebar.tsx` — lazy Import `BookWriterDashboardPanel`; `bookwriter` rendert das Dashboard (Early-Return vor dem Kapitel-Guard); Event-Listener für `bookwriter:open-mode`; Label "Buch schreiben" → "BookWriter"
- `src/App.tsx` — lazy Mount von `BookWriterRecoveryDialog` nach dem Startablauf (phase "ready")

## Design-Entscheidungen

1. **Polling statt WebSocket:** Der Job-Fortschritt liegt bereits persistiert in
   `bookwriter_jobs` (Migration 018, commit pro Kapitel via `persistNow()`).
   Polling (2 s) ist zustandslos, überlebt Seitenwechsel und sieht Läufe, die
   im CLI-Prozess gestartet wurden — ein WebSocket bräuchte ein neues
   Rust/Tauri-Ereignis-Backend ohne Mehrwert.
2. **Abhängigkeitsrichtung:** Dashboard → Sidebar läuft über ein window-Event
   (`bookwriter:open-mode`), damit die Sidebar-Komponente das Dashboard nicht
   importieren muss (Sidebar importiert nur lazy runter, nicht umgekehrt).
3. **Kein Breaking Change:** Das klassische `BookWriterPanel` (Kapitelplaner,
   Generierung, Export) bleibt unverändert und ist über einen Toggle
   ("Buchgenerierung starten / steuern") direkt ins Dashboard eingebettet —
   die beiden bisherigen Resume-Dialoge (Panel C2, CLI jobRecovery) arbeiten
   unverändert weiter; der neue App-Start-Dialog deckt projektübergreifend ab,
   was C2 nur für das aktive Projekt konnte.
4. **Dialog schließt endgültig:** Der Recovery-Dialog pollt bewusst NICHT —
   nach "Später" plopt er nicht wieder auf (Polling-Loop wäre ärgerlich);
   das Dashboard selbst pollt weiter und zeigt den Job in der Liste.

## Teststrategie (TDD)

Tests zuerst geschrieben (rot bestätigt), dann implementiert:
- Unit (progress): Statusableitung inkl. Stillstands-Grenzfall `>=`, Prozent-Rechnung divisionssicher, relative Zeit, Recoverable-Prädikat.
- Component (Dashboard): Anzeige (Titel, Prozent, Kapitelzähler, Stalled-Badge), Polling-Verhalten mit `vi.useFakeTimers`, Steuerung (resume/mark/discard), Recovery-Dialog (an/ab, Fortsetzen öffnet Projekt + Event, Verwerfen löscht, Später ohne Datenänderung).
- Struktur (Sidebar): bookwriter im EditorMode-Typ, genau einmal in MODES, Dashboard-Render vor dem Kapitel-Guard, App.tsx-Mount — verhindert die historische Sidebar-Falle "Modus im Typ, aber unerreichbar".
