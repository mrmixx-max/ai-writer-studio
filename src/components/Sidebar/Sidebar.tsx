// Sidebar mit Avantgarde-Modus-Switcher + Projekt-Baum.
// Bloomberg-Terminal-Thema (Sprint 18, Agent 2): Stile in sidebar.css.
import "./sidebar.css";
import { memo, useCallback, useMemo, useState, useEffect, useRef, lazy, Suspense } from "react";
import type { Project, Chapter } from "@/types/project";
import type { TranslationChapter } from "@/services/bookwriter/translatorService";
import { useProjectStore } from "@/store/projectStore";
import { usePromptStore } from "@/store/promptStore";
import { useI18n } from "@/i18n";

// Modi, die die Sidebar ebenfalls verbreitern ("wide") — als Set, damit die
// JSX-Bedingung kurz bleibt und navigation.test.ts die Struktur pruefen kann.
const WIDE_EXTRA_MODES = new Set<string>([
  "research", "publishing", "investigate", "watermark", "tts",
  "bookwriter", "markdown", "wordstats", "ideas", "consistency",
  "newspaper", "textquality", "bilingual", "amazon", "shortprose",
  "templates", "voice", "style-analyzer", "websearch", "outliner",
  "scene-breakdown", "feedback", "sessions", "backup", "search", "prompt-library",
  "readability",
]);

