// Projektwissen-Tab: Quellen, Suche, Frage an das Projekt.
//
// Hält den gesamten Zustand dieses Bereichs. Die drei Unterpanels sind rein
// darstellend — Logik gehört nicht in Views.
//
// Alle langlaufenden Vorgänge melden Fortschritt und blockieren die App nicht:
// Indexierung läuft asynchron, der Rest der Oberfläche bleibt bedienbar.

import { useState, useEffect, useCallback } from "react";
import { SourcePanel } from "./SourcePanel";
import { SearchPanel } from "./SearchPanel";
import { AskPanel } from "./AskPanel";
import { listSources, sourceStats, type SourceStats } from "@/services/knowledge/sources";
import { syncProjectSources } from "@/services/knowledge/sync";
import { indexProject, indexSingleSource } from "@/services/knowledge/indexer";
import { searchKnowledge, formatContextBlock } from "@/services/knowledge/retrieval";
import {
  askProject,
  previewContext,
  buildQuestion,
  type AskResult,
  type ProjectQuestionKind,
} from "@/services/knowledge/ask";
import { loadSettings } from "@/services/settings";
import type { KnowledgeSource, RetrievalResult, SearchMode } from "@/types/knowledge";
import "./knowledge.css";

interface Props {
  projectId: string | null;
}

const EMPTY_STATS: SourceStats = {
  total: 0,
  indexed: 0,
  stale: 0,
  failed: 0,
  pending: 0,
  chunkCount: 0,
};

type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

