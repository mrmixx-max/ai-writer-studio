// Manuskriptprüfung: Konsistenz, Stil, Wiederholungen, Zeitlinie.
//
// Hält den Zustand dieses Bereichs. Der Prüflauf ist asynchron und blockiert
// die App nicht — der Rest der Oberfläche bleibt bedienbar.

import { useState, useEffect, useCallback } from "react";
import { FindingCard } from "./FindingCard";
import { MetricsPanel } from "./MetricsPanel";
import {
  runDiagnostics,
  listFindings,
  setFindingStatus,
  findingStats,
  type Finding,
  type DiagnosticReport,
} from "@/services/diagnostics/runner";
import { useProjectStore } from "@/store/projectStore";
import "./diagnostics.css";

interface Props {
  projectId: string | null;
  chapterId: string | null;
}

type Tab = "consistency" | "style" | "repetition" | "timeline";

/** Welche Kategorien in welchem Untertab erscheinen. */
const TAB_CATEGORIES: Record<Tab, string[]> = {
  consistency: ["character", "world", "pov"],
  style: ["style"],
  repetition: ["terminology"],
  timeline: ["timeline"],
};

const TAB_LABELS: Record<Tab, string> = {
  consistency: "Konsistenz",
  style: "Stil",
  repetition: "Begriffe",
  timeline: "Zeitlinie",
};

type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

