# Bookwriter FMEA — Fehlermodi- und Risikoanalyse (Sprint 2, Agent 1)

Komponente | Fehlermodus | Auswirkung | S | A | D | RPN | Maßnahme
---|---|---|---|---|---|---|---
OllamaProvider.chat | Timeout (Modell hängt, Ollama-Queue voll) | Kapitel-Generierung blockiert UI-Thread-Logik endlos; Nutzer sieht "generating" ohne Fortschritt | 7 | 3 | 4 | 84 | createTimeoutController (bookwriter.ts/retry.ts): kombiniert externes AbortSignal + Timeout; Timeout wirft TimeoutError → classifyError → retrybar
jsonExtract.parseJsonLoose | LLM liefert kaputtes JSON (Fences, Trailing Commas, einfache Quotes) | generateOutline wirft nach 3 Versuchen — Buchstart fehlschlag ohne Nutzer-Hinweis auf Rohdaten | 6 | 3 | 3 | 54 | Zweistufige Extraktion: fence-strip → JSON.parse → Klammer-Zustandsmaschine → repairJson → capTruncatedJson (Rettet vollständige Kapitel abgeschnittener Antworten)
bookwriter.generateOutline | Prompt-Injection / SQL-Payload in Gliederungs-Feldern | Injection-Texte landen in Outline/Kapiteln; theor. Befehlsexekution beim Persistieren | 8 | 2 | 3 | 48 | Felder sind reine Daten; DB-Zugriffe parametrisiert (sql.js prepared statements); Red-Team-Suite R02/R03 beweist: keine Ausführung, kein Crash
withRetry | Retry-Endlosschleife bei permanentem Fehler | Endloses Backoff-Warten (1s/3s/8s), Nutzer bricht ab, Job bleibt "running" | 5 | 2 | 6 | 60 | MAX_ATTEMPTS = 3 hart gedeckelt; Abort + 4xx fliegen sofort (isRetryable); nach Erschöpfung sprechender Fehler
bookwriter.generateBook | Abort mid-chapter → Ghost-State "generating" | Kapitel hängt dauerhaft im Status generating; Panel zeigt falschen Fortschritt; Resume unmöglich | 7 | 2 | 5 | 70 | isAbortError-Check in generateBook/generateChapterChunked: Status → "planned", sauberes Teilergebnis an den Aufrufer (E2E-Simulation E4)
jobs.ts (Job-Store) | Prozess-Kill mitten im Kapitel | Fortschritt seit letztem Commit verloren; Resume startet zu früh/wiederholt Kapitel | 7 | 4 | 3 | 84 | persistNow() nach JEDEM Kapitel (updateBookJobProgress); Resume liest current_chapter + outline_json aus SQLite; Kill+Resume bewiesen in E2E-Simulation E2
jobs.getResumableBookJob | Job-Row korrupt (outline_json unparsebar) | Resume crasht oder startet ohne Gliederung | 6 | 3 | 4 | 72 | parseJson mit Fallback {} / null in rowToJob; Resume ohne Outline erzwingt Neu-Generierung statt Crash (FMEA-Maßnahme, Restrisiko akzeptiert)
generateOutline (Gate) | Gliederung semantisch kaputt (falsche Kapitelzahl, doppelte Titel, < 20-Wörter-Summaries, gebrochener Bogen) | Kapitel-Generierung läuft gegen falsche Struktur; Buch entsteht unbrauchbar | 6 | 3 | 4 | 72 | B4-Qualitätsgate: validateOutline() + EIN repairOutline()-Call; danach Fehlerliste mit manuellem-Eingriff-Hinweis (Red-Team R04-R08, R13-R15)
bookwriter.generateChapter | Wortzahl außerhalb ±20 % auch nach Nachsteuer | Kapitel zu dünn/zu dick; Buch unausgewogen | 4 | 3 | 4 | 48 | B3: EIN adjustChapterWordCount-Call; danach Status "needs_revision" statt blind weiter — produktiver Loop (Agent-4-Revisions-UI)
extractEntities | Glossar-Extraktion liefert Müll/leer | Namensdrift zwischen Kapiteln (Personen heißen plötzlich anders) | 5 | 3 | 5 | 75 | parseJsonLoose + Array-Filter; mergeEntities dedupliziert case-insensitive, cappt bei 30; Glossar reist in JEDEM Kapitel-Prompt (B2)
bookwriter.generateBook | Modellwechsel mid-run (Nutzer ändert Modell oder Router fällt zurück) | Stilbruch zwischen Kapiteln; teils Mixed-Output | 4 | 3 | 5 | 60 | Kapitel-Grenze als natürliche Wechselmarke; Router-Telemetrie (provider/model pro Call); E2E-Simulation E3 beweist Weiterlauf bei Modellwechsel
FakeOllamaProvider / Test-Infra | Test-Skript erschöpft ohne letzten guten Text | Tests schlagen mit leerer Antwort fehl — flaky CI ohne echten Fehler | 2 | 4 | 5 | 40 | exhaustedText-Fallback: letzter guter Text wird wiederholt; Router-Modus für prompt-abhängige Antworten
retry.sleepWithAbort | Abort während Backoff-Wartezeit | Abbruch verzögert bis zu 8 s (schlechtes UX beim Stoppen) | 3 | 2 | 3 | 18 | sleepWithAbort lauscht auf Signal und rejected sofort mit AbortError
chapterEngine.generateChapterChunked | Chunk-Timeout bei langem Kapitel | Kapitel bleibt halbfertig mit Status needs_revision — Loop fängt es | 5 | 2 | 4 | 40 | Konfigurierbares GenerationConfig.timeoutMs + kombiniertes Signal; Catch-Path setzt Status "planned" statt Ghost-State
bookwriter (Word-Count) | countWords falsch bei Markdown-lastigem Text | Falsche Nachsteuer-Entscheidung (unnötige Calls oder needs_revision-Fehlalarm) | 3 | 3 | 4 | 36 | chapterPlan.countWords strippt Markdown (Code-Blöcke, Headers, Links, HTML) vor Token-Zählung; Grenzfälle 799/800/1200/1201 getestet
LLM-Antwort-Größe | Riesenantwort (Modell looped, num_predict ignoriert) | Memory-Spike, UI-Freeze beim Zusammenfügen, ggf. OOM im WebView | 6 | 2 | 4 | 48 | maxTokens pro Task gedeckelt (4096 Outline, 8192 Chapter, 400 Summary); Chaos-Modus "huge" (300k Wörter) in Red-Team/E2E überlebt; capTruncatedJson kappst bei >120-Zeichen-Preview-Fehlermeldung
Provider-Netzwerk | ECONNREFUSED (Ollama gestoppt) | Jeder Call schlägt sofort fehl; nach 3 Versuchen Fehler — aber keine Recovery | 6 | 3 | 4 | 72 | classifyError → "network" → retrybar mit Backoff; BookwriterRouter (Agent 2) fällt auf OpenRouter zurück; Health-Check-gated
Router (B2-Fallback) | Timeout-Quote überschritten, aber kein alternativer Provider konfiguriert | Fallback-Kette leer → "Alle Provider fehlgeschlagen" trotz laufendem lokalem Ollama | 5 | 2 | 4 | 40 | defaultChain fügt OpenRouter nur mit API-Key hinzu; Router wirft ProviderError mit letztem echten Fehler (keine stille Leere)

