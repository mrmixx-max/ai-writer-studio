// Zitate-Tab: Zitate mit Quellenangabe verwalten.
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  listResearchQuotes,
  listResearchSources,
  upsertResearchQuote,
  deleteResearchQuote,
  formatQuoteWithSource,
} from "@/services/knowledge/research";
import type { ResearchQuote, ResearchSource } from "@/types/research";

interface Props {
  projectId: string;
}

export function QuotesTab({ projectId }: Props) {
  const [quotes, setQuotes] = useState<ResearchQuote[]>([]);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sourceId, setSourceId] = useState<string>("");
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    setQuotes(listResearchQuotes(projectId, sourceFilter === "all" ? undefined : sourceFilter));
    setSources(listResearchSources(projectId));
  }, [projectId, sourceFilter]);

  useEffect(reload, [reload]);

  const sourceById = useMemo(() => {
    const m = new Map<string, ResearchSource>();
    for (const s of sources) m.set(s.id, s);
    return m;
  }, [sources]);

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await upsertResearchQuote(
        { projectId, sourceId: sourceId || null, text, page, comment, tags },
        editingId ?? undefined,
      );
      setText(""); setPage(""); setComment(""); setTags("");
      setEditingId(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Zitat löschen?")) return;
    setBusy(true);
    try {
      await deleteResearchQuote(id);
      reload();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(q: ResearchQuote) {
    setEditingId(q.id);
    setSourceId(q.sourceId ?? "");
    setText(q.text);
    setPage(q.page);
    setComment(q.comment);
    setTags(q.tags);
  }

  function copyCitation(q: ResearchQuote) {
    void navigator.clipboard?.writeText(formatQuoteWithSource(q, q.sourceId ? sourceById.get(q.sourceId) ?? null : null));
  }

  return (
    <>
      <div className="research-form">
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">— Ohne Quellenangabe —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.author ? `${s.author}: ` : ""}{s.title}
            </option>
          ))}
        </select>
        <textarea placeholder="Zitat *" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="research-form-row">
          <input placeholder="Seite / Stelle" value={page} onChange={(e) => setPage(e.target.value)} />
          <input placeholder="Tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <input placeholder="Kommentar" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="research-form-row">
          <button onClick={() => void save()} disabled={busy || !text.trim()}>
            {editingId ? "Änderungen speichern" : "Zitat hinzufügen"}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setText(""); setPage(""); setComment(""); setTags(""); setSourceId(""); }}>
              Abbrechen
            </button>
          )}
        </div>
      </div>

      <div className="research-form-row">
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">Alle Quellen</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      <div className="research-list">
        {quotes.length === 0 && <div className="research-empty">Noch keine Zitate erfasst.</div>}
        {quotes.map((q) => {
          const src = q.sourceId ? sourceById.get(q.sourceId) ?? null : null;
          return (
            <div key={q.id} className="research-card">
              <div className="research-card-head">
                <span className="research-card-title">„{q.text.length > 120 ? `${q.text.slice(0, 120)}…` : q.text}“</span>
              </div>
              <div className="research-card-meta">
                {src ? `${src.author || "Unbekannt"}: ${src.title}` : "Ohne Quelle"}{q.page && ` · S. ${q.page}`}
              </div>
              {q.comment && <div className="research-card-body">{q.comment}</div>}
              <div className="research-card-actions">
                <button onClick={() => copyCitation(q)} title="Zitat mit Quellenangabe kopieren">Kopieren</button>
                <button onClick={() => startEdit(q)}>Bearbeiten</button>
                <button onClick={() => void remove(q.id)} disabled={busy}>Löschen</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
