// English translations.
import type { TranslationDict } from "./de";

export const en: TranslationDict = {
  "app.name": "AI Writer Studio",
  "common.save": "Save",
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.test": "Test",

  "header.export": "Export",
  "header.layout": "Layout",
  "header.analytics": "Analytics",
  "header.plugins": "Plugins",
  "header.settings": "Settings",
  "header.focus.on": "Focus off",
  "header.focus.off": "Focus mode",
  "header.about": "About this application",
  "header.skipToEditor": "Skip to editor",

  "warning.dbError":
    "The database could not be opened: {{error}} — changes will not be saved.",
  "warning.memoryOnly":
    "Changes are currently held in memory only and will be discarded on close.",

  "fatal.title": "The interface could not be loaded",
  "fatal.text":
    "An application error occurred. Your projects are not affected — they are stored in a separate file.",

  "settings.title": "Settings",
  "settings.provider": "Provider",
  "settings.model": "Model",
  "settings.temperature": "Temperature",
  "settings.maxTokens": "Max tokens",
  "settings.systemPrompt": "System prompt",
  "settings.theme": "Theme",
  "settings.theme.dark": "Dark",
  "settings.theme.light": "Light",
  "settings.language": "Language",
  "settings.highContrast": "High-contrast mode",
  "settings.highContrast.hint": "Boosts contrast and font sizes for better readability.",
  "settings.testConnection": "Test connection",
  "settings.testing": "Testing…",

  "shortcuts.title": "Keyboard shortcuts",
  "shortcuts.save": "Save manuscript",
  "shortcuts.focusEditor": "Move focus to editor",
  "shortcuts.focusSidebar": "Move focus to project list",
  "shortcuts.focusAI": "Move focus to AI assistant",
  "shortcuts.settings": "Open settings",
  "shortcuts.focusMode": "Toggle focus mode",
  "shortcuts.about": "Open about dialog",
  "shortcuts.help": "Show shortcut overview",
  "shortcuts.escape": "Close dialog",
};
