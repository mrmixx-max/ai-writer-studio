// Web-Clipper-Tab: URLs speichern und Seiteninhalt extrahieren.
import { useState, useEffect, useCallback } from "react";
import {
  listResearchClips,
  saveResearchClip,
  updateResearchClip,
  deleteResearchClip,
  extractWebContent,
} from "@/services/knowledge/research";
import type { ResearchClip } from "@/types/research";

interface Props {
  projectId: string;
}

export function WebClipperTab({ projectId }: Props) {
  const [clips, setClips] = useState<ResearchClip[]>([]);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => {
    setClips(listResearchClips(projectId));
  }, [projectId]);

  useEffect(reload, [reload]);

  async function clip() {
    const u = url.trim();
    if (!u) return;
    const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    setBusy(true);
    setNotice(null);
    try {
      await saveResearchClip({ projectId, url: full, notes, selectedText });
      setUrl(""); setNotes(""); setSelectedText("");
      setNotice("Clip gespeichert.");
    } catch (e) {
      setNotice(`Fehler: ${(e as Error)?.message ?? String(e)}`);
    } finally {
      setBusy(false);
      reload();
    }
  }

  async function reextract(clip: ResearchClip) {
    setBusy(true);
    setNotice(null);
    try {
      const page = await extractWebContent(clip.url);
      await updateResearchClip(clip.id, { title: page.title, content: page.content });
      setNotice("Inhalt neu extrahiert.");
    } catch (e) {
      setNotice(
        `Extraktion fehlgeschlagen (${(e as Error)?.message ?? String(e)}). ` +
        "Hinweis: Manche Seiten blockieren den Abruf (CORS).",
      );
    } finally {
      setBusy(false);
      reload();
    }
  }

  async function remove(id: string) {
    if (!confirm("Clip löschen?")) return;
    setBusy(true);
    try {
      await deleteResearchClip(id);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="research-form">
        <input
          placeholder="URL (z. B. https://example.com/artikel)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <textarea
          placeholder="Ausgesuchter Text (optional — wird mit gespeichert)"
          value={selectedText}
          onChange={(e) => setSelectedText(e.target.value)}
          style={{ minHeight: "3rem" }}
        />
        <input placeholder="Notizen zum Clip" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="research-form-row">
          <button onClick={() => void clip()} disabled={busy || !url.trim()}>
            Seite speichern &amp; Inhalt extrahieren
          </button>
        </div>
      </div>

      {notice && <div className="research-empty">{notice}</div>}

      <div className="research-list">
        {clips.length === 0 && <div className="research-empty">Noch keine Web-Clips gespeichert.</div>}
        {clips.map((c) => (
          <div key={c.id} className="research-card">
            <div className="research-card-head">
              <span className="research-card-title">{c.title || c.url}</span>
            </div>
            <a className="research-card-meta" href={c.url} target="_blank" rel="noreferrer">
              {c.url}
            </a>
            {c.selectedText && <div className="research-card-body">{c.selectedText}</div>}
            {c.content && (
              <div className="research-card-body research-clip-preview">
                {c.content.length > 600 ? `${c.content.slice(0, 600)}…` : c.content}
              </div>
            )}
            {c.notes && <div className="research-card-meta">Notiz: {c.notes}</div>}
            <div className="research-card-actions">
              <button onClick={() => void reextract(c)} disabled={busy}>Inhalt neu laden</button>
              <button onClick={() => void remove(c.id)} disabled={busy}>Löschen</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
