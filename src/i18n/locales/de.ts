// Deutsche Übersetzungen (Referenz-Sprache).
export const de = {
  // Allgemeines
  "app.name": "AI Writer Studio",
  "common.save": "Speichern",
  "common.close": "Schließen",
  "common.cancel": "Abbrechen",
  "common.test": "Testen",

  // Kopfzeile
  "header.export": "Export",
  "header.layout": "Layout",
  "header.analytics": "Analytics",
  "header.plugins": "Plugins",
  "header.settings": "Einstellungen",
  "header.focus.on": "Fokus aus",
  "header.focus.off": "Fokusmodus",
  "header.about": "Über diese Anwendung",
  "header.skipToEditor": "Direkt zum Editor springen",

  // Warnung
  "warning.dbError": "Die Datenbank konnte nicht geöffnet werden: {{error}} — Änderungen werden nicht gespeichert.",
  "warning.memoryOnly": "Änderungen werden derzeit nur im Arbeitsspeicher gehalten und beim Schließen verworfen.",

  // Fehlerseite
  "fatal.title": "Die Oberfläche konnte nicht geladen werden",
  "fatal.text": "Es liegt ein Fehler in der Anwendung vor. Deine Projekte sind davon nicht betroffen — sie liegen in einer separaten Datei.",

  // Einstellungen
  "settings.title": "Einstellungen",
  "settings.provider": "Provider",
  "settings.model": "Modell",
  "settings.temperature": "Temperatur",
  "settings.maxTokens": "Max Tokens",
  "settings.systemPrompt": "System-Prompt",
  "settings.theme": "Design",
  "settings.theme.dark": "Dunkel",
  "settings.theme.light": "Hell",
  "settings.language": "Sprache",
  "settings.highContrast": "Hochkontrast-Modus",
  "settings.highContrast.hint": "Erhöht Kontraste und Schriftgrößen für bessere Lesbarkeit.",
  "settings.testConnection": "Verbindung testen",
  "settings.testing": "Teste…",

  // Tastaturkürzel
  "shortcuts.title": "Tastaturkürzel",
  "shortcuts.save": "Manuskript speichern",
  "shortcuts.focusEditor": "Zum Editor wechseln",
  "shortcuts.focusSidebar": "Zur Projektliste wechseln",
  "shortcuts.focusAI": "Zum KI-Assistenten wechseln",
  "shortcuts.settings": "Einstellungen öffnen",
  "shortcuts.focusMode": "Fokusmodus umschalten",
  "shortcuts.about": "Über-Dialog öffnen",
  "shortcuts.help": "Kürzel-Übersicht anzeigen",
  "shortcuts.escape": "Dialog schließen",
} as const;

export type TranslationKey = keyof typeof de;
export type TranslationDict = Record<TranslationKey, string>;
