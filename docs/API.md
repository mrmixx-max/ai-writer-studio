# API-Dokumentation — Service-Schicht

Alle Fachlogik von AI Writer Studio liegt in `src/services/` als reine
TypeScript-Module (kein HTTP, kein IPC in der Service-Schicht). Die
React-Oberfläche (`src/components/`) konsumiert nur diese Funktionen. Das
Tauri-Backend (`src-tauri/src/`) stellt ausschließlich Dateisystem-, Git- und
Updater-Primitiven bereit.

Konventionen:

- IDs sind UUID-Strings, Zeitstempel Unix-Millisekunden (`INTEGER`).
- Alle DB-Zugriffe laufen über `src/services/db` (sql.js, persistiert in
  `%APPDATA%\com.aiwriterstudio.app\user_data\app.db`).
- Async-Funktionen geben `Promise` zurück; reine Rechenfunktionen sind synchron.
- Die App ist **lokal-first**: KI-/Cloud-Module sind optional und failen
  definiert ohne Netz.

---

## Übersicht der Module

| Modul | Zweck |
|---|---|
| `db` | Datenbank-Initialisierung, Persistenz, Migrationen |
| `project` | Projekte & Kapitel (CRUD, Verschlüsselung, Sortierung) |
| `editor` | TipTap-DOM → Text, Wort-/Zeichenzähler |
| `fragment` | Fragmente (lose Textstellen) |
| `version` | Literarische Versionsgeschichte je Kapitel |
| `knowledge` | Projektwissen/RAG: Chunking, Index, Suchmodi, Frage-an-Projekt |
| `semantic` | Semantischer Graph (Knoten & Kanten) |
| `characters` | Figurenprofile + Export (JSON/CSV/Markdown) |
| `relationships` (in `characters`) | Figurenbeziehungen |
| `worldbuilding` | Orte, Lore, Welt-Konsistenzprüfung |
| `timeline` | Zeitstrahl, Drei-Akt-Struktur, Heldenreise |
| `bookwriter` | KI-Romanpipeline: Generierung, Streaming, Dokumente, Qualität |
| `aiwriting` | Autocomplete, Dialoggen, Stiltransfer, Schreibimpulse |
| `writing` | Wissenschaftlicher Schreibmodus (Gliederung, Abstract, Rewrite) |
| `dialogue` | Gespeicherte Dialoge je Kapitel |
| `llm` | LLM-Verbindungen (Ollama/LM Studio/OpenAI), Cover-Prompt-Optimierer |
| `ki` | Sentiment/Stil/Readability-Analyse, Chat-Persistenz |
| `prompt` | Schreibimpulse: offline + KI-generiert, Favoriten, Persistenz |
| `diagnostics` | Konsistenzprüfung + Befundpersistenz + Diagnostik-Runner |
| `stylecheck` | Regelbasierter Stil-Check (Füllwörter, Passiv, Klischees …) |
| `preflight` | KDP-/Export-Preflight, Export-Gate, Ampel |
| `snapshot` | Snapshot-Versionierung: Diff, Restore, Vorschau |
| `export` | DOCX/EPUB/PDF/Markdown/TXT-Export, Print-Layout-Übersetzung |
| `import` | DOCX/Markdown/TXT-Import, Formaterkennung |
| `printlayout` | Seitenformate, Ränder, Kopf-/Fußzeilen |
| `kdp` | KDP-Paket, Metadaten-Validierung, Checkliste |
| `marketing` | Blurb-Generator mit Varianten |
| `cloud` | Dropbox/WebDAV-Sync, Offline-Queue, Konfliktauflösung |
| `collaboration` | Diff, Kommentare, Änderungsverfolgung, Vorschläge |
| `git` | Entwurfs-/Final-Branches über Tauri-Backend |
| `sprint` | Schreibsprints und Tagesstatistik |
| `analytics` | Schreibstatistik |
| `tts` | Text-to-Speech inkl. Batch-Synthese ganzer Bücher |
| `whisper` | Audioaufnahme + Transkription |
| `voice` | Stimmen-Labor: Audionotizen, Stimmprofile |
| `security` | Passwort-Hash, Schlüsselableitung, String-Verschlüsselung, Auto-Lock |
| `settings` | App-Einstellungen, Auth-Record |
| `setup` | Erststart-Assistent, Anbieter-Probing |
| `updater` | Auto-Update (prüfen, installieren, Neustart, Fortschritt) |
| `logger` | Zentraler Logger (`src/services/logger.ts`) |
| `analytics.ts` | Metriken-Sammlung (`src/services/analytics.ts`) |

