// Fragment-Panel: Karten/Liste/Zeitleiste + Drag & Drop + KI-Ordnung.
import { useState } from "react";
import { useFragmentStore } from "@/store/fragmentStore";
import { createFragment, deleteFragment } from "@/services/fragment";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";

const TIME_REFS = ["Vergangenheit", "Gegenwart", "Zukunft", "unklar"];

export function FragmentPanel({ chapterId }: { chapterId: string }) {
  const store = useFragmentStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Store synchronisieren
  if (store.chapterId !== chapterId) store.setChapter(chapterId);

  const frags = store.fragments;

  async function addFragment() {
    const title = window.prompt("Fragment-Titel:");
    if (!title) return;
    await createFragment(chapterId, title, "");
    store.refresh();
  }

  async function remove(id: string) {
    if (confirm("Fragment löschen?")) {
      await deleteFragment(id);
      store.refresh();
    }
  }

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = frags.map((f) => f.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    store.reorder(ids);
    setDragId(null);
  }

  async function aiOrder(strategy: string) {
    setBusy(true);
    const summary = frags.map((f, i) => `${i + 1}. ${f.title}: ${f.content.slice(0, 100)}`).join("\n");
    const res = await runKIAction(
      DEFAULT_SETTINGS,
      {
        action: "brainstorming",
        selection: `Ordne diese Fragmente nach ${strategy}. Gib die neue Reihenfolge als Nummern-Liste (z.B. "3,1,2,4") zurück.\n\n${summary}`,
        context: "",
      },
      () => {},
    );
    // Parse Nummern-Liste
    const nums = res.text.match(/\d+/g)?.map((n) => parseInt(n, 10) - 1) ?? [];
    if (nums.length === frags.length) {
      const ordered = nums.map((i) => frags[i]?.id).filter(Boolean);
      store.reorder(ordered);
    }
    setBusy(false);
  }

  function assembleChapter() {
    const text = frags.map((f) => `## ${f.title}\n\n${f.content}`).join("\n\n");
    // TODO: in Kapitel schreiben (via projectStore)
    alert(text.slice(0, 200) + "…");
  }

  return (
    <div className="fragment-panel">
      <div className="fragment-toolbar">
        <button onClick={addFragment}>+ Fragment</button>
        <button onClick={() => store.setView("list")} className={store.view === "list" ? "active" : ""}>Liste</button>
        <button onClick={() => store.setView("cards")} className={store.view === "cards" ? "active" : ""}>Karten</button>
        <button onClick={() => store.setView("timeline")} className={store.view === "timeline" ? "active" : ""}>Zeitleiste</button>
        <button onClick={assembleChapter} disabled={!frags.length}>Zusammensetzen</button>
        <select disabled={busy} onChange={(e) => { if (e.target.value) aiOrder(e.target.value); e.target.value = ""; }}>
          <option value="">KI-Ordnung…</option>
          <option value="Dramaturgie">Dramaturgie</option>
          <option value="Spannung">Spannung</option>
          <option value="Logik">Logik</option>
          <option value="Traumlogik">Traumlogik</option>
        </select>
      </div>

      <div className={`fragment-view ${store.view}`}>
        {frags.map((f) => (
          <div
            key={f.id}
            className="fragment-card"
            draggable
            onDragStart={() => onDragStart(f.id)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(f.id)}
          >
            <div className="fragment-header">
              <input
                value={f.title}
                onChange={(e) => { f.title = e.target.value; }}
                onBlur={() => { /* updateFragment */ }}
                className="fragment-title"
              />
              <button onClick={() => remove(f.id)}>×</button>
            </div>
            <textarea
              value={f.content}
              onChange={(e) => { f.content = e.target.value; }}
              onBlur={() => { /* updateFragment */ }}
              className="fragment-content"
              placeholder="Inhalt…"
            />
            <div className="fragment-meta">
              <select value={f.timeRef ?? ""} onChange={(e) => { f.timeRef = e.target.value || null; }}>
                <option value="">Zeit?</option>
                {TIME_REFS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={f.speaker ?? ""} onChange={(e) => { f.speaker = e.target.value; }} placeholder="Sprecher" />
              <input value={f.tone ?? ""} onChange={(e) => { f.tone = e.target.value; }} placeholder="Ton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
