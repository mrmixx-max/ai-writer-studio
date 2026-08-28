// Sharing-Panel: Projekt als Datei teilen, Export mit Kommentaren, Share-Import.
import { useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { listChapters } from "@/services/project";
import { exportProject, toBlocks, toMd, type Block } from "@/services/export";
import {
  buildCommentAppendix,
  shareProject,
  shareProjectAsZip,
  importProjectBundle,
  type ImportResult,
} from "@/services/collaboration/sharing";

function mdForZip(projectId: string, projectName: string): string {
  const blocks: Block[] = [];
  for (const ch of listChapters(projectId)) {
    blocks.push({ type: "h1", text: ch.title });
    blocks.push(...toBlocks(ch.content));
    blocks.push(...buildCommentAppendix(ch.id, ch.title));
  }
  return `# ${projectName}\n\n` + toMd(blocks);
}

export function SharingPanel() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const refresh = useProjectStore((s) => s.refresh);
  const openProject = useProjectStore((s) => s.openProject);
  const project = projects.find((p) => p.id === activeProjectId) ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!project) {
    return <div className="collab-empty">Kein Projekt geöffnet.</div>;
  }

  const run = async (label: string, fn: () => Promise<void> | void, done: string) => {
    setBusy(label);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
    } catch (e) {
      setMessage(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    setBusy("import");
    setMessage(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await importProjectBundle(text);
      setImportResult(res);
      refresh();
      openProject(res.projectId);
      setMessage("Import abgeschlossen.");
    } catch (e) {
      setMessage(`Import fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const chapterCount = listChapters(project.id).length;

  return (
    <div className="sharing-panel">
      <div className="sharing-project">
        <strong>{project.name}</strong>
        <span>{chapterCount} Kapitel</span>
      </div>

      <h4>Projekt teilen</h4>
      <button
        className="collab-btn"
        disabled={busy !== null}
        onClick={() => run("share", () => shareProject(project), "Share-Datei heruntergeladen.")}
      >
        📤 Als Share-Datei exportieren (.json)
      </button>
      <button
        className="collab-btn"
        disabled={busy !== null}
        onClick={() =>
          run("zip", () => shareProjectAsZip(project, mdForZip(project.id, project.name)), "ZIP-Archiv heruntergeladen.")
        }
      >
        🗜️ Als ZIP teilen (Bundle + Manuskript)
      </button>

      <h4>Export mit Kommentaren</h4>
      <button
        className="collab-btn"
        disabled={busy !== null}
        onClick={() =>
          run("export", () => exportProject(project, "md", undefined, { includeComments: true }), "Export (mit Kommentaren) heruntergeladen.")
        }
      >
        📄 Manuskript mit Kommentaren (.md)
      </button>

      <h4>Share-Datei importieren</h4>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImport(f);
          e.target.value = "";
        }}
      />
      <button className="collab-btn" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
        📥 Share-Datei öffnen
      </button>

      {importResult && (
        <div className="sharing-import-result">
          Importiert: {importResult.chapters} Kapitel, {importResult.comments} Kommentare,{" "}
          {importResult.suggestions} Vorschläge, {importResult.changes} Änderungen.
        </div>
      )}
      {message && <div className="sharing-message">{message}</div>}
      {busy && <div className="sharing-busy">… {busy}</div>}
    </div>
  );
}
