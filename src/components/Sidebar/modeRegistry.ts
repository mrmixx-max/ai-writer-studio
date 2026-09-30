import type { EditorMode } from "@/types/mode";
import type { ModeEntry } from "./types";

/**
 * Zentrale Mode-Registry — Single Source of Truth für alle Sidebar-Modi.
 * 
 * Eigenschaften:
 * - wide: Panel braucht breite Sidebar (Knowledge, Diagnostics, etc.)
 * - requiresChapter: Panel braucht ein offenes Kapitel (FragmentPanel, etc.)
 * - standalone: Panel funktioniert ohne Projekt/Kapitel (BookWriter, Amazon, etc.)
 * 
 * Alle 65+ Modi sind hier definiert. Der Sidebar rendert nur noch basierend auf dieser Registry.
 */
export const MODES: ModeEntry[] = [
  // Core-Modi (breite Sidebar)
  { id: "editor", key: "sidebar.mode.editor", icon: "📝", descKey: "sidebar.modeDesc.editor", wide: true },
  { id: "prompts", key: "sidebar.mode.prompts", icon: "💡", descKey: "sidebar.modeDesc.prompts", wide: true },
  { id: "knowledge", key: "sidebar.mode.knowledge", icon: "📚", descKey: "sidebar.modeDesc.knowledge", wide: true },
  { id: "diagnostics", key: "sidebar.mode.diagnostics", icon: "🔍", descKey: "sidebar.modeDesc.diagnostics", wide: true },
  { id: "preflight", key: "sidebar.mode.preflight", icon: "✅", descKey: "sidebar.modeDesc.preflight", wide: true },
  { id: "snapshots", key: "sidebar.mode.snapshots", icon: "📂", descKey: "sidebar.modeDesc.snapshots", wide: true },
  { id: "kdp", key: "sidebar.mode.kdp", icon: "🚀", descKey: "sidebar.modeDesc.kdp", wide: true },

  // Projekt-bezogene Modi (brauchen Projekt, teils Kapitel)
  { id: "fragments", key: "sidebar.mode.fragments", icon: "🧩", descKey: "sidebar.modeDesc.fragments", requiresChapter: true },
  { id: "voices", key: "sidebar.mode.voices", icon: "🎭", descKey: "sidebar.modeDesc.voices", requiresChapter: true },
  { id: "map", key: "sidebar.mode.map", icon: "🗺️", descKey: "sidebar.modeDesc.map", requiresChapter: true },
  { id: "dialogue", key: "sidebar.mode.dialogue", icon: "💬", descKey: "sidebar.modeDesc.dialogue", requiresChapter: true },
  { id: "versions", key: "sidebar.mode.versions", icon: "🕐", descKey: "sidebar.modeDesc.versions", requiresChapter: true },
  { id: "obstruction", key: "sidebar.mode.obstruction", icon: "⛓️", descKey: "sidebar.modeDesc.obstruction", requiresChapter: true },
  { id: "dream", key: "sidebar.mode.dream", icon: "🌙", descKey: "sidebar.modeDesc.dream", requiresChapter: true },
  { id: "imagegen", key: "sidebar.mode.imagegen", icon: "🖼️", descKey: "sidebar.modeDesc.imagegen", requiresChapter: true },
  { id: "covergen", key: "sidebar.mode.covergen", icon: "📚", descKey: "sidebar.modeDesc.covergen", requiresChapter: true },
  { id: "blurbgen", key: "sidebar.mode.blurbgen", icon: "📝", descKey: "sidebar.modeDesc.blurbgen", requiresChapter: true },
  { id: "scientificwriting", key: "sidebar.mode.scientificwriting", icon: "🎓", descKey: "sidebar.modeDesc.scientificwriting", requiresChapter: true },
  { id: "timeline", key: "sidebar.mode.timeline", icon: "📅", descKey: "sidebar.modeDesc.timeline", requiresChapter: true },
  { id: "characters", key: "sidebar.mode.characters", icon: "👥", descKey: "sidebar.modeDesc.characters", requiresChapter: true },
  { id: "worldbuilding", key: "sidebar.mode.worldbuilding", icon: "🌍", descKey: "sidebar.modeDesc.worldbuilding", requiresChapter: true },
  { id: "research", key: "sidebar.mode.research", icon: "🔎", descKey: "sidebar.modeDesc.research", wide: true },
  { id: "investigate", key: "sidebar.mode.investigate", icon: "🕵️", descKey: "sidebar.modeDesc.investigate" },
  { id: "watermark", key: "sidebar.mode.watermark", icon: "💧", descKey: "sidebar.modeDesc.watermark", requiresChapter: true },
  { id: "tts", key: "sidebar.mode.tts", icon: "🔊", descKey: "sidebar.modeDesc.tts", requiresChapter: true },
  { id: "markdown", key: "sidebar.mode.markdown", icon: "📝", descKey: "sidebar.modeDesc.markdown", requiresChapter: true },
  { id: "wordstats", key: "sidebar.mode.wordstats", icon: "📊", descKey: "sidebar.modeDesc.wordstats", requiresChapter: true },
  { id: "ideas", key: "sidebar.mode.ideas", icon: "💡", descKey: "sidebar.modeDesc.ideas", requiresChapter: true },
  { id: "textquality", key: "sidebar.mode.textquality", icon: "📊", descKey: "sidebar.modeDesc.textquality", requiresChapter: true },
  { id: "bilingual", key: "sidebar.mode.bilingual", icon: "🌐", descKey: "sidebar.modeDesc.bilingual", requiresChapter: true },

  // Standalone-Modi (kein Projekt/Kapitel nötig)
  { id: "publishing", key: "sidebar.mode.publishing", icon: "📦", descKey: "sidebar.modeDesc.publishing", wide: true, standalone: true },
  { id: "bookwriter", key: "sidebar.mode.bookwriter", icon: "📖", descKey: "sidebar.modeDesc.bookwriter", standalone: true },
  { id: "redenschreiber", key: "sidebar.mode.redenschreiber", icon: "🎤", descKey: "sidebar.modeDesc.redenschreiber", standalone: true },
  { id: "teleprompter", key: "sidebar.mode.teleprompter", icon: "📜", descKey: "sidebar.modeDesc.teleprompter", standalone: true },
  { id: "amazon", key: "sidebar.mode.amazon", icon: "🛒", descKey: "sidebar.modeDesc.amazon", standalone: true },
  { id: "shortprose", key: "sidebar.mode.shortprose", icon: "✍️", descKey: "sidebar.modeDesc.shortprose", standalone: true },
  { id: "voice", key: "sidebar.mode.voice", icon: "🎙️", descKey: "sidebar.modeDesc.voice", standalone: true },
  { id: "templates", key: "sidebar.mode.templates", icon: "📝", descKey: "sidebar.modeDesc.templates", standalone: true },
  { id: "collab", key: "sidebar.mode.collab", icon: "👥", descKey: "sidebar.modeDesc.collab", standalone: true },
  { id: "outliner", key: "sidebar.mode.outliner", icon: "🌳", descKey: "sidebar.modeDesc.outliner", standalone: true },
  { id: "style-analyzer", key: "sidebar.mode.style-analyzer", icon: "🎨", descKey: "sidebar.modeDesc.style-analyzer", standalone: true },
  { id: "importer", key: "sidebar.mode.importer", icon: "📥", descKey: "sidebar.modeDesc.importer", standalone: true },
  { id: "websearch", key: "sidebar.mode.websearch", icon: "🔍", descKey: "sidebar.modeDesc.websearch", standalone: true },
  { id: "feedback", key: "sidebar.mode.feedback", icon: "🔍", descKey: "sidebar.modeDesc.feedback", standalone: true },
  { id: "prompt-library", key: "sidebar.mode.prompt-library", icon: "💡", descKey: "sidebar.modeDesc.prompt-library", standalone: true },
  { id: "search", key: "sidebar.mode.search", icon: "🔎", descKey: "sidebar.modeDesc.search", standalone: true },
  { id: "cloud-sync", key: "sidebar.mode.cloud-sync", icon: "☁️", descKey: "sidebar.modeDesc.cloud-sync", standalone: true },
  { id: "sessions", key: "sidebar.mode.sessions", icon: "💾", descKey: "sidebar.modeDesc.sessions", standalone: true },
  { id: "formatting", key: "sidebar.mode.formatting", icon: "✨", descKey: "sidebar.modeDesc.formatting", standalone: true },
  { id: "backup", key: "sidebar.mode.backup", icon: "🔒", descKey: "sidebar.modeDesc.backup", standalone: true },
  { id: "readability", key: "sidebar.mode.readability", icon: "📊", descKey: "sidebar.modeDesc.readability", standalone: true },
  { id: "translator", key: "sidebar.mode.translator", icon: "🌐", descKey: "sidebar.modeDesc.translator", standalone: true },
  { id: "mindmap", key: "sidebar.mode.mindmap", icon: "🧠", descKey: "sidebar.modeDesc.mindmap", standalone: true },
  { id: "summarizer", key: "sidebar.mode.summarizer", icon: "📝", descKey: "sidebar.modeDesc.summarizer", standalone: true },
  { id: "plot-analyzer", key: "sidebar.mode.plot-analyzer", icon: "📈", descKey: "sidebar.modeDesc.plot-analyzer", standalone: true },
  { id: "consistency", key: "sidebar.mode.consistency", icon: "🔍", descKey: "sidebar.modeDesc.consistency", standalone: true },
  { id: "repetition", key: "sidebar.mode.repetition", icon: "🔁", descKey: "sidebar.modeDesc.repetition", standalone: true },
  { id: "rewrite", key: "sidebar.mode.rewrite", icon: "✏️", descKey: "sidebar.modeDesc.rewrite", standalone: true },
  { id: "expand", key: "sidebar.mode.expand", icon: "📐", descKey: "sidebar.modeDesc.expand", standalone: true },
  { id: "condense", key: "sidebar.mode.condense", icon: "📉", descKey: "sidebar.modeDesc.condense", standalone: true },
  { id: "emotional-arc", key: "sidebar.mode.emotional-arc", icon: "💔", descKey: "sidebar.modeDesc.emotional-arc", standalone: true },
  { id: "hook", key: "sidebar.mode.hook", icon: "🎣", descKey: "sidebar.modeDesc.hook", standalone: true },
  { id: "tension", key: "sidebar.mode.tension", icon: "📈", descKey: "sidebar.modeDesc.tension", standalone: true },
  { id: "character-arc", key: "sidebar.mode.character-arc", icon: "👤", descKey: "sidebar.modeDesc.character-arc", standalone: true },
  { id: "pacing-map", key: "sidebar.mode.pacing-map", icon: "🗺️", descKey: "sidebar.modeDesc.pacing-map", standalone: true },
  { id: "conflict-map", key: "sidebar.mode.conflict-map", icon: "⚔️", descKey: "sidebar.modeDesc.conflict-map", standalone: true },
  { id: "story-structure", key: "sidebar.mode.story-structure", icon: "📜", descKey: "sidebar.modeDesc.story-structure", standalone: true },
  { id: "scene-breakdown", key: "sidebar.mode.scene-breakdown", icon: "🎬", descKey: "sidebar.modeDesc.scene-breakdown", standalone: true },
  { id: "character-network", key: "sidebar.mode.character-network", icon: "🌐", descKey: "sidebar.modeDesc.character-network", standalone: true },
  { id: "writing-pace", key: "sidebar.mode.writing-pace", icon: "🏃", descKey: "sidebar.modeDesc.writing-pace", standalone: true },
  { id: "genre", key: "sidebar.mode.genre", icon: "🎭", descKey: "sidebar.modeDesc.genre", standalone: true },
  { id: "plugin-manager", key: "sidebar.mode.plugin-manager", icon: "🧩", descKey: "sidebar.modeDesc.plugin-manager", standalone: true },
  { id: "book-idea", key: "sidebar.mode.book-idea", icon: "💡", descKey: "sidebar.modeDesc.book-idea", standalone: true },
  { id: "chat", key: "sidebar.mode.chat", icon: "💬", descKey: "sidebar.modeDesc.chat", standalone: true },
  { id: "newspaper", key: "sidebar.mode.newspaper", icon: "📰", descKey: "sidebar.modeDesc.newspaper", standalone: true },
];

/** Schnelle Lookup-Maps für performante Checks */
export const WIDE_MODES = new Set(MODES.filter((m) => m.wide).map((m) => m.id));
export const STANDALONE_MODES = new Set(MODES.filter((m) => m.standalone).map((m) => m.id));
export const REQUIRES_CHAPTER_MODES = new Set(MODES.filter((m) => m.requiresChapter).map((m) => m.id));

/** Hilfsfunktionen */
export function isWideMode(mode: EditorMode): boolean {
  return WIDE_MODES.has(mode);
}

export function isStandaloneMode(mode: EditorMode): boolean {
  return STANDALONE_MODES.has(mode);
}

export function requiresChapter(mode: EditorMode): boolean {
  return REQUIRES_CHAPTER_MODES.has(mode);
}

export function getModeEntry(mode: EditorMode): ModeEntry | undefined {
  return MODES.find((m) => m.id === mode);
}