// Exportprüfung (KDP-Preflight).
//
// Fünf Sektionen, Formatwähler, Ampel, vier Filter. Der Prüflauf läuft
// asynchron und blockiert die App nicht.

import { useState, useEffect, useCallback } from "react";
import { PreflightCard } from "./PreflightCard";
import { runPreflight } from "@/services/preflight/runner";
import { loadFindings, latestReport, saveDecision, setRuleEnabled } from "@/services/preflight/store";
import { applyFilter, computeStats, countByCategory, sortFindings } from "@/services/preflight/filter";
import { assessReadiness, assessFormat, KDP_AI_DISCLOSURE } from "@/services/preflight/readiness";
import { useProjectStore } from "@/store/projectStore";
import {
  CATEGORY_LABELS,
  EXPORT_FORMATS,
  FORMAT_LABELS,
  type ExportFormat,
  type PreflightCategory,
  type PreflightFinding,
} from "@/types/preflight";
import "./preflight.css";

interface Props {
  projectId: string | null;
  chapterId: string | null;
}

const SECTIONS: PreflightCategory[] = [
  "structure",
  "frontmatter",
  "backmatter",
  "format",
  "characters",
];

type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

export function PreflightPanel({ projectId, chapterId }: Props) {
  const proj = useProjectStore();

  const [section, setSection] = useState<PreflightCategory>("structure");
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [findings, setFindings] = useState<PreflightFinding[]>([]);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [onlyBlockers, setOnlyBlockers] = useState(false);
  const [onlyChapter, setOnlyChapter] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const reload = useCallback(() => {
    if (!projectId) {
      setFindings([]);
      setLastRun(null);
      return;
    }
    try {
      const titles = new Map(proj.chapters.map((c) => [c.id, c.title]));
      setFindings(
        loadFindings(projectId).map((f) => ({
          ...f,
          chapterTitle: f.chapterId ? (titles.get(f.chapterId) ?? null) : null,
        })),
      );
      setLastRun(latestReport(projectId)?.createdAt ?? null);
    } catch {
      // DB noch nicht bereit.
    }
  }, [projectId, proj.chapters]);

  useEffect(() => {
    reload();
    setNotice(null);
  }, [projectId, reload]);

  // --- Prüflauf ------------------------------------------------------------
  async function check(scopeChapter: boolean) {
    if (!projectId) return;
    const project = proj.projects.find((p) => p.id === projectId);

    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: 3, label: "Prüfung wird vorbereitet…" });

    try {
      const r = await runPreflight(projectId, project?.name ?? "Projekt", {
        chapterId: scopeChapter && chapterId ? chapterId : undefined,
        formats: format ? [format] : EXPORT_FORMATS,
        checkFrontmatter: true,
        checkBackmatter: true,
        onProgress: (done, total, label) =>
          setProgress({ done, total, label: label ?? "Wird geprüft…" }),
      });
      reload();

      setNotice({
        text:
          r.findings.length === 0
            ? "Keine Auffälligkeiten gefunden. Das Manuskript ist exportbereit."
            : `${r.report.blockerCount} kritisch, ${r.report.warningCount} Warnungen, ` +
              `${r.report.hintCount} Hinweise. Geprüft in ${(r.report.durationMs / 1000).toFixed(1)} s.` +
              (r.report.notice ? ` ${r.report.notice}` : ""),
        kind: r.report.blockerCount > 0 ? "err" : r.report.warningCount > 0 ? "warn" : "ok",
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
  async function decide(f: PreflightFinding, status: "open" | "ignored" | "accepted") {
    if (!projectId) return;
    setBusy(true);
    try {
      await saveDecision(projectId, f.fingerprint, status);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function disableRule(f: PreflightFinding) {
    if (!projectId) return;
    setBusy(true);
    try {
      await setRuleEnabled(projectId, f.ruleId, false, `Abgeschaltet über den Befund „${f.title}“`);
      reload();
      setNotice({
        text: `Die Regel „${f.ruleId}“ ist für dieses Projekt abgeschaltet. Beim nächsten Lauf erscheint sie nicht mehr.`,
        kind: "ok",
      });
    } finally {
      setBusy(false);
    }
  }

  function suggest(f: PreflightFinding) {
    const prompt =
      `Verbesserungsvorschlag für einen Befund aus der Exportprüfung.\n\n` +
      `Befund: ${f.title}\n` +
      `Erklärung: ${f.explanation}\n` +
      (f.recommendation ? `Empfehlung: ${f.recommendation}\n` : "") +
      (f.excerpt ? `Textstelle: ${f.excerpt}\n` : "") +
      (f.structureHint ? `Struktur: ${f.structureHint}\n` : "") +
      `\nMache einen konkreten, knappen Vorschlag.`;

    try {
      void navigator.clipboard.writeText(prompt);
      setNotice({
        text: "Anfrage in die Zwischenablage kopiert. Im KI-Panel unter „Freier Chat“ einfügen.",
        kind: "ok",
      });
    } catch {
      setNotice({ text: "Die Zwischenablage ist nicht verfügbar.", kind: "warn" });
    }
  }

  function jump(f: PreflightFinding) {
    if (f.chapterId) proj.openChapter(f.chapterId);
    setNotice({
      text:
        `Kapitel geöffnet.` +
        (f.charStart !== null ? ` Die Stelle liegt bei Zeichen ${f.charStart}.` : ""),
      kind: "ok",
    });
  }

  // --- Darstellung ---------------------------------------------------------
  if (!projectId) {
    return (
      <div className="pf">
        <div className="pf-scroll">
          <div className="dg-notice">
            Wähle links ein Projekt. Die Exportprüfung arbeitet je Projekt.
          </div>
        </div>
      </div>
    );
  }

  const stats = computeStats(findings, lastRun);
  const readiness = assessReadiness(stats);

  const visible = sortFindings(
    applyFilter(findings, {
      category: section,
      onlyBlockers,
      chapterId: onlyChapter && chapterId ? chapterId : undefined,
      format: format ?? undefined,
      includeResolved: showResolved,
    }),
  );

  return (
    <div className="pf">
      <div className="pf-scroll">
        <div className="dg-actions">
          <button className="dg-btn primary" onClick={() => void check(false)} disabled={busy}>
            Projekt prüfen
          </button>
          <button
            className="dg-btn"
            onClick={() => void check(true)}
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
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div className="dg-progress-track">
              <div
                className="dg-progress-fill"
                style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%" }}
              />
            </div>
          </div>
        )}

        {notice && <div className={`dg-notice ${notice.kind}`}>{notice.text}</div>}

        {/* Ampel */}
        <div className={`pf-light ${readiness.level}`}>
          <span className="pf-light-dot" />
          <span className="pf-light-text">
            <span className="pf-light-title">{readiness.title}</span>
            <span className="pf-light-sub">
              {readiness.detail}
              {readiness.nextStep && <> Nächster Schritt: {readiness.nextStep}.</>}
            </span>
          </span>
        </div>

        {lastRun !== null && (
          <div className="pf-lastrun">
            <span>Letzter Lauf: {new Date(lastRun).toLocaleString("de-DE")}</span>
            <span>{stats.total} offen</span>
          </div>
        )}

        {/* Formatwähler mit Zählern */}
        <div className="pf-formats">
          <button
            className={`pf-format${format === null ? " active" : ""}`}
            onClick={() => setFormat(null)}
          >
            <span className="pf-format-count">{stats.total}</span>
            alle
          </button>
          {EXPORT_FORMATS.map((fmt) => {
            const a = assessFormat(findings, fmt);
            const total = a.blocker + a.warning + a.hint;
            return (
              <button
                key={fmt}
                className={`pf-format${format === fmt ? " active" : ""}`}
                onClick={() => setFormat(fmt)}
                title={`${a.blocker} kritisch, ${a.warning} Warnungen, ${a.hint} Hinweise`}
              >
                <span
                  className={`pf-format-count${a.blocker > 0 ? " blocker" : total === 0 ? " clean" : ""}`}
                >
                  {total}
                </span>
                {FORMAT_LABELS[fmt]}
              </button>
            );
          })}
        </div>

        {/* Sektionen */}
        <div className="pf-sections">
          {SECTIONS.map((s) => {
            const n = countByCategory(findings, s);
            const hasBlocker = findings.some(
              (f) => f.category === s && f.severity === "blocker" && f.status === "open",
            );
            return (
              <button
                key={s}
                className={`pf-section${section === s ? " active" : ""}`}
                onClick={() => setSection(s)}
              >
                <span
                  className={`pf-section-num${hasBlocker ? " blocker" : n > 0 ? " has" : lastRun ? " clean" : ""}`}
                >
                  {n}
                </span>
                <span className="pf-section-lbl">{CATEGORY_LABELS[s]}</span>
              </button>
            );
          })}
        </div>

        {/* KI-Offenlegung: rechtlicher Hinweis, immer sichtbar */}
        <div className="pf-disclosure">
          <strong>Hinweis zur KI-Offenlegung bei KDP.</strong> {KDP_AI_DISCLOSURE}
        </div>

        {/* Filter */}
        <div className="dg-filters">
          <button
            className={`dg-chip${onlyBlockers ? " active" : ""}`}
            onClick={() => setOnlyBlockers((v) => !v)}
          >
            nur kritisch
          </button>
          <button
            className={`dg-chip${onlyChapter ? " active" : ""}`}
            onClick={() => setOnlyChapter((v) => !v)}
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
            Noch nicht geprüft. „Projekt prüfen“ untersucht Struktur, Frontmatter,
            Backmatter, Sonderzeichen und formatspezifische Fallstricke für alle
            fünf Exportformate. Die Prüfung läuft vollständig auf deinem Rechner,
            ohne KI.
          </div>
        ) : visible.length === 0 ? (
          <div className="dg-notice ok">
            {CATEGORY_LABELS[section]}: keine offenen Befunde
            {format ? ` für ${FORMAT_LABELS[format]}` : ""}
            {onlyBlockers || onlyChapter ? " mit den aktiven Filtern" : ""}.
          </div>
        ) : (
          <div className="dg-findings">
            {visible.map((f) => (
              <PreflightCard
                key={f.id}
                finding={f}
                onJump={f.chapterId ? jump : null}
                onIgnore={(x) => void decide(x, "ignored")}
                onAccept={(x) => void decide(x, "accepted")}
                onReopen={(x) => void decide(x, "open")}
                onSuggest={suggest}
                onDisableRule={(x) => void disableRule(x)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
