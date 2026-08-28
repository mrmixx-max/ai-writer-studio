// KI-Panel: rechte Seitenleiste mit Aktionen + Streaming-Ausgabe.
// Erweitert: Chatverlauf (persistiert), Multi-Modell-Auswahl, KI-Analysen.
import { useEffect, useState } from "react";
import { runKIAction } from "@/services/ki";
import { getDocumentContext } from "@/services/ki/context";
import { analyzeText, formatAnalysis, type AnalysisResult } from "@/services/ki/analyze";
import {
  listChatMessages,
  clearSession,
  saveChatMessage,
  sessionKeyFor,
  toLLMHistory,
  type StoredChatMessage,
} from "@/services/ki/history";
import { checkSlotHealth, type KIModelSlot } from "@/services/llm/multi";
import { labelFor } from "@/services/llm/modelRegistry";
import { ModelPicker } from "@/components/KIPanel/ModelPicker";
import { useActiveModel } from "@/components/KIPanel/useActiveModel";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { WhisperButton } from "@/components/Whisper/WhisperButton";
import type { KIAction, RewriteStyle } from "@/services/ki/types";
import {
  listMemory,
  saveMemory,
  deleteMemory,
  touchMemories,
  memoryStats,
  searchMemory,
  extractMemories,
  buildSuggestedContext,
  downloadMemory,
  previewCleanup,
  runCleanup,
  clearAllMemory,
  type MemoryEntry,
  type MemoryKind,
  type MemoryStats,
} from "@/services/ki/memory";
import { AIWritingAssistant } from "@/components/KIPanel/AIWritingAssistant/AIWritingAssistant";
import "@/components/Whisper/whisper.css";

const ACTIONS: { id: KIAction; label: string }[] = [
  { id: "weiterschreiben", label: "Weiterschreiben" },
  { id: "umschreiben", label: "Umschreiben" },
  { id: "zusammenfassen", label: "Zusammenfassen" },
  { id: "korrektur", label: "Korrektur" },
  { id: "brainstorming", label: "Brainstorming" },
  { id: "chat", label: "Freier Chat" },
];

const STYLES: RewriteStyle[] = ["formell", "locker", "dramatisch", "sachlich"];

