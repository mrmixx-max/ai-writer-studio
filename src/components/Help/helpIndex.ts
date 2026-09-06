// Zentrale Hilfe-Einträge für das HelpPanel (Sprint 10, Agent 4).
//
// Standalone-Modul — bewusst KEINE Abhängigkeit zu bestehenden Panels.
// Jeder Eintrag: id, title + body auf Deutsch, EN-Fallback (titleEn/bodyEn),
// keywords für die Volltextsuche. UI-Labels in den Texten sind gegen die
// tatsächlichen Komponenten verifiziert (siehe docs/handbuch.md).

export interface HelpEntry {
  /** Stabile ID, z. B. "ollama-cors". */
  id: string;
  /** Deutscher Titel (Pflicht). */
  title: string;
  /** Deutscher Hilfetext (Pflicht, Markdown-light: Absätze + `- ` Listen). */
  body: string;
  /** Englischer Fallback-Titel. */
  titleEn: string;
  /** Englischer Fallback-Text. */
  bodyEn: string;
  /** Suchstichworte (de + en), kleingeschrieben. */
  keywords: string[];
}

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "erste-schritte",
    title: "Erste Schritte: Projekt anlegen und schreiben",
    body: `Lege links in der Sidebar über den Projekt-Baum ein Projekt an und darin ein Kapitel. Dann schreibst du im Editor in der Mitte.\n- Sidebar: Tabs „Projekte" und „Prompts" unten, darüber der Modus-Switcher (mode-switcher) für Spezialbereiche.\n- Modus-Switcher: Editor und Prompts sind Tabs; alle anderen Modi (u. a. BookWriter, KDP-Checkliste, Wissen) öffnen Spezial-Panels.\n- Tipp: Der Editor speichert Kapitel automatisch in der lokalen SQLite-Datenbank.`,
    titleEn: "Getting started: create a project and write",
    bodyEn: `Create a project in the sidebar's project tree, add a chapter, then write in the editor in the center.\n- Sidebar: "Projekte" and "Prompts" tabs at the bottom, mode-switcher above for special panels.\n- Tip: chapters auto-save into the local SQLite database.`,
    keywords: ["erste schritte", "projekt", "kapitel", "editor", "sidebar", "getting started", "project", "chapter"],
  },
  {
    id: "ollama-einrichten",
    title: "Ollama einrichten (lokales Modell verbinden)",
    body: `1. Ollama installieren und starten (Standard-Adresse http://localhost:11434).\n2. Öffne „Einstellungen" → Abschnitt „Anbieter": Klappe die Ollama-Karte über „Felder" auf und trage die Ollama-Base-URL ein.\n3. Klicke „Verbindung testen" — die Status-Ampel zeigt „erreichbar · … ms" plus Modell-Anzahl.\n4. Wähle im Feld „Modell" ein erkanntes Modell (z. B. llama3.2) oder tippe den Namen ein.\n5. Klicke „Speichern" (der gelbe Punkt markiert ungespeicherte Änderungen; „Änderungen verwerfen" setzt zurück).`,
    titleEn: "Set up Ollama (connect a local model)",
    bodyEn: `1. Install and start Ollama (default http://localhost:11434).\n2. Open "Einstellungen" → "Anbieter": expand the Ollama card via "Felder" and set the Ollama base URL.\n3. Click "Verbindung testen" — the status light shows reachable + latency + model count.\n4. Pick a discovered model in the "Modell" field (e.g. llama3.2).\n5. Click "Speichern".`,
    keywords: ["ollama", "einrichten", "anbieter", "verbindung testen", "felder", "modell", "speichern", "setup", "provider"],
  },
  {
    id: "ollama-cors",
    title: "Ollama-CORS-Fehler (403) beheben mit OLLAMA_ORIGINS",
    body: `Symptom: „Verbindung testen" meldet CORS blockiert (403), oder der Dev-Modus im Browser scheitert.\n- Ursache: Ollama blockt WebView-Requests, deren Origin nicht in OLLAMA_ORIGINS steht.\n- Lösung (Desktop-App normal): Keine Aktion nötig — Requests laufen über den Tauri-Kern und unterliegen nicht den Browser-CORS-Regeln.\n- Lösung (Browser/Dev-Modus, z. B. http://localhost:5173): Ollama mit Origin-Liste starten, z. B.:\n  OLLAMA_ORIGINS="tauri://localhost,http://tauri.localhost,http://localhost:5173" ollama serve\n- Danach erneut „Verbindung testen".`,
    titleEn: "Fix Ollama CORS errors (403) with OLLAMA_ORIGINS",
    bodyEn: `Symptom: connection test reports CORS blocked (403).\n- Desktop app: no action needed — requests go through the Tauri core, not browser CORS.\n- Browser/dev mode (e.g. http://localhost:5173): start Ollama with e.g. OLLAMA_ORIGINS="tauri://localhost,http://tauri.localhost,http://localhost:5173" ollama serve, then test again.`,
    keywords: ["cors", "403", "ollama_origins", "origin", "verbindung testen", "dev-modus", "tauri", "localhost:5173", "fix"],
  },
  {
    id: "modelle-laden",
    title: "Modelle laden und löschen (Modelle (lokal))",
    body: `Das Panel „Modelle (lokal)" zeigt installierte Ollama-Modelle (Adresse oben als „Ollama: … · Verzeichnis: …").\n- „Aktualisieren" lädt die Liste neu („Modelle werden geladen…" / „Keine Modelle installiert.").\n- „Modell laden": Namen eintragen (Platzhalter z. B. llama3.2, qwen2.5:7b), dann „Laden". Der Fortschrittsbalken zeigt Prozent; „Abbrechen" stoppt.\n- Pro Modell: „Löschen" (mit Rückfrage, dann „wird gelöscht…").\n- Warnung „Wenig freier Plattenplatz": vor dem Laden Speicher freigeben. „Gesamt:" zeigt den belegten Platz.`,
    titleEn: "Pull and delete models (Modelle (lokal))",
    bodyEn: `The "Modelle (lokal)" panel lists installed Ollama models.\n- "Aktualisieren" refreshes; "Modell laden" + "Laden" pulls a model (e.g. llama3.2) with progress bar and "Abbrechen".\n- Per model: "Löschen" deletes it (with confirmation).\n- Heed the low-disk-space warning before pulling.`,
    keywords: ["modell laden", "modelle", "lokal", "aktualisieren", "laden", "löschen", "abbrechen", "platte", "pull", "delete"],
  },
  {
    id: "bookwriter",
    title: "BookWriter: Buch automatisch generieren",
    body: `Der Modus „📖 BookWriter" (Sidebar-Switcher) bzw. das Panel „BookWriterDashboardPanel" führt ganze Bücher:\n- Thema, Genre (z. B. Sachbuch), Zielgruppe, Kapitelanzahl und Stil-Preset wählen, Gliederung erzeugen, dann Kapitel generieren.\n- Status-Badges je Kapitel: „Geplant", „Generierung läuft", „Entwurf", „Überarbeitung nötig", „Abgeschlossen".\n- Jedes fertige Kapitel wird sofort in SQLite geschrieben (Status „Entwurf").\n- Abgebrochene Läufe: Der Recovery-Dialog („BookWriterRecoveryDialog") bietet „▶ Fortsetzen" (ab Kapitel N) oder „Später".`,
    titleEn: "BookWriter: generate a book automatically",
    bodyEn: `The "📖 BookWriter" mode generates whole books: topic, genre, audience, chapter count, style preset, outline, then chapters.\n- Chapter badges: planned / generating / draft / needs revision / completed.\n- Interrupted runs: the recovery dialog offers "▶ Fortsetzen" or "Später".`,
    keywords: ["bookwriter", "buch", "generieren", "gliederung", "kapitel", "fortsetzen", "recovery", "outline", "generate"],
  },
  {
    id: "export",
    title: "Exportieren: DOCX, PDF, EPUB, Markdown, Text",
    body: `Über die Schaltfläche „Export ▾" (oben in der App) öffnest du den Export-Dialog:\n- „Format": DOCX, MD, TXT, PDF oder EPUB (Großbuchstaben im Menü).\n- „Bereich": „Ganzes Projekt" oder „Aktuelles Kapitel".\n- Bei DOCX/PDF/EPUB läuft vorher automatisch ein Preflight-Check; blockierende Befunde brauchen eine Bestätigung, verhindern den Export aber nie.`,
    titleEn: "Export: DOCX, PDF, EPUB, Markdown, Text",
    bodyEn: `Use the "Export ▾" button to open the export dialog.\n- "Format": DOCX, MD, TXT, PDF or EPUB.\n- "Bereich": whole project ("Ganzes Projekt") or current chapter ("Aktuelles Kapitel").\n- DOCX/PDF/EPUB run an export preflight check first.`,
    keywords: ["export", "docx", "pdf", "epub", "markdown", "bereich", "ganzes projekt", "aktuelles kapitel", "preflight"],
  },
  {
    id: "kdp",
    title: "KDP-Checkliste und KDP-Paket exportieren",
    body: `Der Modus „KDP-Checkliste" zeigt die Prüfpunkte des aktiven BookWriter-Laufs („X/Y Punkte erfüllt"):\n- Ampel je Punkt: ✔ ok, ⚠ Warnung, ✘ Fehler. „↻" lädt neu.\n- Pflicht: Metadaten vollständig (Titel, Klappentext, Keywords), Cover vorhanden.\n- Button „KDP-Paket exportieren" (zeigt „Export läuft…" währenddessen): enthält DOCX, PDF, EPUB, Cover und kdp-metadata.json in einem Ordner.\n- Vor dem KDP-Upload zusätzlich die Pre-Upload-Checkliste prüfen: „Dateiformat DOCX/EPUB", „Dateigröße im Limit", „Metadaten vollständig (Titel, Klappentext, Keywords)", „Preis gesetzt (0,99–200 USD)", „Cover vorhanden", „ISBN (optional — KDP vergibt eigene)".`,
    titleEn: "KDP checklist and KDP package export",
    bodyEn: `The "KDP-Checkliste" mode shows checks for the active BookWriter run ("X/Y Punkte erfüllt").\n- "KDP-Paket exportieren" exports DOCX, PDF, EPUB, cover and kdp-metadata.json into one folder.\n- Before uploading, verify the pre-upload checklist (format, size, metadata, price 0.99–200 USD, cover, ISBN).`,
    keywords: ["kdp", "checkliste", "paket", "exportieren", "cover", "metadaten", "isbn", "preis", "upload", "kindle"],
  },
  {
    id: "einstellungen",
    title: "Einstellungen: Modell, Temperatur, Max Tokens",
    body: `Im Panel „Einstellungen" (gelber Punkt = ungespeicherte Änderungen):\n- „Modell": erkannte Modelle des aktiven Anbieters (Hinweis „… Modelle gefunden.") oder freie Eingabe (z. B. llama3.2).\n- „Temperatur: …" (Schieberegler 0–1): 0 = exakt, 1 = einfallsreich.\n- „Max Tokens" (256–8192): maximale Antwortlänge.\n- „System-Prompt": Grundanweisung an das Modell (Ton/Rolle).\n- Design/Sprache: Theme (dunkel/hell), Sprache, Checkbox für hohen Kontrast.\n- Speichern mit „Speichern •", zurücksetzen mit „Änderungen verwerfen".`,
    titleEn: "Settings: model, temperature, max tokens",
    bodyEn: `In the "Einstellungen" panel:\n- "Modell": discovered models or free input.\n- "Temperatur" slider (0–1): 0 = exact, 1 = creative.\n- "Max Tokens" (256–8192), "System-Prompt" for tone/role.\n- Save with "Speichern", reset with "Änderungen verwerfen".`,
    keywords: ["einstellungen", "modell", "temperatur", "max tokens", "system-prompt", "theme", "sprache", "kontrast", "speichern", "settings"],
  },
  {
    id: "updates",
    title: "App-Updates prüfen und installieren",
    body: `Der Abschnitt „App-Updates" (in den Einstellungen) zeigt den Status („Noch nicht geprüft.", „Die App ist aktuell.", „Update verfügbar." …):\n- „Nach Updates suchen" prüft den Update-Feed (installierte Version steht bei „Installiert: …").\n- Bei Verfügbarkeit: „Release-Notes (…)" aufklappen, dann „Update installieren" (oder „Erneut prüfen").\n- Nach Download + Installation: „Jetzt neu starten" klicken, um die neue Version zu verwenden.`,
    titleEn: "Check for and install app updates",
    bodyEn: `The "App-Updates" section shows the update status.\n- "Nach Updates suchen" checks the feed; "Update installieren" downloads it.\n- After install, click "Jetzt neu starten" to use the new version.`,
    keywords: ["update", "updates", "app-updates", "nach updates suchen", "installieren", "neu starten", "release-notes", "version"],
  },
  {
    id: "probleme",
    title: "Probleme lösen (Troubleshooting)",
    body: `- KI antwortet nicht: Anbieter-Karte prüfen („Verbindung testen"), Modellname im Feld „Modell" prüfen, „Speichern" nicht vergessen.\n- „… nicht erreichbar": Server läuft? Base-URL mit http:// und Port (Ollama :11434, LM Studio z. B. http://localhost:1234/v1)?\n- 403/CORS: siehe Eintrag „Ollama-CORS-Fehler (403) beheben".\n- Kapitel weg? Projekt-Baum neu laden; Kapitel liegen in SQLite (Entwurf-Status), Recovery-Dialog mit „▶ Fortsetzen" beachten.\n- Export schlägt fehl: kleineren „Bereich" („Aktuelles Kapitel") testen, bei DOCX/PDF/EPUB Preflight-Hinweise lesen.\n- App startet nicht nach Update: Installer erneut ausführen (siehe Handbuch, Abschnitt Updates).`,
    titleEn: "Troubleshooting",
    bodyEn: `- No AI answer: check provider card ("Verbindung testen"), model name, and click "Speichern".\n- Not reachable: is the server running? Correct base URL with port?\n- 403/CORS: see the Ollama CORS entry.\n- Missing chapter: reload the project tree; drafts live in SQLite.\n- Export fails: try "Aktuelles Kapitel" scope and read preflight hints.`,
    keywords: ["probleme", "fehler", "troubleshooting", "hilfe", "nicht erreichbar", "403", "kapitel weg", "export", "startet nicht", "fix"],
  },
];

