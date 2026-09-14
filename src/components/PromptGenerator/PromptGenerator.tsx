// Generator-Panel: Filter-Steuerung + Ergebnisliste + Aktionen pro Prompt-Karte.
import { useState } from "react";
import { usePromptStore } from "@/store/promptStore";
import { generatePrompts, pickOfflinePrompts } from "@/services/prompt/generate";
import { savePrompt, setFavorite, listPrompts, deletePrompt, exportFavoritesMarkdown } from "@/services/prompt/store";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { loadSettings } from "@/services/settings";
import { PROMPT_TEMPLATES } from "@/services/ki/templates";
import type { Genre, PromptType, Tone, TargetLength, GeneratedPrompt } from "@/services/prompt/types";
import { PromptCard } from "./PromptCard";
import { useI18n } from "@/i18n";
import "./prompt.css";

const GENRES: Genre[] = ["Fantasy", "Science Fiction", "Krimi/Thriller", "Romance", "Horror", "Historisch", "Literary Fiction", "Sachbuch", "Poesie", "Überraschung"];
const TYPES: PromptType[] = ["Story-Starter", "Szenen-Idee", "Charakter-Konzept", "Konflikt/Plot-Premisse", "Was-wäre-wenn", "Schreibübung", "Tagebuch-/Reflexionsprompt", "Dialog-Starter"];
const TONES: Tone[] = ["düster", "humorvoll", "romantisch", "spannend", "melancholisch", "neutral"];
const LENGTHS: TargetLength[] = ["Kurzgeschichte", "Kapitel", "Roman-Idee", "10-Minuten-Freewriting"];

export function PromptGenerator() {
  const { t } = useI18n();
  const s = usePromptStore();
  const editor = useEditorStore();
  const [templateId, setTemplateId] = useState("");

  /** Wendet eine Prompt-Vorlage auf die Filter an und generiert sofort. */
  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = PROMPT_TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    s.set("genres", [tpl.genre]);
    s.set("promptType", tpl.promptType);
    s.set("tone", tpl.tone);
    s.set("targetLength", tpl.targetLength);
    // Seed-Idee als erster Ergebnisvorschlag (offline-Karte), damit sofort etwas sichtbar ist
    s.set("results", [{ text: `${tpl.seed}\n\n${t("prompt.seedNote", { guidance: tpl.guidance })}`, genre: tpl.genre, type: tpl.promptType, hook: tpl.name }]);
  }

  async function run() {
    s.set("isGenerating", true);
    s.set("streamingText", "");
    s.set("results", []);
    const filters = { genres: s.genres, promptType: s.promptType, tone: s.tone, targetLength: s.targetLength, count: s.count };
    // letzte 20 gespeicherte Prompts als "bereits verwendet"
    const used = listPrompts().slice(0, 20).map((p) => p.text);
    const res = await generatePrompts(loadSettings(), filters, (chunk) => {
      s.set("streamingText", s.streamingText + chunk);
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
    // Echtes Kapitel im aktiven Projekt anlegen + Prompttext als Starthilfe.
    savePrompt(p, "generator", "current");
    insertIntoEditor(p);
    const project = useProjectStore.getState();
    if (project.activeProjectId) {
      project.newChapter(p.text.slice(0, 60) || t("prompt.newChapter"), p.text, "draft");
    }
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
        <h3>{t("prompt.favorites")}</h3>
        <button onClick={() => downloadMd(exportFavoritesMarkdown())}>{t("prompt.exportMd")}</button>
        {favs.map((f) => (
          <div key={f.id} className="prompt-card">
            <p>{f.text}</p>
            <div className="prompt-actions">
              <button onClick={() => copy(f as any)}>{t("prompt.copy")}</button>
              <button onClick={() => deletePrompt(f.id)}>{t("prompt.delete")}</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="prompt-panel">
      <h3>{t("prompt.title")}</h3>

      {/* Vorlagen: kuratierte Genre-Templates setzen Filter + Start-Idee */}
      <label>{t("prompt.template")}
        <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">{t("prompt.noTemplate")}</option>
          {PROMPT_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
          ))}
        </select>
      </label>

      <label>{t("prompt.genre")}
        <select multiple value={s.genres} onChange={(e) => s.set("genres", Array.from(e.target.selectedOptions).map((o) => o.value) as Genre[])}>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>

      <label>{t("prompt.type")}
        <select value={s.promptType} onChange={(e) => s.set("promptType", e.target.value as PromptType)}>
          {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
        </select>
      </label>

      <label>{t("prompt.tone")}
        <select value={s.tone} onChange={(e) => s.set("tone", e.target.value as Tone)}>
          {TONES.map((tn) => <option key={tn} value={tn}>{tn}</option>)}
        </select>
      </label>

      <label>{t("prompt.length")}
        <select value={s.targetLength} onChange={(e) => s.set("targetLength", e.target.value as TargetLength)}>
          {LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>

      <label>{t("prompt.count")}
        <input type="number" min={1} max={10} value={s.count} onChange={(e) => s.set("count", Math.max(1, Math.min(10, +e.target.value)))} />
      </label>

      <button onClick={run} disabled={s.isGenerating}>
        {s.isGenerating ? t("prompt.generating") : t("prompt.generate")}
      </button>

      {s.offline && <span className="offline-badge">{t("prompt.offline")}</span>}

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