export function KIPanel() {
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  // Anzeige des bei der letzten Aktion verwendeten Modells ("→ ollama · llama3.2").
  const [usedModel, setUsedModel] = useState("");
  const [style, setStyle] = useState<RewriteStyle>("sachlich");
  const [chatInput, setChatInput] = useState("");
  // Chatverlauf (persistiert in SQLite)
  const [history, setHistory] = useState<StoredChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  // Aktive Einstellungen: zentraler Hook (geteilt mit Editor-Badge + Statusbar).
  // Modellwechsel im Header greifen sofort und sind überall synchron sichtbar.
  const { settings, selectModel } = useActiveModel();
  // Multi-Modell
  const slots: KIModelSlot[] = settings.kiModelSlots ?? [];
  const [slotId, setSlotId] = useState<string>(slots[0]?.id ?? "main");
  const [slotHealth, setSlotHealth] = useState<Record<string, boolean>>({});
  // Analysen
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  // KI-Gedächtnis (Langzeit)
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memStats, setMemStats] = useState<MemoryStats | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [memQuery, setMemQuery] = useState("");
  const [memSearch, setMemSearch] = useState<MemoryEntry[] | null>(null);
  const [memTitle, setMemTitle] = useState("");
  const [memContent, setMemContent] = useState("");
  const [memKind, setMemKind] = useState<MemoryKind>("fakt");
  const [cleanupPreviewCount, setCleanupPreviewCount] = useState<number | null>(null);
  const editor = useEditorStore();
  const chapterId = useProjectStore.getState().activeChapterId;
  const sessionId = sessionKeyFor(chapterId);

  // Verlauf beim Mount / Kapitelwechsel laden
  useEffect(() => {
    setHistory(listChatMessages(sessionId));
  }, [sessionId]);

  // Gedächtnis beim Mount / Kapitelwechsel laden
  const projectId = useProjectStore.getState().activeProjectId;
  useEffect(() => {
    try {
      setMemories(listMemory({ projectId }));
      setMemStats(memoryStats());
    } catch {
      // DB noch nicht initialisiert (z. B. in Tests) — Gedächtnis bleibt leer
    }
  }, [projectId]);

  // Nach jeder KI-Aktion: relevante Erinnerungen automatisch aus Chat-Text extrahieren
  async function autoRemember(text: string) {
    if (!text || text.length < 40) return;
    try {
      const found = extractMemories(text);
      for (const c of found) {
        await saveMemory({
          projectId: projectId ?? null,
          chapterId: chapterId ?? null,
          sessionId,
          kind: c.kind,
          title: c.title,
          content: c.content,
          importance: c.importance,
          source: "auto",
        });
      }
      if (found.length) {
        setMemories(listMemory({ projectId }));
        setMemStats(memoryStats());
      }
    } catch {
      // DB nicht initialisiert (z. B. Tests) — Lernen überspringen
    }
  }

  // Modell-Slots auf Erreichbarkeit prüfen
  useEffect(() => {
    if (slots.length) checkSlotHealth(settings, slots).then(setSlotHealth);
  }, [settings]);

  // Modellwechsel aus dem Header: über den zentralen Hook (persistiert + Sync-Event).

  // Strg+Shift+M: Fokus auf die Modell-Auswahl im KI-Panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && (e.key === "M" || e.key === "m")) {
        e.preventDefault();
        document.getElementById("ki-model-picker-toggle")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function insertIntoDoc() {
    // Hängt KI-Output als neuen Absatz ans Dokument-Ende
    const cur = JSON.parse(editor.content || "{}");
    const para = { type: "paragraph", content: [{ type: "text", text: output }] };
    if (cur.content && Array.isArray(cur.content)) cur.content.push(para);
    else cur.content = [para];
    editor.setContent(JSON.stringify(cur));
  }

  async function run(action: KIAction) {
    setBusy(true);
    setOutput("");
    setStreaming("");
    setOffline(false);
    setAnalysis(null);
    const ctx = getDocumentContext();
    // Verwendetes Modell am Antwort-Beginn anzeigen ("→ ollama · llama3.2").
    setUsedModel(`${labelFor(settings.provider)} · ${settings.model}`);
    // Selektion: im echten Editor via window.getSelection(); hier Placeholder
    const selection = (window.getSelection()?.toString() ?? "").slice(0, 4000);
    // Chatverlauf (letzte 12 Nachrichten) an den Request anhängen
    const llmHistory = toLLMHistory(history).slice(-12);
    // Kontext-Vorschläge: relevante Erinnerungen + Projektwissen als Block
    let memoryBlock = "";
    let usedIds: string[];
    try {
      const sugg = buildSuggestedContext(selection || ctx, projectId ?? null);
      memoryBlock = sugg.block;
      usedIds = sugg.usedIds;
      if (usedIds.length) touchMemories(usedIds); // Relevanz-Tracking
    } catch {
      // DB nicht initialisiert (z. B. Tests) — ohne Gedächtnis fortfahren
    }
    await saveMsg("user", action === "chat" ? chatInput : `[${action}] ${selection.slice(0, 200) || ctx.slice(-200)}`);
    const res = await runKIAction(
      settings,
      { action, selection, context: ctx, style, chatMessage: chatInput, slotId, history: llmHistory, memoryContext: memoryBlock || undefined },
      (t) => setStreaming((s) => s + t),
    );
    setOutput(res.text);
    setStreaming("");
    setOffline(res.offline);
    setBusy(false);
    setChatInput("");
    await saveMsg("assistant", res.text);
    // Langzeit-Gedächtnis: aus Nutzer- und KI-Antwort automatisch lernen
    await autoRemember(chatInput || selection || "");
    await autoRemember(res.text);
  }

  async function saveMsg(role: "user" | "assistant", content: string) {
    if (!content.trim()) return;
    const slot = slots.find((s) => s.id === slotId);
    const msg = await saveChatMessage(sessionId, role, content, {
      chapterId: chapterId ?? null,
      provider: slot?.provider ?? null,
      model: slot?.model ?? null,
    });
    setHistory((h) => [...h, msg]);
  }

  function runAnalysis() {
    const ctx = getDocumentContext();
    const selection = window.getSelection()?.toString() ?? "";
    const text = selection || ctx;
    if (!text.trim()) return;
    const r = analyzeText(text);
    setAnalysis(r);
    setOutput(formatAnalysis(r));
  }

  async function resetHistory() {
    await clearSession(sessionId);
    setHistory([]);
  }

  // === KI-Gedächtnis: Handlers ===
  async function addManualMemory() {
    if (!memTitle.trim() || !memContent.trim()) return;
    await saveMemory({
      projectId: projectId ?? null,
      chapterId: chapterId ?? null,
      sessionId,
      kind: memKind,
      title: memTitle,
      content: memContent,
      importance: 4,
      source: "manuell",
    });
    setMemTitle("");
    setMemContent("");
    setMemories(listMemory({ projectId }));
    setMemStats(memoryStats());
  }

  async function removeMemory(id: string) {
    await deleteMemory(id);
    setMemories((m) => m.filter((x) => x.id !== id));
    setMemStats(memoryStats());
  }

  function doMemorySearch() {
    if (!memQuery.trim()) { setMemSearch(null); return; }
    setMemSearch(searchMemory(memQuery, projectId ?? null));
  }

  function showCleanupPreview(days: number) {
    setCleanupPreviewCount(previewCleanup({ olderThanDays: days, autoOnly: true }).count);
  }

  async function cleanupOld(days: number) {
    await runCleanup({ olderThanDays: days, autoOnly: true });
    setMemories(listMemory({ projectId }));
    setMemStats(memoryStats());
    setCleanupPreviewCount(null);
  }

  async function wipeMemory() {
    await clearAllMemory(projectId ?? null);
    setMemories([]);
    setMemStats(memoryStats());
  }

  return (
    <aside id="app-ai-panel" tabIndex={-1} aria-label="KI-Assistent" className="ki-panel">
      <h3>KI-Assistent</h3>

      {/* Jederzeitige Modell-Auswahl (Header): aktives Modell, Wechsel ohne Neustart */}
      <ModelPicker settings={settings} onSelect={selectModel} toggleId="ki-model-picker-toggle" />

      {offline && <span className="offline-badge">Offline-Modus</span>}

      {/* Multi-Modell: Slot-Auswahl mit Health-Anzeige */}
      {slots.length > 0 && (
        <label className="ki-model-select">
          Modell:
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.model}){slotHealth[s.id] === false ? " — offline" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="ki-actions">
        {ACTIONS.map((a) => (
          <button key={a.id} onClick={() => run(a.id)} disabled={busy}>
            {a.label}
          </button>
        ))}
      </div>

      {busy && (
        <label className="ki-style">
          Stil (Umschreiben):
          <select value={style} onChange={(e) => setStyle(e.target.value as RewriteStyle)}>
            {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}

      <div className="ki-chat-input">
        <textarea
          placeholder="Freie Frage an die KI… (Shift+Enter = neue Zeile)"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run("chat");
            }
          }}
          rows={4}
        />
      </div>

      <WhisperButton
        chapterId={chapterId}
        onResult={(text) => setChatInput((v) => (v ? v + "\n" + text : text))}
      />

      {/* KI-Analysen: offline, ohne Provider */}
      <button className="ki-analyze" onClick={runAnalysis} disabled={busy}>
        Text analysieren (Sentiment · Stil · Lesbarkeit)
      </button>
      {analysis && (
        <div className="ki-analysis">
          <span>Sentiment: {analysis.sentiment.label} ({analysis.sentiment.score})</span>
          <span>⌀ Satz: {analysis.style.avgSentenceLength} Wörter · Dialog {Math.round(analysis.style.dialogueRatio * 100)}%</span>
          <span>LIX {analysis.readability.lix} — {analysis.readability.level}</span>
        </div>
      )}

      {/* Persistierter Chatverlauf */}
      <div className="ki-history">
        <button className="ki-history-toggle" onClick={() => setShowHistory((v) => !v)}>
          Chatverlauf {showHistory ? "ausblenden" : `einblenden (${history.length})`}
        </button>
        {showHistory && (
          <>
            <div className="ki-history-list">
              {history.length === 0 && <p className="ki-history-empty">Noch keine Nachrichten.</p>}
              {history.map((m) => (
                <div key={m.id} className={`ki-history-msg ki-history-${m.role}`}>
                  <span className="ki-history-role">{m.role === "user" ? "Du" : "KI"}</span>
                  <p>{m.content.slice(0, 400)}{m.content.length > 400 ? "…" : ""}</p>
                </div>
              ))}
            </div>
            {history.length > 0 && (
              <button onClick={resetHistory}>Verlauf löschen</button>
            )}
          </>
        )}
      </div>

      <div className="ki-output">
        {(streaming || output) && usedModel && (
          <p className="ki-response-model">
            → {usedModel}
            {offline ? <span className="model-offline"> (offline)</span> : null}
          </p>
        )}
        {streaming && <pre className="streaming">{streaming}</pre>}
        {output && <p>{output}</p>}
      </div>

      {output && !busy && (
        <button className="ki-insert" onClick={insertIntoDoc}>
          In Dokument einfügen
        </button>
      )}

      {/* KI-Gedächtnis: Langzeit-Erinnerungen, Kontext-Vorschläge, Export, Bereinigung */}
      <div className="ki-memory">
        <button className="ki-memory-toggle" onClick={() => setShowMemory((v) => !v)}>
          🧠 Gedächtnis {memStats ? `(${memStats.total})` : ""}
        </button>
        {showMemory && (
          <div className="ki-memory-body">
            {memStats && (
              <p className="ki-memory-stats">
                {memStats.total} Einträge · auto {memStats.auto} / manuell {memStats.manual}
                {memStats.oldest && ` · seit ${new Date(memStats.oldest).toLocaleDateString("de-DE")}`}
              </p>
            )}

            {/* Suchen */}
            <div className="ki-memory-search">
              <input
                placeholder="Gedächtnis durchsuchen…"
                value={memQuery}
                onChange={(e) => setMemQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doMemorySearch()}
              />
              <button onClick={doMemorySearch}>Suchen</button>
            </div>

            {/* Manuelle Erinnerung anlegen */}
            <div className="ki-memory-add">
              <select value={memKind} onChange={(e) => setMemKind(e.target.value as MemoryKind)}>
                <option value="charakter">Charakter</option>
                <option value="ort">Ort</option>
                <option value="fakt">Fakt</option>
                <option value="gespraech">Gespräch</option>
                <option value="stil">Stil</option>
              </select>
              <input placeholder="Titel" value={memTitle} onChange={(e) => setMemTitle(e.target.value)} />
              <textarea placeholder="Was soll sich die KI merken?" value={memContent} onChange={(e) => setMemContent(e.target.value)} />
              <button onClick={addManualMemory}>Merken</button>
            </div>

            {/* Eintragsliste (Suchergebnis oder alles) */}
            <div className="ki-memory-list">
              {(memSearch ?? memories).length === 0 && <p className="ki-memory-empty">Noch keine Erinnerungen.</p>}
              {(memSearch ?? memories).map((m) => (
                <div key={m.id} className={`ki-memory-entry ki-memory-${m.kind}`}>
                  <span className="ki-memory-kind">{m.kind}</span>
                  <strong>{m.title}</strong>
                  <p>{m.content.slice(0, 180)}{m.content.length > 180 ? "…" : ""}</p>
                  <span className="ki-memory-meta">
                    {m.source} · Wichtigkeit {m.importance}/5
                    {m.lastUsedAt ? ` · zuletzt genutzt ${new Date(m.lastUsedAt).toLocaleDateString("de-DE")}` : " · nie genutzt"}
                  </span>
                  <button className="ki-memory-delete" onClick={() => removeMemory(m.id)} title="Erinnerung löschen">✕</button>
                </div>
              ))}
            </div>

            {/* Export */}
            <div className="ki-memory-export">
              <button onClick={() => downloadMemory("json")}>Export JSON</button>
              <button onClick={() => downloadMemory("markdown")}>Export Markdown</button>
            </div>

            {/* Bereinigung */}
            <div className="ki-memory-cleanup">
              <button onClick={() => showCleanupPreview(30)} title="Vorschau: automatische Einträge älter als 30 Tage">Vorschau: &gt; 30 Tage</button>
              <button onClick={() => showCleanupPreview(90)} title="Vorschau: automatische Einträge älter als 90 Tage">Vorschau: &gt; 90 Tage</button>
              {cleanupPreviewCount !== null && (
                <span className="ki-memory-cleanup-preview">
                  {cleanupPreviewCount} Einträge betroffen ·{" "}
                  <button onClick={() => cleanupOld(30)}>30 T. löschen</button>
                  <button onClick={() => cleanupOld(90)}>90 T. löschen</button>
                </span>
              )}
              <button className="ki-memory-wipe" onClick={wipeMemory} title="ALLE Erinnerungen dieses Projekts löschen">Alles löschen</button>
            </div>
          </div>
        )}
      </div>

      {/* Erweiterter KI-Schreibassistent: Auto-Complete, Style Transfer, Dialoge, Impulse */}
      <AIWritingAssistant />
    </aside>
  );
}
