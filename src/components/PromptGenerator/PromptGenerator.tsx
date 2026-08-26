// Generator-Panel: Filter-Steuerung + Ergebnisliste + Aktionen pro Prompt-Karte.
import { usePromptStore } from "@/store/promptStore";
import { generatePrompts, pickOfflinePrompts } from "@/services/prompt/generate";
import { savePrompt, setFavorite, listPrompts, deletePrompt, exportFavoritesMarkdown } from "@/services/prompt/store";
import { useEditorStore } from "@/store/editorStore";
import { DEFAULT_SETTINGS } from "@/types/config";
import type { Genre, PromptType, Tone, TargetLength, GeneratedPrompt } from "@/services/prompt/types";
import { PromptCard } from "./PromptCard";
import "./prompt.css";

const GENRES: Genre[] = ["Fantasy", "Science Fiction", "Krimi/Thriller", "Romance", "Horror", "Historisch", "Literary Fiction", "Sachbuch", "Poesie", "Überraschung"];
const TYPES: PromptType[] = ["Story-Starter", "Szenen-Idee", "Charakter-Konzept", "Konflikt/Plot-Premisse", "Was-wäre-wenn", "Schreibübung", "Tagebuch-/Reflexionsprompt", "Dialog-Starter"];
const TONES: Tone[] = ["düster", "humorvoll", "romantisch", "spannend", "melancholisch", "neutral"];
const LENGTHS: TargetLength[] = ["Kurzgeschichte", "Kapitel", "Roman-Idee", "10-Minuten-Freewriting"];

export function PromptGenerator() {
  const s = usePromptStore();
  const editor = useEditorStore();

  async function run() {
    s.set("isGenerating", true);
    s.set("streamingText", "");
    s.set("results", []);
    const filters = { genres: s.genres, promptType: s.promptType, tone: s.tone, targetLength: s.targetLength, count: s.count };
    // letzte 20 gespeicherte Prompts als "bereits verwendet"
    const used = listPrompts().slice(0, 20).map((p) => p.text);
    const res = await generatePrompts(DEFAULT_SETTINGS, filters, (t) => {
      s.set("streamingText", s.streamingText + t);
    }, used);
    s.set("results", res.prompts);
    s.set("offline", res.offline);
    s.set("isGenerating", false);
  }

  function regenerateOne(idx: number) {
    // Variante: nur einen Prompt neu würfeln (offline-Pool als schnelle Variante)
    const variants = pickOfflinePrompts({ genres: s.genres, promptType: s.promptType, tone: s.tone, targetLength: s.targetLength, count: 1 });
    const next = [...s.results];
    next[idx] = variants[0] ?? next[idx];
    s.set("results", next);
  }

  function insertIntoEditor(p: GeneratedPrompt) {
    // Fügt Prompt-Text am Cursor ein (bzw. ans Ende des aktuellen Inhalts)
    const cur = JSON.parse(editor.content || "{}");
    const para = { type: "paragraph", content: [{ type: "text", text: p.text }] };
    if (cur.content && Array.isArray(cur.content)) cur.content.push(para);
    else cur.content = [para];
    editor.setContent(JSON.stringify(cur));
  }

  function newChapterFromPrompt(p: GeneratedPrompt) {
    // TODO Schritt 5 (Projekt-Service): echtes Kapitel im aktiven Projekt anlegen.
    // Hier: speichern + in Editor einfügen als Platzhalter für Kapitel-Start.
    savePrompt(p, "generator", "current");
    insertIntoEditor(p);
  }

  function copy(p: GeneratedPrompt) {
    navigator.clipboard?.writeText(p.text);
  }

  async function favorite(p: GeneratedPrompt) {
    const stored = await savePrompt(p, "generator", "current");
    await setFavorite(stored.id, true);
  }

  if (s.tab === "favorites") {
    const favs = listPrompts({ favoritesOnly: true });
    return (
      <div className="prompt-panel">
        <h3>Favoriten</h3>
        <button onClick={() => downloadMd(exportFavoritesMarkdown())}>Als Markdown exportieren</button>
        {favs.map((f) => (
          <div key={f.id} className="prompt-card">
            <p>{f.text}</p>
            <div className="prompt-actions">
              <button onClick={() => copy(f as any)}>Kopieren</button>
              <button onClick={() => deletePrompt(f.id)}>Löschen</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="prompt-panel">
      <h3>Prompt-Generator</h3>

      <label>Genre (Mehrfach)
        <select multiple value={s.genres} onChange={(e) => s.set("genres", Array.from(e.target.selectedOptions).map((o) => o.value) as Genre[])}>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>

      <label>Typ
        <select value={s.promptType} onChange={(e) => s.set("promptType", e.target.value as PromptType)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label>Ton
        <select value={s.tone} onChange={(e) => s.set("tone", e.target.value as Tone)}>
          {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label>Länge/Ziel
        <select value={s.targetLength} onChange={(e) => s.set("targetLength", e.target.value as TargetLength)}>
          {LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>

      <label>Anzahl
        <input type="number" min={1} max={10} value={s.count} onChange={(e) => s.set("count", Math.max(1, Math.min(10, +e.target.value)))} />
      </label>

      <button onClick={run} disabled={s.isGenerating}>
        {s.isGenerating ? "Generiere…" : "Prompts generieren"}
      </button>

      {s.offline && <span className="offline-badge">Offline-Modus (lokale Prompts)</span>}

      {s.isGenerating && s.streamingText && (
        <pre className="streaming">{s.streamingText}</pre>
      )}

      {s.results.map((p, i) => (
        <PromptCard
          key={i}
          prompt={p}
          onInsert={() => insertIntoEditor(p)}
          onNewChapter={() => newChapterFromPrompt(p)}
          onFavorite={() => favorite(p)}
          onCopy={() => copy(p)}
          onRegenerate={() => regenerateOne(i)}
        />
      ))}
    </div>
  );
}

function downloadMd(content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "favoriten-prompts.md";
  a.click();
  URL.revokeObjectURL(url);
}
