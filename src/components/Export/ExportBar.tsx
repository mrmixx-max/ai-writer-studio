// Export-Dialog: wählt Format + Bereich (Kapitel / Projekt) und startet Export.
//
// Vor DOCX/PDF/EPUB-Export: optionaler Preflight-Check. Blockierende Befunde
// erfordern eine Bestätigung — der Export wird nie verhindert, aber transparent
// gemacht.
import { useState } from "react";
import { exportProject, exportContent, type Format } from "@/services/export";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { runExportPreflight } from "@/services/preflight/runner";
import { exportGate } from "@/services/preflight/filter";
import type { PreflightFinding } from "@/types/preflight";

const FORMATS: Format[] = ["docx", "md", "txt", "pdf", "epub"];

// Formate, für die ein Preflight vor Export sinnvoll ist.
const PRELIGHT_FORMATS: Format[] = ["docx", "pdf", "epub"];

export function ExportBar() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("docx");
  const [scope, setScope] = useState<"chapter" | "project">("project");
  const [preflightVisible, setPreflightVisible] = useState(false);
  const [findings, setFindings] = useState<PreflightFinding[]>([]);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const projects = useProjectStore((s) => s.projects);
  const content = useEditorStore((s) => s.content);

  // --- Preflight -----------------------------------------------------------
  async function runPreflightCheck() {
    if (!activeProjectId) return;
    const p = projects.find((x) => x.id === activeProjectId);
    if (!p) return;

    setPreflightBusy(true);
    try {
      const r = await runExportPreflight(activeProjectId, p.name, format);
      setFindings(r.findings);
      setPreflightVisible(true);
    } catch {
      // Preflight fehlgeschlagen — Export trotzdem erlauben.
      setFindings([]);
    } finally {
      setPreflightBusy(false);
    }
  }

  // --- Export --------------------------------------------------------------
  async function run() {
    if (scope === "project" && activeProjectId) {
      const p = projects.find((x) => x.id === activeProjectId);
      if (p) await exportProject(p, format);
    } else if (scope === "chapter" && activeChapterId) {
      const p = projects.find((x) => x.id === activeProjectId);
      if (p) await exportProject(p, format, activeChapterId);
    } else {
      await exportContent(content, "Dokument", format);
    }
    setOpen(false);
    setPreflightVisible(false);
    setFindings([]);
  }

  function startExport() {
    // Preflight nur bei DOCX/PDF/EPUB, nicht bei Markdown/Text.
    if (PRELIGHT_FORMATS.includes(format) && activeProjectId) {
      void runPreflightCheck();
    } else {
      void run();
    }
  }

  const gate = findings.length > 0 ? exportGate(findings, format) : null;

  return (
    <div className="export-bar">
      <button onClick={() => setOpen((o) => !o)}>Export ▾</button>
      {open && (
        <div className="export-menu">
          <label>Format
            <select value={format} onChange={(e) => { setFormat(e.target.value as Format); setPreflightVisible(false); }}>
              {FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </label>
          <label>Bereich
            <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
              <option value="project">Ganzes Projekt</option>
              <option value="chapter">Aktuelles Kapitel</option>
            </select>
          </label>

          {!preflightVisible ? (
            <button className="export-go" onClick={startExport} disabled={preflightBusy}>
              {preflightBusy ? "Prüfung läuft…" : "Exportieren"}
            </button>
          ) : (
            <div className="export-preflight">
              {gate?.needsConfirm && (
                <div className="pf-gate-warn">
                  <strong>Achtung:</strong> {gate.blockers.length} kritische(r) Befund/Bunde.
                  Der Export wird empfohlen, erst nach Behebung.
                </div>
              )}
              {gate && !gate.needsConfirm && (
                <div className="pf-gate-ok">
                  Keine kritischen Befunde. Exportbereit.
                </div>
              )}
              {findings.length > 0 && (
                <details className="pf-gate-details">
                  <summary>{findings.length} Befund/Bunde anzeigen</summary>
                  <ul>
                    {findings.map((f) => (
                      <li key={f.id}>
                        <span className={`pf-tag ${f.severity}`}>
                          {f.severity === "blocker" ? "kritisch" : f.severity === "warning" ? "Warnung" : "Hinweis"}
                        </span>{" "}
                        {f.title}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="pf-gate-actions">
                <button className="export-go" onClick={run}>
                  {gate?.needsConfirm ? "Trotzdem exportieren" : "Exportieren"}
                </button>
                <button className="export-cancel" onClick={() => { setPreflightVisible(false); setFindings([]); }}>
                  Zurück
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