---

## Referenz (ausgewählte Kern-APIs)

### db — `src/services/db/index.ts`

```ts
initDb(): Promise<Database>      // lädt sql.js-WASM, öffnet DB, läuft Migrationen
persist(): Promise<void>         // debounced Schreiben auf Disk
persistNow(): Promise<void>      // sofortiges Schreiben
getDb(): Database                // throws, wenn initDb() nicht gelaufen
isDbReady() / isPersistent() / databasePath()
migrate(d: Database): void       // siehe MIGRATION.md
```

### project — `src/services/project/`

```ts
createProject(name): Promise<Project>
listProjects(): Project[]
renameProject(id, name) / deleteProject(id)
createChapter(projectId, title, content?): Promise<Chapter>
listChapters(projectId): Chapter[]              // sortiert nach order_index
getChapterDecrypted(id): Promise<Chapter|null>  // entschlüsselt, falls Projekt gesperrt
updateChapter(id, content) / renameChapter(id, title) / deleteChapter(id)
reorderChapter(id, orderIndex) / reorderChapters(orderedIds)
```

Kapitelinhalt wird bei aktivierter Passwortsperre mit
`security.encryptString` (AES-GCM, PBKDF2-Schlüsselableitung) verschlüsselt.

### knowledge — Projektwissen (RAG)

```ts
// Chunking (strukturorientiert; deutsche Abkürzungen, Ordinalzahlen)
adaptiveTargetTokens(text): number   // konstanten TARGET/MAX/MIN/OVERLAP_TOKENS

// Frage an das Projekt
askProject(question, options): Promise<AskResult>   // Antwort + Quellenangaben
previewContext(chunks): Promise<...>                // Kontextvorschau vor dem Senden
buildQuestion(kind: ProjectQuestionKind, subject): string

// Suchmodi: "semantic" (Embeddings), "exact" (Wortlaut), "hybrid" (Rangfusion)
// Ohne Embedding-Modell: lexikalischer BM25-Fallback, Ergebnis markiert
// die Einschränkung ausdrücklich.
```

### diagnostics — Manuskriptprüfung

```ts
checkCharacters(a): ConsistencyIssue[]   // Alter, Namensschreibweisen
checkWorld(a) / checkPointOfView(a) / checkTerminology(a) / checkTimeline(a)
levenshtein(a, b): number

runDiagnostics(...): Promise<DiagnosticReport>
listFindings(filter): Finding[]
setFindingStatus(id, status, note?)      // Status überlebt Prüfläufe (Fingerabdruck ohne Position)
```

Statuswerte: `error | possible | intentional` plus „ignoriert"; wörtliche Rede
ist von der Perspektivprüfung ausgenommen, Rückwärtszeit nur ohne
Rückblick-Signalwort gemeldet.

### preflight — Export-Preflight

```ts
applyFilter(findings, filter) / computeStats / countByCategory / sortFindings
exportGate(...)                        // Gate vor DOCX/PDF/EPUB-Export
assessReadiness(stats): Readiness      // Ampel: rot / gelb / grün
assessFormat(format, findings)
KDP_AI_DISCLOSURE                      // KI-Offenlegungshinweis für Amazon KDP
```

Entscheidungen (ignorieren / bewusst so / Verbesserungsvorschlag) werden über
einen positionslosen Fingerabdruck wiedererkannt und persistiert.

### bookwriter — KI-Romanpipeline