export function KnowledgePanel({ projectId }: Props) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [stats, setStats] = useState<SourceStats>(EMPTY_STATS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [searchResult, setSearchResult] = useState<RetrievalResult | null>(null);

  const [question, setQuestion] = useState("");
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  /** Liest Quellen und Statistik neu aus der DB. */
  const reload = useCallback(() => {
    if (!projectId) {
      setSources([]);
      setStats(EMPTY_STATS);
      return;
    }
    try {
      setSources(listSources(projectId));
      setStats(sourceStats(projectId));
    } catch {
      // DB noch nicht bereit — der nächste Aufruf greift.
    }
  }, [projectId]);

  useEffect(() => {
    reload();
    // Bei Projektwechsel alle Ergebnisse verwerfen: Sie gehören zum alten Projekt.
    setSearchResult(null);
    setAskResult(null);
    setPreview(null);
    setNotice(null);
  }, [projectId, reload]);

  // --- Quellen einlesen ----------------------------------------------------
  async function handleSync() {
    if (!projectId) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await syncProjectSources(projectId);
      reload();
      const parts: string[] = [];
      if (r.created) parts.push(`${r.created} neu`);
      if (r.updated) parts.push(`${r.updated} geändert`);
      if (r.removed) parts.push(`${r.removed} entfernt`);
      const stale = r.staleCount > 0
        ? ` ${r.staleCount} ${r.staleCount === 1 ? "Quelle" : "Quellen"} müssen neu indexiert werden.`
        : "";
      setNotice({
        text: parts.length
          ? `Quellen eingelesen: ${parts.join(", ")}.${stale}`
          : "Keine Quellen gefunden. Lege zuerst Kapitel, Notizen oder Profile an.",
        kind: parts.length ? "ok" : "warn",
      });
    } catch (e) {
      setNotice({
        text: `Die Quellen konnten nicht eingelesen werden: ${(e as Error)?.message ?? String(e)}`,
        kind: "err",
      });
    } finally {
      setBusy(false);
    }
  }

  // --- Indexieren ----------------------------------------------------------
  async function handleIndexAll(force: boolean) {
    if (!projectId) return;
    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: 1, label: "Indexierung wird vorbereitet…" });
    try {
      const settings = loadSettings();
      const r = await indexProject(projectId, settings, {
        force,
        onProgress: (done, total, label) =>
          setProgress({ done, total, label: label ?? "Wird indexiert…" }),
      });
      reload();
      if (r.sourcesProcessed === 0) {
        setNotice({
          text: force
            ? "Es gibt keine Quellen zum Indexieren."
            : "Alles ist aktuell. Mit „Vollständig neu“ lässt sich der Index erzwingen.",
          kind: "warn",
        });
      } else {
        setNotice({
          text:
            `${r.sourcesProcessed} ${r.sourcesProcessed === 1 ? "Quelle" : "Quellen"} indexiert, ` +
            `${r.chunksCreated} Abschnitte erzeugt.` +
            (r.degraded && r.notice ? ` ${r.notice}` : ""),
          kind: r.degraded ? "warn" : "ok",
        });
      }
    } catch (e) {
      setNotice({
        text: `Die Indexierung ist fehlgeschlagen: ${(e as Error)?.message ?? String(e)}`,
        kind: "err",
      });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  async function handleIndexOne(sourceId: string) {
    if (!projectId) return;
    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: 1, label: "Quelle wird indexiert…" });
    try {
      const settings = loadSettings();
      const r = await indexSingleSource(projectId, sourceId, settings, (done, total, label) =>
        setProgress({ done, total, label: label ?? "Wird indexiert…" }),
      );
      reload();
      setNotice({
        text: `${r.chunksCreated} Abschnitte erzeugt.` + (r.degraded && r.notice ? ` ${r.notice}` : ""),
        kind: r.degraded ? "warn" : "ok",
      });
    } catch (e) {
      setNotice({
        text: `Die Quelle konnte nicht indexiert werden: ${(e as Error)?.message ?? String(e)}`,
        kind: "err",
      });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  // --- Suche ---------------------------------------------------------------
  async function handleSearch() {
    if (!projectId || !query.trim()) return;
    setBusy(true);
    try {
      const settings = loadSettings();
      setSearchResult(await searchKnowledge(projectId, query.trim(), settings, { mode }));
    } catch (e) {
      setNotice({
        text: `Die Suche ist fehlgeschlagen: ${(e as Error)?.message ?? String(e)}`,
        kind: "err",
      });
    } finally {
      setBusy(false);
    }
  }

  // --- Frage an das Projekt ------------------------------------------------
  async function runAsk(q: string) {
    if (!projectId || !q.trim()) return;
    setBusy(true);
    setPreview(null);
    try {
      const settings = loadSettings();
      setAskResult(await askProject(projectId, q.trim(), settings, { mode }));
    } catch (e) {
      setNotice({
        text: `Die Frage konnte nicht beantwortet werden: ${(e as Error)?.message ?? String(e)}`,
        kind: "err",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickAsk(kind: ProjectQuestionKind, subject: string) {
    const { question: q } = buildQuestion(kind, subject);
    setQuestion(q);
    await runAsk(q);
  }

  async function handlePreview() {
    if (!projectId || !question.trim()) return;
    setBusy(true);
    try {
      const settings = loadSettings();
      const r = await previewContext(projectId, question.trim(), settings, { mode });
      // previewContext liefert das Retrieval-Ergebnis; für die Anzeige wird
      // derselbe Kontextblock formatiert, der auch an das Modell ginge.
      const block = formatContextBlock(r);
      setPreview(
        block.trim()
          ? (r.degraded && r.notice ? `[${r.notice}]

` : "") + block
          : "Zu dieser Frage findet sich im Projektwissen nichts. Es würde kein Kontext mitgesendet.",
      );
    } catch (e) {
      setPreview(`Der Kontext konnte nicht ermittelt werden: ${(e as Error)?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // --- Darstellung ---------------------------------------------------------
  if (!projectId) {
    return (
      <div className="kw">
        <div className="kw-scroll">
          <div className="kw-notice">
            Wähle links ein Projekt. Das Projektwissen wird je Projekt getrennt
            aufgebaut.
          </div>
        </div>
      </div>
    );
  }

  const hasIndex = stats.chunkCount > 0;

  return (
    <div className="kw">
      <div className="kw-scroll">
        <SourcePanel
          sources={sources}
          stats={stats}
          busy={busy}
          progress={progress}
          notice={notice}
          onSync={() => void handleSync()}
          onIndexAll={(force) => void handleIndexAll(force)}
          onIndexOne={(id) => void handleIndexOne(id)}
        />

        <SearchPanel
          query={query}
          onQueryChange={setQuery}
          mode={mode}
          onModeChange={setMode}
          result={searchResult}
          busy={busy}
          onSearch={() => void handleSearch()}
          hasIndex={hasIndex}
        />

        <AskPanel
          question={question}
          onQuestionChange={setQuestion}
          result={askResult}
          preview={preview}
          busy={busy}
          hasIndex={hasIndex}
          onAsk={() => void runAsk(question)}
          onPreview={() => void handlePreview()}
          onQuickAsk={(k, s) => void handleQuickAsk(k, s)}
        />
      </div>
    </div>
  );
}