// Lazy-loaded Panels — werden erst beim ersten Zugriff geladen
const PromptGenerator = lazy(() =>
  import("@/components/PromptGenerator/PromptGenerator").then((m) => ({ default: m.PromptGenerator }))
);
const KnowledgePanel = lazy(() =>
  import("@/components/Knowledge/KnowledgePanel").then((m) => ({ default: m.KnowledgePanel }))
);
const DiagnosticsPanel = lazy(() =>
  import("@/components/Diagnostics/DiagnosticsPanel").then((m) => ({ default: m.DiagnosticsPanel }))
);
const PreflightPanel = lazy(() =>
  import("@/components/Preflight/PreflightPanel").then((m) => ({ default: m.PreflightPanel }))
);
const SnapshotPanel = lazy(() =>
  import("@/components/Preflight/SnapshotPanel").then((m) => ({ default: m.SnapshotPanel }))
);
const KdpChecklistPanel = lazy(() =>
  import("@/components/KDP/KdpChecklistPanel").then((m) => ({ default: m.KdpChecklistPanel }))
);
const PublishingAssistantPanel = lazy(() =>
  import("@/components/Publishing/PublishingAssistantPanel").then((m) => ({ default: m.PublishingAssistantPanel }))
);
const FragmentPanel = lazy(() =>
  import("@/components/Fragment/FragmentPanel").then((m) => ({ default: m.FragmentPanel }))
);
const VoiceLab = lazy(() =>
  import("@/components/VoiceLab/VoiceLab").then((m) => ({ default: m.VoiceLab }))
);
const SemanticMap = lazy(() =>
  import("@/components/SemanticMap/SemanticMap").then((m) => ({ default: m.SemanticMap }))
);
const DialoguePanel = lazy(() =>
  import("@/components/Dialogue/DialoguePanel").then((m) => ({ default: m.DialoguePanel }))
);
const VersionsPanel = lazy(() =>
  import("@/components/Versions/VersionsPanel").then((m) => ({ default: m.VersionsPanel }))
);
const ObstructionPanel = lazy(() =>
  import("@/components/Obstruction/ObstructionPanel").then((m) => ({ default: m.ObstructionPanel }))
);
const DreamLogicPanel = lazy(() =>
  import("@/components/DreamLogic/DreamLogicPanel").then((m) => ({ default: m.DreamLogicPanel }))
);
// Sprint 6 (Agent 5): BookWriter-Dashboard — eigener Modus mit Übersicht,
// Live-Fortschritt und Steuerung. Braucht kein offenes Kapitel.
const BookWriterDashboardPanel = lazy(() =>
  import("@/components/BookWriter/BookWriterDashboard").then((m) => ({ default: m.BookWriterDashboardPanel }))
);
const ImageGenerationPanel = lazy(() =>
  import("@/components/ImageGen/ImageGenPanel").then((m) => ({ default: m.ImageGenerationPanel }))
);
const CoverGenPanel = lazy(() =>
  import("@/components/CoverGen/CoverGenPanel").then((m) => ({ default: m.CoverGenPanel }))
);
const BlurbGenPanel = lazy(() =>
  import("@/components/BlurbGen/BlurbGenPanel").then((m) => ({ default: m.BlurbGenPanel }))
);
const ScientificWritingPanel = lazy(() =>
  import("@/components/ScientificWriting/ScientificWritingPanel").then((m) => ({ default: m.ScientificWritingPanel }))
);
const TimelinePanel = lazy(() =>
  import("@/components/Timeline/TimelinePanel").then((m) => ({ default: m.TimelinePanel }))
);
const WorldbuildingPanel = lazy(() =>
  import("@/components/Worldbuilding/WorldbuildingPanel").then((m) => ({ default: m.WorldbuildingPanel }))
);
const InvestigatePanel = lazy(() =>
  import("@/components/Writing/InvestigatePanel").then((m) => ({ default: m.InvestigatePanel }))
);
const WatermarkPanel = lazy(() =>
  import("@/components/Writing/WatermarkPanel").then((m) => ({ default: m.WatermarkPanel }))
);
const TTSPanel = lazy(() =>
  import("@/components/Writing/TTSPanel").then((m) => ({ default: m.TTSPanel }))
);
const MarkdownViewerPanel = lazy(() =>
  import("@/components/Writing/MarkdownViewerPanel").then((m) => ({ default: m.MarkdownViewerPanel }))
);
const WordStatsPanel = lazy(() =>
  import("@/components/Writing/WordStatsPanel").then((m) => ({ default: m.WordStatsPanel }))
);
const IdeasPanel = lazy(() =>
  import("@/components/Writing/IdeasPanel").then((m) => ({ default: m.IdeasPanel }))
);
const ConsistencyPanel = lazy(() =>
  import("@/components/Writing/ConsistencyPanel").then((m) => ({ default: m.ConsistencyPanel }))
);
const NewsGeneratorPanel = lazy(() =>
  import("@/components/News/NewsGeneratorPanel").then((m) => ({ default: m.NewsGeneratorPanel }))
);
const TextQualityPanel = lazy(() =>
  import("@/components/BookWriter/TextQualityPanel").then((m) => ({ default: m.TextQualityPanel }))
);
const BilingualPanel = lazy(() =>
  import("@/components/BookWriter/BilingualPanel").then((m) => ({ default: m.BilingualPanel }))
);
const ShortprosePanel = lazy(() =>
  import("@/components/BookWriter/ShortprosePanel").then((m) => ({ default: m.ShortprosePanel }))
);
const CollabPanel = lazy(() =>
  import("@/components/Collab/CollabPanel").then((m) => ({ default: m.CollabPanel }))
);
const TemplatePanel = lazy(() =>
  import("@/components/Templates/TemplatePanel").then((m) => ({ default: m.TemplatePanel }))
);
const ResearchPanel = lazy(() =>
  import("@/components/Research/ResearchPanel").then((m) => ({ default: m.ResearchPanel }))
);
const OutlinerPanel = lazy(() =>
  import("@/components/Outliner/OutlinerPanel").then((m) => ({ default: m.OutlinerPanel }))
);
const AmazonPanel = lazy(() =>
  import("@/components/Amazon/AmazonPanel").then((m) => ({ default: m.AmazonPanel }))
);
const CharactersPanel = lazy(() =>
  import("@/components/Characters/CharactersPanel").then((m) => ({ default: m.CharactersPanel }))
);
// Sprint 22 (Agent 6): Stil-Analyse — Autoren-Vergleich, standalone (kein Kapitel nötig).
const StyleAnalyzerPanel = lazy(() =>
  import("@/components/StyleAnalyzer/StyleAnalyzerPanel").then((m) => ({ default: m.StyleAnalyzerPanel }))
);
const VoiceLabPanel = lazy(() =>
  import("@/components/VoiceLab/VoiceLabPanel").then((m) => ({ default: m.VoiceLabPanel }))
);
const WebsearchPanel = lazy(() =>
  import("@/components/Websearch/WebsearchPanel").then((m) => ({ default: m.WebsearchPanel }))
);
const ImporterPanel = lazy(() =>
  import("@/components/Importer/ImporterPanel").then((m) => ({ default: m.ImporterPanel }))
);
const SceneBreakdownPanel = lazy(() =>
  import("@/components/SceneBreakdown/SceneBreakdownPanel").then((m) => ({ default: m.SceneBreakdownPanel }))
);
// Sprint 23 (Agent 2): KI-Review — freier Text, standalone (kein Kapitel nötig).
const FeedbackPanel = lazy(() =>
  import("@/components/Feedback/FeedbackPanel").then((m) => ({ default: m.FeedbackPanel }))
);
// Sprint 24 (Agent 4): Prompt-Bibliothek — eigene Sammlung, standalone (kein Kapitel nötig).
const PromptLibraryPanel = lazy(() =>
  import("@/components/PromptLibrary/PromptLibraryPanel").then((m) => ({ default: m.PromptLibraryPanel }))
);
// Sprint 24 (Agent 5): Erweiterte Formatierung — Markdown-Toolbar + Shortcuts, standalone.
const FormattingPanel = lazy(() =>
  import("@/components/Formatting/FormattingPanel").then((m) => ({ default: m.FormattingPanel }))
);
// Sprint 24 (Agent 6): Automatisches Backup — Backup-Liste + Zeitplan, standalone.
const BackupPanel = lazy(() =>
  import("@/components/Backup/BackupPanel").then((m) => ({ default: m.BackupPanel }))
);
// Sprint 24 (Agent 3): Sitzungs-Manager — Sessions speichern/laden, standalone.
const SessionPanel = lazy(() =>
  import("@/components/Session/SessionPanel").then((m) => ({ default: m.SessionPanel }))
);
// Sprint 25 (Agent 4): Lesbarkeits-Metriken — 6 Metriken + Radar, standalone.
const ReadabilityPanel = lazy(() =>
  import("@/components/Readability/ReadabilityPanel").then((m) => ({ default: m.ReadabilityPanel }))
);
// Sprint 24 (Agent 2): Volltextsuche + Ersetzen — projektuebergreifend, standalone.
const SearchPanel = lazy(() =>
  import("@/components/Search/SearchPanel").then((m) => ({ default: m.SearchPanel }))
);
import {
  renameProject, renameChapter, deleteProject, deleteChapter,
} from "@/services/project";
import type { EditorMode } from "@/types/mode";

