// Quellen-Tab: Bücher, Artikel und Websites verwalten.
import { useState, useEffect, useCallback } from "react";
import {
  listResearchSources,
  upsertResearchSource,
  deleteResearchSource,
  type ResearchSourceInput,
} from "@/services/knowledge/research";
import { RESEARCH_SOURCE_KIND_LABELS, type ResearchSource, type ResearchSourceKind } from "@/types/research";

interface Props {
  projectId: string;
}

const EMPTY: ResearchSourceInput = {
  projectId: "",
  kind: "book",
  title: "",
  author: "",
  year: "",
  publisher: "",
  url: "",
  isbn: "",
  notes: "",
  tags: "",
};

export function SourcesTab({ projectId }: Props) {
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [kindFilter, setKindFilter] = useState<ResearchSourceKind | "all">("all");
  const [form, setForm] = useState<ResearchSourceInput>({ ...EMPTY, projectId });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    setSources(listResearchSources(projectId, kindFilter === "all" ? undefined : kindFilter));
  }, [projectId, kindFilter]);

  useEffect(reload, [reload]);
  useEffect(() => {
    setForm((f) => ({ ...f, projectId }));
    setEditingId(null);
  }, [projectId]);

  async function save() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await upsertResearchSource(form, editingId ?? undefined);
      setForm({ ...EMPTY, projectId });
      setEditingId(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Quelle löschen? Zitate verlieren ihre Quellenangabe.")) return;
    setBusy(true);
    try {
      await deleteResearchSource(id);
      reload();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: ResearchSource) {
    setEditingId(s.id);
    setForm({
      projectId,
      kind: s.kind,
      title: s.title,
      author: s.author,
      year: s.year,
      publisher: s.publisher,
      url: s.url,
      isbn: s.isbn,
      notes: s.notes,
      tags: s.tags,
    });
  }

  return (
    <>
      <div className="research-form">
        <div className="research-form-row">
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as ResearchSourceKind })}
          >
            {Object.entries(RESEARCH_SOURCE_KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <input
            placeholder="Titel *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="research-form-row">
          <input placeholder="Autor" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          <input placeholder="Jahr" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <input placeholder={form.kind === "website" ? "URL" : form.kind === "article" ? "Verlag / Zeitschrift" : "Verlag"} value={form.kind === "website" ? form.url : form.publisher} onChange={(e) => form.kind === "website" ? setForm({ ...form, url: e.target.value }) : setForm({ ...form, publisher: e.target.value })} />
        </div>
        {form.kind !== "website" && (
          <input placeholder="ISBN / DOI" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
        )}
        {form.kind !== "book" && (
          <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        )}
        <input placeholder="Tags (Komma-getrennt)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <textarea placeholder="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="research-form-row">
          <button onClick={() => void save()} disabled={busy || !form.title.trim()}>
            {editingId ? "Änderungen speichern" : "Quelle hinzufügen"}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setForm({ ...EMPTY, projectId }); }}>
              Abbrechen
            </button>
          )}
        </div>
      </div>

      <div className="research-form-row">
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as ResearchSourceKind | "all")}>
          <option value="all">Alle Arten</option>
          {Object.entries(RESEARCH_SOURCE_KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div className="research-list">
        {sources.length === 0 && <div className="research-empty">Noch keine Quellen erfasst.</div>}
        {sources.map((s) => (
          <div key={s.id} className="research-card">
            <div className="research-card-head">
              <span className="research-card-title">{s.title}</span>
              <span className="research-card-meta">
                {RESEARCH_SOURCE_KIND_LABELS[s.kind]} · {s.author || "unbekannt"} {s.year && `· ${s.year}`}
              </span>
            </div>
            {s.url && <div className="research-card-meta">{s.url}</div>}
            {s.notes && <div className="research-card-body">{s.notes}</div>}
            <div className="research-card-actions">
              <button onClick={() => startEdit(s)}>Bearbeiten</button>
              <button onClick={() => void remove(s.id)} disabled={busy}>Löschen</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
