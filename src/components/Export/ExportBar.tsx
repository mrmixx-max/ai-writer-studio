// Export-Dialog: wählt Format + Bereich (Kapitel / Projekt) und startet Export.
import { useState } from "react";
import { exportProject, exportContent, type Format } from "@/services/export";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";

const FORMATS: Format[] = ["docx", "md", "txt", "pdf", "epub"];

export function ExportBar() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("docx");
  const [scope, setScope] = useState<"chapter" | "project">("project");
  const proj = useProjectStore();
  const editor = useEditorStore();

  async function run() {
    if (scope === "project" && proj.activeProjectId) {
      const p = proj.projects.find((x) => x.id === proj.activeProjectId);
      if (p) await exportProject(p, format);
    } else if (scope === "chapter" && proj.activeChapterId) {
      const p = proj.projects.find((x) => x.id === proj.activeProjectId);
      if (p) await exportProject(p, format, proj.activeChapterId);
    } else {
      // Insel-Export des aktuellen Editors
      await exportContent(editor.content, "Dokument", format);
    }
    setOpen(false);
  }

  return (
    <div className="export-bar">
      <button onClick={() => setOpen((o) => !o)}>Export ▾</button>
      {open && (
        <div className="export-menu">
          <label>Format
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              {FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </label>
          <label>Bereich
            <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
              <option value="project">Ganzes Projekt</option>
              <option value="chapter">Aktuelles Kapitel</option>
            </select>
          </label>
          <button className="export-go" onClick={run}>Exportieren</button>
        </div>
      )}
    </div>
  );
}