const MODES: { id: EditorMode; key: string; icon: string; description: string }[] = [
  { id: "editor", key: "sidebar.mode.editor", icon: "📝", description: "Text schreiben und bearbeiten" },
  { id: "prompts", key: "sidebar.mode.prompts", icon: "💡", description: "Ideen und Prompts erzeugen" },
  { id: "knowledge", key: "sidebar.mode.knowledge", icon: "📚", description: "Projektwissen verwalten" },
  { id: "diagnostics", key: "sidebar.mode.diagnostics", icon: "🔍", description: "Manuskript prüfen" },
  { id: "preflight", key: "sidebar.mode.preflight", icon: "✅", description: "Export prüfen und freigeben" },
  { id: "snapshots", key: "sidebar.mode.snapshots", icon: "📂", description: "Versionen sichern und vergleichen" },
  { id: "kdp", key: "sidebar.mode.kdp", icon: "🚀", description: "KDP-Paket erstellen" },
  { id: "publishing", key: "sidebar.mode.publishing", icon: "📦", description: "Veröffentlichung vorbereiten" },
  { id: "fragments", key: "sidebar.mode.fragments", icon: "🧩", description: "Textfragmente sammeln" },
  { id: "voices", key: "sidebar.mode.voices", icon: "🎭", description: "Stimmen und Stile verwalten" },
  { id: "map", key: "sidebar.mode.map", icon: "🗺️", description: "Semantische Karte ansehen" },
  { id: "dialogue", key: "sidebar.mode.dialogue", icon: "💬", description: "Dialoge prüfen und verbessern" },
  { id: "versions", key: "sidebar.mode.versions", icon: "🕐", description: "Versionsgeschichte ansehen" },
  { id: "obstruction", key: "sidebar.mode.obstruction", icon: "⛓️", description: "Schreibblockaden überwinden" },
  { id: "dream", key: "sidebar.mode.dream", icon: "🌙", description: "Traumlogik erkunden" },
  { id: "imagegen", key: "sidebar.mode.imagegen", icon: "🖼️", description: "Bilder erzeugen" },
  { id: "covergen", key: "sidebar.mode.covergen", icon: "📚", description: "Cover entwerfen" },
  { id: "blurbgen", key: "sidebar.mode.blurbgen", icon: "📝", description: "Klappentext schreiben" },
  { id: "scientificwriting", key: "sidebar.mode.scientificwriting", icon: "🎓", description: "Wissenschaftlich schreiben" },
  { id: "timeline", key: "sidebar.mode.timeline", icon: "📅", description: "Zeitleiste für Handlung" },
  { id: "characters", key: "sidebar.mode.characters", icon: "👥", description: "Figuren verwalten" },
  { id: "worldbuilding", key: "sidebar.mode.worldbuilding", icon: "🌍", description: "Welt entwerfen" },
  { id: "research", key: "sidebar.mode.research", icon: "🔎", description: "Recherche starten" },
  { id: "investigate", key: "sidebar.mode.investigate", icon: "🕵️", description: "Investigativ prüfen" },
  { id: "watermark", key: "sidebar.mode.watermark", icon: "💧", description: "KI-Spuren waschen" },
  { id: "tts", key: "sidebar.mode.tts", icon: "🔊", description: "Text vorlesen lassen" },
  { id: "bookwriter", key: "sidebar.mode.bookwriter", icon: "📖", description: "Buch automatisch schreiben" },
  { id: "markdown", key: "sidebar.mode.markdown", icon: "📝", description: "Markdown ansehen und exportieren" },
  { id: "wordstats", key: "sidebar.mode.wordstats", icon: "📊", description: "Wortstatistik ansehen" },
  { id: "ideas", key: "sidebar.mode.ideas", icon: "💡", description: "Ideen sammeln" },
  { id: "consistency", key: "sidebar.mode.consistency", icon: "✅", description: "Konsistenz prüfen" },
  { id: "newspaper", key: "sidebar.mode.newspaper", icon: "📰", description: "Zeitung aus Web-Recherche erstellen" },
  { id: "textquality", key: "sidebar.mode.textquality", icon: "📊", description: "Text verbessern: Lektorat und Qualität" },
  { id: "bilingual", key: "sidebar.mode.bilingual", icon: "🌐", description: "Deutsch↔Englisch Übersetzung" },
  { id: "amazon", key: "sidebar.mode.amazon", icon: "🛒", description: "Buchsuche + Preis-Monitoring" },
  { id: "shortprose", key: "sidebar.mode.shortprose", icon: "✍️", description: "Flash Fiction + Micro-Stories" },
  { id: "templates", key: "sidebar.mode.templates", icon: "📝", description: "Text-Vorlagen + Generator" },
  { id: "collab", key: "sidebar.mode.collab", icon: "👥", description: "Kommentare + Reviews" },
  { id: "voice", key: "sidebar.mode.voice", icon: "🎙️", description: "Sprachaufnahme + Transkription" },
  { id: "style-analyzer", key: "sidebar.mode.style-analyzer", icon: "🎨", description: "Vergleich mit Autoren" },
  { id: "importer", key: "sidebar.mode.importer", icon: "📥", description: "DOCX/EPUB/PDF/TXT" },
  { id: "websearch", key: "sidebar.mode.websearch", icon: "🔍", description: "SerpAPI + DDG + Brave" },
  { id: "outliner", key: "sidebar.mode.outliner", icon: "🌳", description: "Strukturierte Gliederung" },
  { id: "scene-breakdown", key: "sidebar.mode.scene-breakdown", icon: "🎬", description: "Drehbuch/Roman Szenen-Analyse" },
  { id: "feedback", key: "sidebar.mode.feedback", icon: "🔍", description: "LLM-gestützte Verbesserungsvorschläge" },
  { id: "cloud-sync", key: "sidebar.mode.cloud-sync", icon: "☁️", description: "Dropbox/GDrive/OneDrive" },
  { id: "sessions", key: "sidebar.mode.sessions", icon: "💾", description: "Sitzungen speichern/laden" },
  { id: "formatting", key: "sidebar.mode.formatting", icon: "✨", description: "Markdown-Toolbar + Shortcuts" },
  { id: "backup", key: "sidebar.mode.backup", icon: "🔒", description: "Automatische Backups" },
  { id: "search", key: "sidebar.mode.search", icon: "🔎", description: "Volltextsuche + Ersetzen" },
  { id: "prompt-library", key: "sidebar.mode.prompt-library", icon: "💡", description: "Prompt-Bibliothek" },
  { id: "readability", key: "sidebar.mode.readability", icon: "📊", description: "Flesch + Gunning Fog + Coleman-Liau" },
];

