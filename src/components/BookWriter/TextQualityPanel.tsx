// TextQualityPanel: Container für den Sidebar-Modus "textquality".
// Kombiniert Qualitäts-Dashboard (Sprint 17) + Lektorat (Sprint 11) für das
// aktive Kapitel — beide Panels sind präsentational, die Daten kommen hier
// aus dem Project-Store + analyzeTextQuality (rein lokal, kein LLM nötig).
import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import { analyzeTextQuality } from "@/services/bookwriter/quality";
import {
  QualityDashboard,
  type QualityMetric,
  type QualitySuggestion,
  type ChapterQualityPoint,
} from "./QualityDashboard";
import { LektoratPanel } from "./LektoratPanel";

const METRIC_LABELS: { key: string; label: string }[] = [
  { key: "readability", label: "Lesbarkeit" },
  { key: "sentenceVariety", label: "Satzbau" },
  { key: "dialogueRatio", label: "Dialoganteil" },
  { key: "adverbDensity", label: "Adverbien" },
  { key: "cliches", label: "Floskeln" },
  { key: "tenseConsistency", label: "Tempus" },
  { key: "povConsistency", label: "Perspektive" },
  { key: "pacing", label: "Tempo" },
];

export interface TextQualityPanelProps {
  projectId: string | null;
  chapterId: string | null;
}

export function TextQualityPanel({ projectId, chapterId }: TextQualityPanelProps) {
  const chapters = useProjectStore((s) => s.chapters);
  void projectId;

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === chapterId) ?? null,
    [chapters, chapterId],
  );
  const text = activeChapter?.content ?? "";

  const report = useMemo(
    () => (text.trim() ? analyzeTextQuality(text) : null),
    [text],
  );

  const metrics: QualityMetric[] = useMemo(() => {
    if (!report) return [];
    return METRIC_LABELS.map(({ key, label }) => ({
      id: key,
      label,
      score: (report as unknown as Record<string, { score: number }>)[key]?.score ?? 0,
    }));
  }, [report]);

  const suggestions: QualitySuggestion[] = useMemo(() => {
    if (!report || !activeChapter) return [];
    const out: QualitySuggestion[] = [];
    for (const { key } of METRIC_LABELS) {
      const metric = (report as unknown as Record<string, { suggestions: string[] }>)[key];
      for (const [i, s] of (metric?.suggestions ?? []).entries()) {
        out.push({ id: `${key}-${i}`, chapterId: activeChapter.id, text: s, metricId: key });
      }
    }
    return out.slice(0, 20);
  }, [report, activeChapter]);

  const chapterPoints: ChapterQualityPoint[] = useMemo(() => {
    if (!report || !activeChapter) return [];
    return [{
      chapterId: activeChapter.id,
      title: activeChapter.title,
      score: report.overallScore,
    }];
  }, [report, activeChapter]);

  if (!activeChapter || !report) {
    return (
      <div className="mode-placeholder" data-testid="textquality-empty">
        Wähle links ein Projekt und Kapitel mit Text, um Lektorat und Qualitätsanalyse zu nutzen.
      </div>
    );
  }

  return (
    <div className="textquality-panel" data-testid="textquality-panel">
      <QualityDashboard metrics={metrics} suggestions={suggestions} chapters={chapterPoints} />
      <LektoratPanel chapters={[{ id: activeChapter.id, content: text }]} />
      <p className="mode-placeholder" data-testid="textquality-rewrite-hint">
        Für gezieltes Umschreiben: Text markieren und im KI-Panel „Umschreiben“ wählen.
      </p>
    </div>
  );
}
