// Notizen-Tab: freie Forschungsnotizen verwalten.
import { useState, useEffect, useCallback } from "react";
import {
  listResearchNotes,
  upsertResearchNote,
  deleteResearchNote,
} from "@/services/knowledge/research";
import type { ResearchNote } from "@/types/research";

interface Props {
  projectId: string;
}

export function NotesTab({ projectId }: Props) {
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    setNotes(listResearchNotes(projectId));
  }, [projectId]);

  useEffect(reload, [reload]);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await upsertResearchNote({ projectId, title, content, tags }, editingId ?? undefined);
      setTitle(""); setContent(""); setTags("");
      setEditingId(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Notiz löschen?")) return;
    setBusy(true);
    try {
      await deleteResearchNote(id);
      reload();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(n: ResearchNote) {
    setEditingId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setTags(n.tags);
  }

  return (
    <>
      <div className="research-form">
        <input placeholder="Titel *" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          placeholder="Inhalt der Forschungsnotiz"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ minHeight: "8rem" }}
        />
        <input placeholder="Tags (Komma-getrennt)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <div className="research-form-row">
          <button onClick={() => void save()} disabled={busy || !title.trim()}>
            {editingId ? "Änderungen speichern" : "Notiz anlegen"}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setTitle(""); setContent(""); setTags(""); }}>
              Abbrechen
            </button>
          )}
        </div>
      </div>

      <div className="research-list">
        {notes.length === 0 && <div className="research-empty">Noch keine Forschungsnotizen.</div>}
        {notes.map((n) => (
          <div key={n.id} className="research-card">
            <div className="research-card-head">
              <span className="research-card-title">{n.title}</span>
              {n.tags && <span className="research-card-meta">{n.tags}</span>}
            </div>
            {n.content && <div className="research-card-body">{n.content}</div>}
            <div className="research-card-actions">
              <button onClick={() => startEdit(n)}>Bearbeiten</button>
              <button onClick={() => void remove(n.id)} disabled={busy}>Löschen</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
