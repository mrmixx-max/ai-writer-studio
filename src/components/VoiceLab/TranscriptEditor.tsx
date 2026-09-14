// Whisper-Transkript-Editor: Transkripte lesen, korrigieren, speichern.
// Zeigt Bearbeitungsstatus (isEdited) und erlaubt Übernahme in das Kapitel.
import { useEffect, useState } from "react";
import {
  listTranscriptions,
  updateTranscriptionText,
  deleteTranscription,
  type Transcription,
} from "@/services/whisper";

interface TranscriptEditorProps {
  chapterId: string | null;
  /** Optional: korrigierten Text an den Editor zurückgeben. */
  onApplyToChapter?: (text: string) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function TranscriptEditor({ chapterId, onApplyToChapter }: TranscriptEditorProps) {
  const [items, setItems] = useState<Transcription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function reload() {
    const list = listTranscriptions(chapterId);
    setItems(list);
    setSelectedId((cur) => (cur && list.some((t) => t.id === cur) ? cur : (list[0]?.id ?? null)));
  }

  useEffect(reload, [chapterId]);

  useEffect(() => {
    const sel = items.find((t) => t.id === selectedId);
    setDraft(sel?.text ?? "");
    setDirty(false);
  }, [selectedId, items]);

  const selected = items.find((t) => t.id === selectedId);

  async function save() {
    if (!selected || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTranscriptionText(selected.id, draft);
      setItems((list) =>
        list.map((t) =>
          t.id === selected.id
            ? { ...t, text: draft, isEdited: true, updatedAt: Date.now() }
            : t,
        ),
      );
      setDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaveError(null);
    try {
      await deleteTranscription(id);
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    }
  }

  if (!items.length) {
    return (
      <div className="transcript-editor empty" data-testid="transcript-editor">
        <p>(Noch keine Transkripte — Sprachaufnahme im Editor diktieren.)</p>
      </div>
    );
  }

  return (
    <div className="transcript-editor" data-testid="transcript-editor">
      <div className="te-list">
        <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value || null)}>
          {items.map((t) => (
            <option key={t.id} value={t.id}>
              {formatDate(t.createdAt)} · {t.model ?? "whisper"}{t.isEdited ? " ✎" : ""}
            </option>
          ))}
        </select>
        {selected && (
          <button className="danger" onClick={() => remove(selected.id)} title="Transkript löschen">
            🗑
          </button>
        )}
      </div>

      {selected && (
        <>
          <textarea
            className="te-text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDirty(true);
            }}
            rows={14}
            placeholder="Transkript korrigieren…"
            data-testid="transcript-textarea"
          />
          <div className="te-actions">
            <span className="te-status">
              {dirty ? "Ungespeicherte Änderungen" : selected.isEdited ? "Korrigiert ✎" : "Original"}
              {selected.updatedAt ? ` · geändert ${formatDate(selected.updatedAt)}` : ""}
            </span>
            {saveError && (
              <span className="te-error" role="alert">
                ⚠ {saveError}
              </span>
            )}
            <button onClick={save} disabled={!dirty || saving}>
              {saving ? "Speichere…" : "💾 Korrektur speichern"}
            </button>
            {onApplyToChapter && (
              <button onClick={() => onApplyToChapter(draft)} title="Text in den Kapitel-Editor übernehmen">
                → In Kapitel übernehmen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