export function Sidebar() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<"projects" | "prompts">("projects");
  const [mode, setMode] = useState<EditorMode>("editor");
  // Bloomberg-Terminal (Sprint 18, Agent 2): Modi-Sektion ist kollabierbar.
  // Standard: aufgeklappt — bestehende Navigation bleibt unverändert.
  const [modesCollapsed, setModesCollapsed] = useState(false);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const projects = useProjectStore((s) => s.projects);
  const chapters = useProjectStore((s) => s.chapters);
  const refresh = useProjectStore((s) => s.refresh);
  const newProject = useProjectStore((s) => s.newProject);
  const newChapter = useProjectStore((s) => s.newChapter);
  const openProject = useProjectStore((s) => s.openProject);
  const openChapter = useProjectStore((s) => s.openChapter);
  const prompt = usePromptStore();

  // Stabilisierte Handler: Nur so kann memoized ProjectRow auf Rerenders
  // der Sidebar verzichten, wenn sich Projekt-/Kapitelliste nicht geändert hat.
  // tRef-Trick (Sprint 13): useI18n() ohne Provider liefert pro Render eine
  // neue t-Identität — Deps auf `t` würden rowActions bei jedem Render
  // invalidieren und das Row-Memo aushebeln. `lang` als Dep genügt, weil sich
  // Labels nur beim Sprachwechsel ändern; die aktuelle t-Funktion wird per Ref
  // zum Event-Zeitpunkt gelesen.
  const tRef = useRef(t);
  tRef.current = t;

  const handleRenameProject = useCallback((id: string, name: string) => {
    const n = renamePrompt(tRef.current("sidebar.promptNewName"), name);
    if (n) { renameProject(id, n); refresh(); }
  }, [refresh, lang]);

  const handleDeleteProject = useCallback((id: string) => {
    if (confirm(tRef.current("sidebar.confirmDeleteProject"))) { deleteProject(id); refresh(); }
  }, [refresh, lang]);

  const handleRenameChapter = useCallback((pid: string, id: string, title: string) => {
    const n = renamePrompt(tRef.current("sidebar.promptNewName"), title);
    if (n) { renameChapter(id, n); openProject(pid); }
  }, [openProject, lang]);

  const handleDeleteChapter = useCallback((pid: string, id: string) => {
    if (confirm(tRef.current("sidebar.confirmDeleteChapter"))) { deleteChapter(id); openProject(pid); }
  }, [openProject, lang]);

  const rowActions = useMemo<RowActions>(() => ({
    onOpenProject: openProject,
    onOpenChapter: openChapter,
    onRenameProject: handleRenameProject,
    onDeleteProject: handleDeleteProject,
    onRenameChapter: handleRenameChapter,
    onDeleteChapter: handleDeleteChapter,
  }), [openProject, openChapter, handleRenameProject, handleDeleteProject, handleRenameChapter, handleDeleteChapter]);

  useEffect(() => {
    refresh();
  }, []);

  // Sprint 6 (Agent 5): Recovery-Dialog/Dashboard bitten per Fenster-Event um
  // den Wechsel in den BookWriter-Modus (nach dem Öffnen des Projekts).
  useEffect(() => {
    const onOpenMode = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (typeof target === "string" && target) setMode(target as EditorMode);
    };
    window.addEventListener("bookwriter:open-mode", onOpenMode);
    return () => window.removeEventListener("bookwriter:open-mode", onOpenMode);
  }, []);

  // Avantgarde-Modus aktiv? Der Switcher wird weiter unten definiert und hier
  // wiederverwendet — deshalb erst nach dessen Deklaration prüfen.
  const inSpecialMode = mode !== "editor" && mode !== "prompts";

  // Modus-Switcher — MUSS in jedem Zweig erscheinen, sonst sind die
  // Spezialbereiche (Projektwissen, Fragmente, Stimmen …) unerreichbar.
  // Genau dieser Fehler hat alle acht Modi unbenutzbar gemacht.
  const switcher = (
    <section className="sb-modes">
      <button
        className="sb-section-toggle"
        aria-expanded={!modesCollapsed}
        onClick={() => setModesCollapsed((v) => !v)}
      >
        <span aria-hidden="true">{modesCollapsed ? "▸" : "▾"}</span> MODES
      </button>
      {!modesCollapsed && (
        <nav className="mode-switcher" aria-label={t("sidebar.modesLabel")}>
          {MODES.map((m) => {
            const label = t(m.key as any);
            return (
              <button
                key={m.id}
                title={label}
                aria-label={`${label} – ${m.description}`}
                aria-pressed={mode === m.id}
                data-mode={m.id}
                className={mode === m.id ? "active" : ""}
                onClick={() => {
                  setMode(m.id);
                  // Editor und Prompts sind gleichzeitig Tabs — synchron halten.
                  if (m.id === "editor") setTab("projects");
                  if (m.id === "prompts") setTab("prompts");
                }}
              >
                <span aria-hidden="true">{m.icon}</span>
                <span className="sb-label">{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </section>
  );

  if (inSpecialMode) {
    // Zwei verkürzte Prädikate statt einer Riesen-Bedingung im JSX: Gleiche
    // Logik, aber die textlastigen Kern-Modi bleiben strukturell nahe an der
    // "wide"-Klasse (so prueft es navigation.test.ts).
    const wideCore = mode === "knowledge" || mode === "diagnostics" || mode === "preflight" || mode === "snapshots" || mode === "kdp";
    const wideExtra = WIDE_EXTRA_MODES.has(mode);
    return (
      <aside id="app-sidebar" tabIndex={-1} aria-label={t("sidebar.listLabel")} className={`sidebar${wideCore || wideExtra ? " wide" : ""}`}>
        {switcher}
        <div className="sidebar-content">
          <ModePanel mode={mode} projectId={activeProjectId} chapterId={activeChapterId} />
        </div>
      </aside>
    );
  }

  if (tab === "prompts") {
    return (
      <aside id="app-sidebar" tabIndex={-1} aria-label={t("sidebar.listLabel")} className="sidebar">
        {switcher}
        <nav className="sidebar-tabs">
          <button onClick={() => { setTab("projects"); setMode("editor"); }}>{t("sidebar.projectsTab")}</button>
          <button className="active" aria-current="page" onClick={() => prompt.set("tab", "generate")}>{t("sidebar.promptsTab")}</button>
        </nav>
        <div className="sidebar-content"><Suspense fallback={<div className="mode-placeholder">{t("sidebar.loading")}</div>}><PromptGenerator /></Suspense></div>
      </aside>
    );
  }

  return (
    <aside id="app-sidebar" tabIndex={-1} aria-label={t("sidebar.listLabel")} className="sidebar">
      {switcher}
      <nav className="sidebar-tabs">
        <button className="active" aria-current="page" onClick={() => setTab("projects")}>{t("sidebar.projectsTab")}</button>
        <button onClick={() => { setTab("prompts"); setMode("prompts"); }}>{t("sidebar.promptsTab")}</button>
      </nav>
      <div className="sidebar-content">
        <div className="project-toolbar">
          <button onClick={() => { const n = promptName(t("sidebar.promptProjectName")); if (n) newProject(n); }}>{t("sidebar.newProject")}</button>
          {activeProjectId && (
            <button onClick={() => { const t2 = promptChapter(t("sidebar.promptChapterTitle")); if (t2) newChapter(t2); }}>{t("sidebar.newChapter")}</button>
          )}
        </div>
        <ul className="project-tree">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              active={activeProjectId === p.id}
              activeChapterId={activeChapterId}
              chapters={activeProjectId === p.id ? chapters : EMPTY_CHAPTERS}
              actions={rowActions}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}

// Rendert das Panel für den aktiven Avantgarde-Modus.
// ---------------------------------------------------------------------------
// Memoized Listenzeilen: Ein Tastendruck im Editor rerendert die Sidebar, aber
// nicht jede Projekt-/Kapitelzeile neu, solange sich die Props nicht ändern.
// ---------------------------------------------------------------------------

const EMPTY_CHAPTERS: Chapter[] = [];

export type RowActions = {
  onOpenProject: (id: string) => void;
  onOpenChapter: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameChapter: (projectId: string, id: string, title: string) => void;
  onDeleteChapter: (projectId: string, id: string) => void;
};

export const ChapterRow = memo(function ChapterRow({
  chapter, projectId, active, actions,
}: {
  chapter: Chapter;
  projectId: string;
  active: boolean;
  actions: RowActions;
}) {
  const { t } = useI18n();
  return (
    <li className={active ? "active" : ""}>
      <div
        className="node"
        role="button"
        tabIndex={0}
        aria-label={t("sidebar.openChapter", { title: chapter.title })}
        onClick={() => actions.onOpenChapter(chapter.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); actions.onOpenChapter(chapter.id); }
        }}
      >
        📄 {chapter.title}
        <span className="node-actions">
          <button aria-label={t("sidebar.renameChapter", { title: chapter.title })} onClick={(e) => { e.stopPropagation(); actions.onRenameChapter(projectId, chapter.id, chapter.title); }}>✎</button>
          <button aria-label={t("sidebar.deleteChapter", { title: chapter.title })} onClick={(e) => { e.stopPropagation(); actions.onDeleteChapter(projectId, chapter.id); }}>🗑</button>
        </span>
      </div>
    </li>
  );
});

export const ProjectRow = memo(function ProjectRow({
  project, active, activeChapterId, chapters, actions,
}: {
  project: Project;
  active: boolean;
  activeChapterId: string | null;
  chapters: Chapter[];
  actions: RowActions;
}) {
  const { t } = useI18n();
  return (
    <li className={active ? "active" : ""}>
      <div
        className="node"
        role="button"
        tabIndex={0}
        aria-label={t("sidebar.openProject", { name: project.name })}
        onClick={() => actions.onOpenProject(project.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); actions.onOpenProject(project.id); }
        }}
      >
        📁 {project.name}
        <span className="node-actions">
          <button aria-label={t("sidebar.renameProject", { name: project.name })} onClick={(e) => { e.stopPropagation(); actions.onRenameProject(project.id, project.name); }}>✎</button>
          <button aria-label={t("sidebar.deleteProject", { name: project.name })} onClick={(e) => { e.stopPropagation(); actions.onDeleteProject(project.id); }}>🗑</button>
        </span>
      </div>
      {active && (
        <ul className="chapter-tree">
          {chapters.map((c) => (
            <ChapterRow
              key={c.id}
              chapter={c}
              projectId={project.id}
              active={activeChapterId === c.id}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

function ModePanel({ mode, projectId, chapterId }: { mode: EditorMode; projectId: string | null; chapterId: string | null }) {
  const { t } = useI18n();
  const chapter = useProjectStore((s) => 
    s.chapters.find((c) => c.id === s.activeChapterId) as TranslationChapter | undefined
  );
  const panel = (() => {
    if (mode === "knowledge") return <KnowledgePanel projectId={projectId} />;
    if (mode === "research") return <ResearchPanel projectId={projectId} />;
    if (mode === "diagnostics") return <DiagnosticsPanel projectId={projectId} chapterId={chapterId} />;
    if (mode === "preflight") return <PreflightPanel projectId={projectId} chapterId={chapterId} />;
    if (mode === "snapshots") return <SnapshotPanel projectId={projectId} />;
    if (mode === "kdp") return <KdpChecklistPanel projectId={projectId} />;
    if (mode === "publishing") return <PublishingAssistantPanel projectId={projectId} />;
    // Sprint 6 (Agent 5): BookWriter-Dashboard braucht kein offenes Kapitel —
    // es arbeitet projektübergreifend auf dem Job-Store.
    if (mode === "bookwriter") return <BookWriterDashboardPanel />;
    // Sprint 19f: Amazon-Panel braucht kein offenes Kapitel (projektübergreifend).
    if (mode === "amazon") return <AmazonPanel />;
    // Sprint 20 (Agent 2): Kurzprosa-Generator braucht kein offenes Kapitel.
    if (mode === "shortprose") return <ShortprosePanel projectId={projectId ?? undefined} chapterId={chapterId ?? undefined} />;
    // Sprint 20 (Agent 2): Voice-Lab braucht kein offenes Kapitel (Aufnahme + Transkription standalone).
    if (mode === "voice") return <VoiceLabPanel />;
    // Sprint 20 (Agent 3): Collab-Panel braucht kein offenes Kapitel (projektbezogen).
    if (mode === "collab") return <CollabPanel projectId={projectId ?? undefined} />;
    // Sprint 20 (Agent 5): Template-Panel braucht kein offenes Kapitel (projektübergreifend).
    if (mode === "templates") return <TemplatePanel />;
    // Sprint 22 (Agent 5): Outliner braucht kein offenes Kapitel (eigene Gliederung).
    if (mode === "outliner") return <OutlinerPanel />;
    // Sprint 22 (Agent 1): Importer arbeitet dateibasiert (projektübergreifend).
    if (mode === "importer") return <ImporterPanel />;
    // Sprint 22 (Agent 6): Stil-Analyse arbeitet auf freiem Text (standalone).
    if (mode === "style-analyzer") return <StyleAnalyzerPanel />;
    // Sprint 22 (Agent 3): Web-Recherche braucht kein offenes Kapitel (projektuebergreifend).
    if (mode === "websearch") return <WebsearchPanel />;
    // Sprint 23 (Agent 3): Szenen-Analyse arbeitet auf freiem Text (standalone).
    if (mode === "scene-breakdown") return <SceneBreakdownPanel />;
    // Sprint 23 (Agent 2): KI-Review arbeitet auf freiem Text (standalone).
    if (mode === "feedback") return <FeedbackPanel />;
    // Sprint 24 (Agent 4): Prompt-Bibliothek arbeitet auf eigener Sammlung (standalone).
    if (mode === "prompt-library") return <PromptLibraryPanel />;
    // Sprint 24 (Agent 5): Formatierung arbeitet auf freiem Text (standalone).
    if (mode === "formatting") return <FormattingPanel />;
    // Sprint 24 (Agent 6): Backup arbeitet projektuebergreifend (standalone).
    if (mode === "backup") return <BackupPanel />;
    // Sprint 24 (Agent 3): Sitzungs-Manager arbeitet projektuebergreifend (standalone).
    if (mode === "sessions") return <SessionPanel />;
    // Sprint 24 (Agent 1): Cloud-Sync arbeitet projektuebergreifend (standalone).
    // Sprint 24 (Agent 2): Volltextsuche arbeitet projektuebergreifend (standalone).
    if (mode === "search") return <SearchPanel />;
    // Sprint 25 (Agent 4): Lesbarkeit arbeitet auf freiem Text (standalone).
    if (mode === "readability") return <ReadabilityPanel />;
    if (!projectId || !chapterId) {
      return <div className="mode-placeholder">{t("sidebar.noChapterHint")}</div>;
    }
    switch (mode) {
      case "fragments": return <FragmentPanel chapterId={chapterId} />;
      case "voices": return <VoiceLab text="(Text aus Editor wählen)" />;
      case "map": return <SemanticMap projectId={projectId} />;
      case "dialogue": return <DialoguePanel chapterId={chapterId} text="(Text aus Editor wählen)" />;
      case "versions": return <VersionsPanel chapterId={chapterId} content="(Inhalt)" />;
      case "obstruction": return <ObstructionPanel text="(Text aus Editor wählen)" />;
      case "dream": return <DreamLogicPanel text="(Text aus Editor wählen)" />;
      case "imagegen": return <ImageGenerationPanel />;
      case "covergen": return <CoverGenPanel />;
      case "blurbgen": return <BlurbGenPanel />;
      case "scientificwriting": return <ScientificWritingPanel />;
      case "timeline": return <TimelinePanel projectId={projectId} />;
      case "characters": return <CharactersPanel projectId={projectId} />;
      case "worldbuilding": return <WorldbuildingPanel projectId={projectId} />;
      case "investigate": return <InvestigatePanel />;
      case "watermark": return <WatermarkPanel />;
      case "tts": return <TTSPanel />;
      case "markdown": return <MarkdownViewerPanel />;
      case "wordstats": return <WordStatsPanel />;
      case "ideas": return <IdeasPanel />;
      case "consistency": return <ConsistencyPanel />;
      case "newspaper": return <NewsGeneratorPanel />;
      case "textquality": return <TextQualityPanel projectId={projectId} chapterId={chapterId} />;
      case "bilingual": return chapter ? <BilingualPanel chapter={chapter} /> : <div className="mode-placeholder">Bitte ein Kapitel auswählen</div>;
      default: return null;
    }
  })();

  return <Suspense fallback={<div className="mode-placeholder">{t("sidebar.loading")}</div>}>{panel}</Suspense>;
}

function promptName(label: string): string | null {
  const v = window.prompt(label);
  return v && v.trim() ? v.trim() : null;
}
function promptChapter(label: string): string | null {
  const v = window.prompt(label);
  return v && v.trim() ? v.trim() : null;
}
function renamePrompt(label: string, current: string): string | null {
  const v = window.prompt(label, current);
  return v && v.trim() ? v.trim() : null;
}