/** Alle Hilfe-IDs (für Tests/Doku). */
export const HELP_IDS: string[] = HELP_ENTRIES.map((e) => e.id);

/** Eintrag per ID finden (undefined wenn unbekannt). */
export function getHelpEntry(id: string): HelpEntry | undefined {
  return HELP_ENTRIES.find((e) => e.id === id);
}

/** Fallback-Titel: Deutsch bevorzugt, sonst Englisch. */
export function helpTitle(e: HelpEntry, lang: string): string {
  return lang.startsWith("en") ? e.titleEn || e.title : e.title || e.titleEn;
}

/** Fallback-Text: Deutsch bevorzugt, sonst Englisch. */
export function helpBody(e: HelpEntry, lang: string): string {
  return lang.startsWith("en") ? e.bodyEn || e.body : e.body || e.bodyEn;
}

/**
 * Volltextsuche über Titel, Body, Keywords (de + en).
 * Leere Query → alle Einträge. Case-insensitiv, trimmt.
 */
export function searchHelp(query: string): HelpEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...HELP_ENTRIES];
  return HELP_ENTRIES.filter((e) =>
    [e.title, e.body, e.titleEn, e.bodyEn, ...e.keywords]
      .join("\n")
      .toLowerCase()
      .includes(q),
  );
}