```ts
generateChapter(...)                   // einzelnes Kapitel
generateManuskriptStreaming(...)       // gesamtes Manuskript, Streaming + Pause
regenerateChapter(...)
listDocuments(projectId) / getDocument(id) / addDocument(input) / deleteDocument(id)
// Qualität:
//   quality.ts bewertet generierte Kapitel vor Übernahme
```

### export / import / printlayout

```ts
exportProject(projectId, options)      // DOCX/EPUB/PDF/Markdown/TXT
exportContent(...)                     // freier Inhalt
printLayoutToPdfOptions(layout): PdfLayoutOptions

importDocx(data, options) / readDocxMeta(data)
detectFormat(name): ImportFormat       // md/txt/docx
importFiles(files, options) / applyImport(doc, onProgress?)
```

PDF-Layout: `PAGE_SIZES` (inkl. KDP-Trim-Größen), `MARGIN_PRESETS`,
`DEFAULT_HEADER_FOOTER`, `renderHfToken` (Platzhalter wie `{{page}}`).

### kdp

```ts
validateKdpMetadata(metadata): ValidationResult   // severity pro Issue
isKdpReady(metadata): boolean
buildKdpChecklist(metadata): KdpChecklistItem[]
KDP_CATEGORIES                                    // gültige Amazon-Kategorien
buildKdpPackage(...) / downloadKdpPackage(...)
```

### llm — Anbieter

```ts
// Verbindungen: Ollama (localhost:11434), LM Studio (localhost:1234), OpenAI
// Schlüssel werden ausschließlich lokal gespeichert, Prüfung nur auf Knopfdruck.
// Cover-Prompt-Optimierer:
analyzeCoverInput(input): CoverWarning[]
optimizeCoverPrompt(input): OptimizedCoverPrompt
generateVariants(...)                  // mehrere Cover-Prompt-Varianten
sharpenPrompt(prompt): string
```

### cloud / collaboration

```ts
// cloud: Dropbox- und WebDAV-Provider, OfflineQueue (QueueStore-Interface,
// createMemoryStore()), Konfliktauflösung:
mergeChapterContent / mergePayloads / resolveConflict / isNewerLocally

// collaboration:
diffWords / diffLines(old, new): DiffSegment[] / diffStats / similarity
addComment / listComments / setCommentStatus / deleteComment
recordChange / listChanges / clearChanges / addSuggestion
```

### git (über Tauri-Backend `src-tauri/src/git.rs`)

```ts
createBranch(dir, name, switchTo?) / switchBranch(dir, name) / deleteBranch(dir, name, force?)
mergeBranch(dir, source): Promise<GitResult>
openDraftBranch(dir): Promise<string>   // Entwurfszweig je Projekt
promoteToFinal(dir): Promise<GitResult> // Entwurf → Fassung
parseConflicts(content) / resolveConflictContent(content, strategy) / countConflicts
```

### tts / whisper / voice

```ts
// tts
chunkChapterText(text, limit): string[]
batchSynthesizeBook(...)                // gesamtes Buch, mit Progress + Cancel
cancelBatchSynthesis()
createTTSProvider(id, config): TTSProvider

// whisper
recordAndTranscribe(...) / stopRecording()
listTranscriptions(chapterId|null) / updateTranscriptionText(id, text) / deleteTranscription(id)

// voice (Stimmen-Labor)
saveAudioNote / listAudioNotes / renameAudioNote / deleteAudioNote
startMemoRecording()
createVoice(name, description, promptTemplate) / listVoices / deleteVoice / toggleFavoriteVoice
```

### security / settings / setup / updater

```ts
// security (WebCrypto)
createAuthRecord(password) / verifyPassword(password, record)
deriveKey(password, salt): Promise<CryptoKey>
encryptString(plaintext, password) / decryptString(payload, password)
sha256Hex(data) / randomBytes(len) / toBase64 / fromBase64
autoLockMs(setting)                     // Auto-Lock-Verzögerung

// settings
loadSettings(): AppSettings / saveSettings(s)
loadAuthRecord() / saveAuthRecord(...) / clearAuthRecord()

// setup (Erststart)
probeOllama(baseUrl) / probeLmStudio(baseUrl) / probeOpenAi(apiKey)
probeLocalProviders(settings?): Promise<ProviderProbe[]>
createSampleProject(): Promise<string>
isSetupCompleted() / markSetupCompleted() / resetSetup()

// updater (tauri-plugin-updater)
checkForUpdates(): Promise<UpdateInfo|null>
installUpdate() / relaunchApp()
onUpdateProgress(cb) / onUpdateInstalled(cb)
```