export function DiagnosticsPanel({ projectId, chapterId }: Props) {
  const chapters = useProjectStore((s) => s.chapters);
  const openChapter = useProjectStore((s) => s.openChapter);
  const [tab, setTab] = useState<Tab>("consistency");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // Filter
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyCurrentChapter, setOnlyCurrentChapter] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const reload = useCallback(() => {
    if (!projectId) {
      setFindings([]);
      setStats({ total: 0, high: 0, medium: 0, low: 0 });
      return;
    }
    try {
      const all = listFindings(projectId, { includeResolved: true });
      // Kapiteltitel nachtragen: die DB kennt nur die Id.
      const titles = new Map(chapters.map((c: any) => [c.id, c.title]));
      setFindings(
        all.map((f) => ({
          ...f,
          chapterTitle: f.chapterId ? (titles.get(f.chapterId) ?? null) : null,
        })),
      );
      const s = findingStats(projectId);
      setStats({ total: s.total, high: s.high, medium: s.medium, low: s.low });
    } catch {
      // DB noch nicht bereit.
    }
  }, [projectId, chapters]);

  useEffect(() => {
    reload();
    setReport(null);
    setNotice(null);
  }, [projectId, reload]);

  // --- Prüflauf ------------------------------------------------------------
  async function runCheck(scopeChapter: boolean) {
    if (!projectId) return;
    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: 1, label: "Prüfung wird vorbereitet…" });

    try {
      const r = await runDiagnostics(projectId, {
        chapterId: scopeChapter && chapterId ? chapterId : undefined,
        onProgress: (done, total, label) =>
          setProgress({ done, total, label: label ?? "Wird geprüft…" }),
      });
      setReport(r);
      reload();

      const high = r.findings.filter((f) => f.severity === "high").length;
      setNotice({
        text:
          r.findings.length === 0
            ? "Keine Auffälligkeiten gefunden."
            : `${r.findings.length} ${r.findings.length === 1 ? "Befund" : "Befunde"}` +
              (high > 0 ? `, davon ${high} kritisch` : "") +
              `. ${r.chaptersChecked} ${r.chaptersChecked === 1 ? "Kapitel" : "Kapitel"} geprüft ` +
              `in ${(r.durationMs / 1000).toFixed(1)} s.` +
              (r.notice ? ` ${r.notice}` : ""),
        kind: r.degraded ? "warn" : high > 0 ? "warn" : "ok",
      });
    } catch (e) {
      setNotice({
        text: `Die Prüfung ist fehlgeschlagen: ${(e as Error)?.message ?? String(e)}`,
        kind: "err",
      });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  // --- Befundaktionen ------------------------------------------------------
  async function setStatus(f: Finding, status: "open" | "ignored" | "accepted") {
    setBusy(true);
    try {
      await setFindingStatus(f.id, status);
      reload();
    } finally {
      setBusy(false);
    }
  }

  function suggest(f: Finding) {
    // Der Vorschlag geht an das KI-Panel: Dort läuft die Provider-Logik,
    // und der Autor sieht die Antwort im gewohnten Bereich.
    const prompt =
      `Verbesserungsvorschlag für folgenden Befund aus der Manuskriptprüfung.\n\n` +
      `Befund: ${f.message}\n` +
      `Erklärung: ${f.explanation}\n` +
      (f.snippet ? `Textstelle: ${f.snippet}\n` : "") +
      `\nMache einen konkreten, knappen Vorschlag. Keine allgemeinen Ratschläge.`;

    try {
      // Zwischenablage statt eigener Modellanbindung: Der Nutzer entscheidet,
      // wohin der Vorschlag geht, und es entsteht kein doppelter Chat-Pfad.
      void navigator.clipboard.writeText(prompt);
      setNotice({
        text: "Anfrage in die Zwischenablage kopiert. Im KI-Panel unter „Freier Chat“ einfügen.",
        kind: "ok",
      });
    } catch {
      setNotice({
        text: "Die Zwischenablage ist nicht verfügbar. Formuliere die Frage im KI-Panel selbst.",
        kind: "warn",
      });
    }
  }

  function jumpTo(f: Finding) {
    if (f.chapterId) openChapter(f.chapterId);
    setNotice({
      text:
        `Kapitel geöffnet. Die Stelle liegt bei Zeichen ${f.start}` +
        (f.snippet ? ` — suche im Editor nach: ${f.snippet.slice(0, 40)}` : "") +
        ".",
      kind: "ok",
    });
  }

  // --- Darstellung ---------------------------------------------------------
  if (!projectId) {
    return (
      <div className="dg">
        <div className="dg-scroll">
          <div className="dg-notice">
            Wähle links ein Projekt. Die Manuskriptprüfung arbeitet je Projekt.
          </div>
        </div>
      </div>
    );
  }

  const visible = findings.filter((f) => {
    if (!TAB_CATEGORIES[tab].includes(f.category)) return false;
    if (!showResolved && f.status !== "open") return false;
    if (onlyCritical && f.severity !== "high") return false;
    if (onlyCurrentChapter && chapterId && f.chapterId !== chapterId) return false;
    return true;
  });

  /** Anzahl offener Befunde je Tab, für die Tab-Beschriftung. */
  function countFor(t: Tab): number {
    return findings.filter(
      (f) => TAB_CATEGORIES[t].includes(f.category) && f.status === "open",
    ).length;
  }

  return (
    <div className="dg">
      <div className="dg-scroll">
        <div className="dg-actions">
          <button className="dg-btn primary" onClick={() => void runCheck(false)} disabled={busy}>
            Projekt prüfen
          </button>
          <button
            className="dg-btn"
            onClick={() => void runCheck(true)}
            disabled={busy || !chapterId}
            title={chapterId ? "Nur das offene Kapitel prüfen" : "Kein Kapitel geöffnet"}
          >
            Kapitel prüfen
          </button>
        </div>

        {progress && (
          <div className="dg-progress">
            <div className="dg-progress-row">
              <span>{progress.label}</span>
              <span>
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="dg-progress-track">
              <div
                className="dg-progress-fill"
                style={{
                  width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        )}

        {notice && <div className={`dg-notice ${notice.kind}`}>{notice.text}</div>}

        <div className="dg-summary">
          <div className="dg-sum">
            <div className={`dg-sum-num${stats.high > 0 ? " high" : " ok"}`}>{stats.high}</div>
            <div className="dg-sum-lbl">kritisch</div>
          </div>
          <div className="dg-sum">
            <div className={`dg-sum-num${stats.medium > 0 ? " medium" : ""}`}>{stats.medium}</div>
            <div className="dg-sum-lbl">mittel</div>
          </div>
          <div className="dg-sum">
            <div className="dg-sum-num">{stats.low}</div>
            <div className="dg-sum-lbl">gering</div>
          </div>
          <div className="dg-sum">
            <div className="dg-sum-num">{stats.total}</div>
            <div className="dg-sum-lbl">offen</div>
          </div>
        </div>

        <div className="dg-tabs">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              className={`dg-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
              {countFor(t) > 0 && <span className="dg-tab-count">{countFor(t)}</span>}
            </button>
          ))}
        </div>

        {tab === "style" && report?.metrics ? (
          <MetricsPanel
            metrics={report.metrics}
            perChapter={report.perChapter}
            onOpenChapter={(id) => openChapter(id)}
          />
        ) : null}

        <div className="dg-filters">
          <button
            className={`dg-chip${onlyCritical ? " active" : ""}`}
            onClick={() => setOnlyCritical((v) => !v)}
          >
            nur kritisch
          </button>
          <button
            className={`dg-chip${onlyCurrentChapter ? " active" : ""}`}
            onClick={() => setOnlyCurrentChapter((v) => !v)}
            disabled={!chapterId}
          >
            nur dieses Kapitel
          </button>
          <button
            className={`dg-chip${showResolved ? " active" : ""}`}
            onClick={() => setShowResolved((v) => !v)}
          >
            erledigte zeigen
          </button>
        </div>

        {findings.length === 0 ? (
          <div className="dg-notice">
            Noch nicht geprüft. „Projekt prüfen“ untersucht alle Kapitel auf
            Widersprüche und stilistische Auffälligkeiten. Die Prüfung läuft
            vollständig auf deinem Rechner, ohne KI.
          </div>
        ) : visible.length === 0 ? (
          <div className="dg-notice ok">
            {TAB_LABELS[tab]}: keine offenen Befunde
            {onlyCritical || onlyCurrentChapter ? " mit den aktiven Filtern" : ""}.
          </div>
        ) : (
          <div className="dg-findings">
            {visible.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                onJump={f.chapterId ? jumpTo : null}
                onIgnore={(x) => void setStatus(x, "ignored")}
                onAccept={(x) => void setStatus(x, "accepted")}
                onReopen={(x) => void setStatus(x, "open")}
                onSuggest={suggest}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