## Top-5-Risiken (nach RPN)

| Rang | RPN | Komponente | Fehlermodus | Begründung Priorität |
|---|---|---|---|---|
| 1 | 84 | OllamaProvider.chat | Timeout (hängender Request) | Höchste Auswirkung auf UX; häufigster Real-World-Fehler bei lokalen Modellen. Abgedeckt durch createTimeoutController + withRetry; Restrisiko: Timeout-Wert statisch (120-180 s). |
| 1 | 84 | jobs.ts | Prozess-Kill mitten im Kapitel | Datenverlust vermeiden war Sprint-2-Kernziel; persistNow() pro Kapitel + Resume aus DB. Restrisiko: Kapitel-Verlust zwischen Generierung und Commit (sekundenklein). |
| 3 | 75 | extractEntities | Glossar-Müll | Namensdrift zerstört Leserkohärenz still (kein Fehler, nur Qualität); Gate fehlt hier — Maßnahme: Glossar-Sanity-Check (Pflichtfeld-Prüfung analog validateOutline) in Sprint 3. |
| 4 | 72 | jobs.getResumableBookJob | Korruptes outline_json | Resume ist kritischer Pfad; rowToJob-Fallback verhindert Crash, Neu-Generierung ist teuer. Maßnahme: Outline-Integritätscheck vor Resume. |
| 4 | 72 | validateOutline/repair | Semantisch kaputte Gliederung | B4-Gate + EIN Repair-Call deckt ab; Restrisiko: Repair reproduziert denselben Fehler (Falle → manueller Eingriff, dokumentiert). |

## Nachweisführung (Sprint 2)

- Red-Team-Suite: `tests/bookwriter.redteam.test.ts` — 20 dokumentierte Injections (R01–R20), alle grün.
- E2E-Simulation: `tests/bookwriter.e2e.simulation.test.ts` — 8 Kapitel < 5 s, Kill+Resume, Modellwechsel, Abort, Chaos — ohne echten Ollama (CI-tauglich).
- Test-Infrastruktur: `tests/helpers/fakeOllamaProvider.ts` — skriptbarer Fake mit Chaos-Modi (timeouts/random) und Router.
- Getroffene Annahmen: S/A/D-Skala 1–10 (S=Schwere, A=Auftretenswahrscheinlichkeit, D=Entdeckung — niedrigere D-Werte bedeuten spätere Entdeckung); RPN = S×A×D.