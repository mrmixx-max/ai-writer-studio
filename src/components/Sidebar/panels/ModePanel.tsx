import { Suspense } from "react";
import { useI18n } from "@/i18n";
import type { ModePanelProps } from "../types";
import { isStandaloneMode, requiresChapter } from "../modeRegistry";

/**
 * ModePanel — rendert das Panel für den aktiven Avantgarde-Modus.
 * Zentrale Dispatch-Logik für alle 65+ Modi.
 * Extrahiert aus Sidebar.tsx (ModePanel Funktion).
 */
export function ModePanel({ mode, projectId, chapterId }: ModePanelProps) {
  const { t } = useI18n();

  // Lazy imports für alle Modus-Panels (Code-Splitting)
  const KnowledgePanel = React.lazy(() => import("@/components/Knowledge/KnowledgePanel").then((m) => ({ default: m.KnowledgePanel })));
  const ResearchPanel = React.lazy(() => import("@/components/Research/ResearchPanel").then((m) => ({ default: m.ResearchPanel })));
  const DiagnosticsPanel = React.lazy(() => import("@/components/Diagnostics/DiagnosticsPanel").then((m) => ({ default: m.DiagnosticsPanel })));
  const PreflightPanel = React.lazy(() => import("@/components/Preflight/PreflightPanel").then((m) => ({ default: m.PreflightPanel })));
  const KdpChecklistPanel = React.lazy(() => import("@/components/KDP/KdpChecklistPanel").then((m) => ({ default: m.KdpChecklistPanel })));
  const PublishingAssistantPanel = React.lazy(() => import("@/components/Publishing/PublishingAssistantPanel").then((m) => ({ default: m.PublishingAssistantPanel })));
  const SemanticMap = React.lazy(() => import("@/components/SemanticMap/SemanticMap").then((m) => ({ default: m.SemanticMap })));
  const VersionsPanel = React.lazy(() => import("@/components/Versions/VersionsPanel").then((m) => ({ default: m.VersionsPanel })));
  const ObstructionPanel = React.lazy(() => import("@/components/Obstruction/ObstructionPanel").then((m) => ({ default: m.ObstructionPanel })));
  const CoverGenPanel = React.lazy(() => import("@/components/CoverGen/CoverGenPanel").then((m) => ({ default: m.CoverGenPanel })));
  const BlurbGenPanel = React.lazy(() => import("@/components/BlurbGen/BlurbGenPanel").then((m) => ({ default: m.BlurbGenPanel })));
  const ScientificWritingPanel = React.lazy(() => import("@/components/ScientificWriting/ScientificWritingPanel").then((m) => ({ default: m.ScientificWritingPanel })));
  const TimelinePanel = React.lazy(() => import("@/components/Timeline/TimelinePanel").then((m) => ({ default: m.TimelinePanel })));
  const CharactersPanel = React.lazy(() => import("@/components/Characters/CharactersPanel").then((m) => ({ default: m.CharactersPanel })));
  const WorldbuildingPanel = React.lazy(() => import("@/components/Worldbuilding/WorldbuildingPanel").then((m) => ({ default: m.WorldbuildingPanel })));
  const WordStatsPanel = React.lazy(() => import("@/components/WordStats/WordStatsPanel").then((m) => ({ default: m.WordStatsPanel })));

  // Standalone Panels
  const AmazonPanel = React.lazy(() => import("@/components/Amazon/AmazonPanel").then((m) => ({ default: m.AmazonPanel })));
  const VoiceLabPanel = React.lazy(() => import("@/components/VoiceLab/VoiceLabPanel").then((m) => ({ default: m.VoiceLabPanel })));
  const CollabPanel = React.lazy(() => import("@/components/Collab/CollabPanel").then((m) => ({ default: m.CollabPanel })));
  const TemplatePanel = React.lazy(() => import("@/components/Templates/TemplatePanel").then((m) => ({ default: m.TemplatePanel })));
  const OutlinerPanel = React.lazy(() => import("@/components/Outliner/OutlinerPanel").then((m) => ({ default: m.OutlinerPanel })));
  const ImporterPanel = React.lazy(() => import("@/components/Importer/ImporterPanel").then((m) => ({ default: m.ImporterPanel })));
  const StyleAnalyzerPanel = React.lazy(() => import("@/components/StyleAnalyzer/StyleAnalyzerPanel").then((m) => ({ default: m.StyleAnalyzerPanel })));
  const WebsearchPanel = React.lazy(() => import("@/components/Websearch/WebsearchPanel").then((m) => ({ default: m.WebsearchPanel })));
  const FeedbackPanel = React.lazy(() => import("@/components/Feedback/FeedbackPanel").then((m) => ({ default: m.FeedbackPanel })));
  const PromptLibraryPanel = React.lazy(() => import("@/components/PromptLibrary/PromptLibraryPanel").then((m) => ({ default: m.PromptLibraryPanel })));
  const SearchPanel = React.lazy(() => import("@/components/Search/SearchPanel").then((m) => ({ default: m.SearchPanel })));
  const CloudSyncPanel = React.lazy(() => import("@/components/CloudSync/CloudSyncPanel").then((m) => ({ default: m.CloudSyncPanel })));
  const SessionPanel = React.lazy(() => import("@/components/Session/SessionPanel").then((m) => ({ default: m.SessionPanel })));
  const FormattingPanel = React.lazy(() => import("@/components/Formatting/FormattingPanel").then((m) => ({ default: m.FormattingPanel })));
  const BackupPanel = React.lazy(() => import("@/components/Backup/BackupPanel").then((m) => ({ default: m.BackupPanel })));
  const ReadabilityPanel = React.lazy(() => import("@/components/Readability/ReadabilityPanel").then((m) => ({ default: m.ReadabilityPanel })));
  const TranslatorPanel = React.lazy(() => import("@/components/Translator/TranslatorPanel").then((m) => ({ default: m.TranslatorPanel })));
  const MindmapPanel = React.lazy(() => import("@/components/Mindmap/MindmapPanel").then((m) => ({ default: m.MindmapPanel })));
  const SummarizerPanel = React.lazy(() => import("@/components/Summarizer/SummarizerPanel").then((m) => ({ default: m.SummarizerPanel })));
  const PlotAnalyzerPanel = React.lazy(() => import("@/components/PlotAnalyzer/PlotAnalyzerPanel").then((m) => ({ default: m.PlotAnalyzerPanel })));
  const ConsistencyPanel = React.lazy(() => import("@/components/Consistency/ConsistencyPanel").then((m) => ({ default: m.ConsistencyPanel })));
  const RepetitionPanel = React.lazy(() => import("@/components/Repetition/RepetitionPanel").then((m) => ({ default: m.RepetitionPanel })));
  const RewritePanel = React.lazy(() => import("@/components/Rewrite/RewritePanel").then((m) => ({ default: m.RewritePanel })));
  const ExpandPanel = React.lazy(() => import("@/components/Expand/ExpandPanel").then((m) => ({ default: m.ExpandPanel })));
  const CondensePanel = React.lazy(() => import("@/components/Condense/CondensePanel").then((m) => ({ default: m.CondensePanel })));
  const HookPanel = React.lazy(() => import("@/components/Hook/HookPanel").then((m) => ({ default: m.HookPanel })));
  const TensionCurvePanel = React.lazy(() => import("@/components/Tension/TensionCurvePanel").then((m) => ({ default: m.TensionCurvePanel })));
  const SceneBreakdownPanel = React.lazy(() => import("@/components/SceneBreakdown/SceneBreakdownPanel").then((m) => ({ default: m.SceneBreakdownPanel })));
  const GenrePanel = React.lazy(() => import("@/components/Genre/GenrePanel").then((m) => ({ default: m.GenrePanel })));
  const BookIdeaPanel = React.lazy(() => import("@/components/BookIdea/BookIdeaPanel").then((m) => ({ default: m.BookIdeaPanel })));
  const ChatPanel = React.lazy(() => import("@/components/Chat/ChatPanel").then((m) => ({ default: m.ChatPanel })));
  const NewsGeneratorPanel = React.lazy(() => import("@/components/News/NewsGeneratorPanel").then((m) => ({ default: m.NewsGeneratorPanel })));

  // Kapitel für Modes die es brauchen

  const panel = (() => {
    // Standalone-Modi (brauchen kein Projekt/Kapitel)
    if (isStandaloneMode(mode)) {
      switch (mode) {
        case "publishing": return <PublishingAssistantPanel projectId={projectId} />;
        case "amazon": return <AmazonPanel />;
        case "voice": return <VoiceLabPanel />;
        case "templates": return <TemplatePanel />;
        case "collab": return <CollabPanel projectId={projectId ?? undefined} />;
        case "outliner": return <OutlinerPanel />;
        case "style-analyzer": return <StyleAnalyzerPanel />;
        case "importer": return <ImporterPanel />;
        case "websearch": return <WebsearchPanel />;
        case "feedback": return <FeedbackPanel />;
        case "prompt-library": return <PromptLibraryPanel />;
        case "search": return <SearchPanel />;
        case "cloud-sync": return <CloudSyncPanel />;
        case "sessions": return <SessionPanel />;
        case "formatting": return <FormattingPanel />;
        case "backup": return <BackupPanel />;
        case "readability": return <ReadabilityPanel />;
        case "translator": return <TranslatorPanel />;
        case "mindmap": return <MindmapPanel />;
        case "summarizer": return <SummarizerPanel />;
        case "plot-analyzer": return <PlotAnalyzerPanel />;
        case "consistency": return <ConsistencyPanel />;
        case "repetition": return <RepetitionPanel />;
        case "rewrite": return <RewritePanel />;
        case "expand": return <ExpandPanel />;
        case "condense": return <CondensePanel />;
        case "hook": return <HookPanel />;
        case "tension": return <TensionCurvePanel />;
        case "scene-breakdown": return <SceneBreakdownPanel />;
        case "genre": return <GenrePanel />;
        case "book-idea": return <BookIdeaPanel />;
        case "chat": return <ChatPanel />;
        case "newspaper": return <NewsGeneratorPanel />;
      }
    }

    // Modi die Projekt brauchen
    if (!projectId) {
      return <div className="mode-placeholder">{t("sidebar.noProjectHint" as any) || "Kein Projekt ausgewählt"}</div>;
    }

    // Modi die Kapitel brauchen
    if (requiresChapter(mode) && !chapterId) {
      return <div className="mode-placeholder">{t("sidebar.noChapterHint")}</div>;
    }

    // Projekt-bezogene Modi
    switch (mode) {
      case "knowledge": return <KnowledgePanel projectId={projectId} />;
      case "research": return <ResearchPanel projectId={projectId} />;
      case "diagnostics": return <DiagnosticsPanel projectId={projectId} chapterId={chapterId} />;
      case "preflight": return <PreflightPanel projectId={projectId} chapterId={chapterId} />;
      case "kdp": return <KdpChecklistPanel projectId={projectId} />;
      case "map": return <SemanticMap projectId={projectId} />;
      case "versions": return <VersionsPanel chapterId={chapterId!} content="(Inhalt)" />;
      case "obstruction": return <ObstructionPanel text="(Text aus Editor wählen)" />;
      case "covergen": return <CoverGenPanel />;
      case "blurbgen": return <BlurbGenPanel />;
      case "scientificwriting": return <ScientificWritingPanel />;
      case "timeline": return <TimelinePanel projectId={projectId} />;
      case "characters": return <CharactersPanel projectId={projectId} />;
      case "worldbuilding": return <WorldbuildingPanel projectId={projectId} />;
      case "wordstats": return <WordStatsPanel />;
      default: return null;
    }
  })();

  return <Suspense fallback={<div className="mode-placeholder">{t("sidebar.loading")}</div>}>{panel}</Suspense>;
}

// React muss importiert sein für lazy
import React from "react";