### snapshot

```ts
createSnapshot(projectId, name, note?) / listSnapshots(projectId)
getSnapshot(id) / getSnapshotItems(snapshotId) / deleteSnapshot / renameSnapshot
diffSnapshots(fromId, toId): SnapshotDiff / saveDiff(diff)
restoreSnapshot(...) / previewRestore(...) / snapshotStats(projectId)
```

### timeline / worldbuilding / characters

```ts
// timeline
listEvents(projectId) / saveEvent(event) / …
THREE_ACT_STRUCTURE / HERO_JOURNEY_STAGES
assignAct(events, event) / suggestJourneyStage(event)
buildPlotStructure(events): ActAssignment[] / structureStats(events)

// worldbuilding
listLocations(projectId) / getLocation(id) / saveLocation / createLocation / deleteLocation
findLocationMentions(...)
checkWorldConsistency(projectId): ConsistencyReport / reportToMarkdown(report)
LORE_CATEGORIES

// characters
listCharacters(projectId) / getCharacter(id) / saveCharacter / deleteCharacter
buildCharacterBundle(...) → charactersToJson / charactersToCsv / charactersToMarkdown
downloadData(content, filename, mime)
```

### prompt / aiwriting / writing / marketing / ki

```ts
// prompt
pickOfflinePrompts(filters) / generatePrompts(...) / parsePrompts(raw, filters)
seedDefaultPrompts(): Promise<number> / savePrompt / setFavorite / linkToProject
getPrompt / listPrompts / deletePrompt

// aiwriting
fetchAutoComplete(req): Promise<AutoCompleteSuggestion[]>   // + heuristicSuggestions offline
generateDialog(req): Promise<DialogGeneratorResult>          // buildDialogPrompt, parseDialogLines

// writing (wissenschaftlicher Modus)
//   Gliederung, Abstract, akademisches Rewrite, Zitierstile (CitationStyle)

// marketing (Blurb-Generator)
analyzeBlurbInput(input): BlurbWarning[]
generateBlurb(input): BlurbResult / generateBlurbVariants(...) / sharpenBlurb(blurb)

// ki
analyzeSentiment / analyzeStyle / analyzeReadability / analyzeText / formatAnalysis
getDocumentContext()                    // aktueller Editorinhalt als Kontext
```

### sprint / analytics / editor / fragment / version / dialogue / semantic

```ts
// sprint
SPRINT_PRESETS / recordSprint(words, minutes) / loadSprintStats / saveSprintStats / getTodayStats()

// fragment
createFragment / listFragments(chapterId) / getFragment / updateFragment / deleteFragment
reorderFragment(id, orderIndex) / reorderFragments(orderedIds)

// version (literarische Fassungen)
createVersion(...) / listVersions(chapterId) / deleteVersion(id)

// dialogue
saveDialogue(...) / listDialogues(chapterId)

// semantic (Wissensgraph)
createNode / listNodes / deleteNode
createEdge(projectId, sourceId, targetId, label?) / listEdges / deleteEdge

// editor
tiptapToText(doc) / countWords(text) / countChars(text)
```

---

## Version & Release

- Version wird **nur** in `scripts/release.config.psd1` gepflegt;
  `scripts/sync-version.ps1` verteilt sie nach `package.json`,
  `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` und `src/version.ts`.
- Release-Ablauf: `scripts/release.ps1` (siehe README, „Windows-Build“).
- Schemamigrationen: siehe [`MIGRATION.md`](../MIGRATION.md).
- Änderungen: siehe [`CHANGELOG.md`](../CHANGELOG.md).
