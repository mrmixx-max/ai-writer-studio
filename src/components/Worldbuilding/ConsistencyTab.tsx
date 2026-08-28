// Konsistenz-Tab: prüft Kapiteltexte auf konsistente Figuren-/Ort-Verwendung.
import { useState } from "react";
import { checkWorldConsistency, reportToMarkdown, type ConsistencyReport } from "@/services/worldbuilding/consistency";
import { downloadWorldbuildingFile } from "@/services/worldbuilding/worldbuildingExport";

const ICON: Record<string, string> = { info: "ℹ️", warning: "⚠️", error: "❌" };

export function ConsistencyTab({ projectId, onChanged }: { projectId: string; onChanged?: () => void }) {
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [busy, setBusy] = useState(false);

  function run() {
    setBusy(true);
    try {
      setReport(checkWorldConsistency(projectId));
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  function exportMd() {
    if (!report) return;
    downloadWorldbuildingFile(reportToMarkdown(report), "konsistenz-report.md", "text/markdown");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={run} disabled={busy}>{busy ? "Prüfe…" : "🔎 Prüfen"}</button>
        {report && <button onClick={exportMd}>⬇ Markdown-Report</button>}
      </div>

      {report && (
        <>
          <p>
            <strong>{report.chaptersChecked}</strong> Kapitel geprüft ·{" "}
            <strong>{report.mentions.characters.length}</strong> Figuren ·{" "}
            <strong>{report.mentions.locations.length}</strong> Orte ·{" "}
            <strong>{report.findings.length}</strong> Befunde
          </p>

          <h4>Befunde</h4>
          <ul>
            {report.findings.map((f, i) => (
              <li key={i}>
                {ICON[f.severity]} <strong>[{f.kind}]</strong> {f.message}
                {f.chapterTitle ? <em> — Kapitel: {f.chapterTitle}</em> : null}
              </li>
            ))}
            {!report.findings.length && <li><em>Keine Befunde — alles konsistent.</em></li>}
          </ul>

          <h4>Erwähnungen — Figuren</h4>
          <ul>
            {report.mentions.characters.map((m) => (
              <li key={m.name}>
                <strong>{m.name}</strong>: {m.total}× {m.chapters.length ? `in ${m.chapters.join(", ")}` : <em>(nirgends)</em>}
              </li>
            ))}
            {!report.mentions.characters.length && <li><em>Keine Figuren definiert.</em></li>}
          </ul>

          <h4>Erwähnungen — Orte</h4>
          <ul>
            {report.mentions.locations.map((m) => (
              <li key={m.name}>
                <strong>{m.name}</strong>: {m.total}× {m.chapters.length ? `in ${m.chapters.join(", ")}` : <em>(nirgends)</em>}
              </li>
            ))}
            {!report.mentions.locations.length && <li><em>Keine Orte definiert.</em></li>}
          </ul>
        </>
      )}
      {!report && <p><em>Noch nicht geprüft — „Prüfen" klicken.</em></p>}
    </div>
  );
}
