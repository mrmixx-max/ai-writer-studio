// KI-Panel: rechte Seitenleiste mit Aktionen + Streaming-Ausgabe.
// Erweitert: Chatverlauf (persistiert), Multi-Modell-Auswahl, KI-Analysen.
import { useEffect, useRef, useState } from "react";
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
import type { KIModelSlot } from "@/services/llm/multi";
import { labelFor } from "@/services/llm/modelRegistry";
import { ModelPicker } from "@/components/KIPanel/ModelPicker";
import { useActiveModel } from "@/components/KIPanel/useActiveModel";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { WhisperButton } from "@/components/Whisper/WhisperButton";
import type { KIAction, RewriteStyle, RewriteLength, RewriteTarget, RewriteOptions } from "@/services/ki/types";
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
import { useI18n, type Lang, type TranslationKey } from "@/i18n";
import "@/components/Whisper/whisper.css";

const DATE_LOCALE: Record<Lang, string> = {
  de: "de-DE",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
};

const ACTIONS: { id: KIAction; key: TranslationKey }[] = [
  { id: "weiterschreiben", key: "ki.action.weiter" },
  { id: "umschreiben", key: "ki.action.umschreiben" },
  { id: "zusammenfassen", key: "ki.action.zusammenfassen" },
  { id: "korrektur", key: "ki.action.korrektur" },
  { id: "brainstorming", key: "ki.action.brainstorming" },
  { id: "chat", key: "ki.action.chat" },
];

const STYLE_LABELS: Record<RewriteStyle, TranslationKey> = {
  formell: "ki.style.formell",
  locker: "ki.style.locker",
  dramatisch: "ki.style.dramatisch",
  sachlich: "ki.style.sachlich",
};
const STYLES: RewriteStyle[] = ["formell", "locker", "dramatisch", "sachlich"];
const LENGTH_LABELS: Record<RewriteLength, TranslationKey> = {
  kürzer: "ki.length.kurzer",
  gleich: "ki.length.gleich",
  länger: "ki.length.laenger",
};
const LENGTHS: RewriteLength[] = ["kürzer", "gleich", "länger"];
const TARGETS: { value: RewriteTarget; key: TranslationKey }[] = [
  { value: "de", key: "ki.target.de" },
  { value: "en", key: "ki.target.en" },
];

const MEM_KIND_LABELS: Record<MemoryKind, TranslationKey> = {
  charakter: "ki.memKind.charakter",
  ort: "ki.memKind.ort",
  fakt: "ki.memKind.fakt",
  gespraech: "ki.memKind.gespraech",
  stil: "ki.memKind.stil",
};
const MEM_KINDS: MemoryKind[] = ["charakter", "ort", "fakt", "gespraech", "stil"];

export function KIPanel() {
  const { t, lang } = useI18n();
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  // Sprint 19d (Agent 2): Warte-Anzeige für langsame lokale Modelle.
  // elapsed zählt Sekunden seit Run-Start; der AbortController erlaubt Abbrechen.
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  // Anzeige des bei der letzten Aktion verwendeten Modells ("→ ollama · llama3.2").
  const [usedModel, setUsedModel] = useState("");
  // RAG-Quellen der letzten Antwort (Bücher/Dokumente aus dem Wissensindex).
  const [ragSources, setRagSources] = useState<string[]>([]);
  const [activeAction, setActiveAction] = useState<KIAction | null>(null);
  const [rewriteOptions, setRewriteOptions] = useState<RewriteOptions>({
    style: "sachlich",
    length: "gleich",
    target: "de",
  });
  const [chatInput, setChatInput] = useState("");
  // Chatverlauf (persistiert in SQLite)
  const [history, setHistory] = useState<StoredChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  // Aktive Einstellungen: zentraler Hook (geteilt mit Editor-Badge + Statusbar).
  // Modellwechsel im Header greifen sofort und sind überall synchron sichtbar.
  const { settings, selectModel } = useActiveModel();
  // Multi-Modell
  const slots: KIModelSlot[] = settings.kiModelSlots ?? [];
  const slotId = slots[0]?.id ?? "main";
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
    useEditorStore.getState().insertAtEnd(output);
  }

  // Elapsed-Timer: läuft nur während busy, Reset bei Ende.
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  // Bricht den laufenden Stream ab (Button bleibt während busy klickbar).
  function cancelRun() {
    abortRef.current?.abort();
  }

  async function run(action: KIAction) {
    // Keine überlappenden Runs (z. B. Return-Taste während busy) — sonst
    // würden zwei Streams um output/streaming konkurrieren.
    if (busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    // Dropdown-Steuerung: nur bei "umschreiben" Optionen zeigen
    setActiveAction(action === "umschreiben" ? "umschreiben" : null);
    setBusy(true);
    setOutput("");
    setStreaming("");
    setOffline(false);
    setRagSources([]);
    setAnalysis(null);
    try {
      await runActionInner(action, controller.signal);
    } catch (e) {
      // Abbruch ist kein Fehler: kurze Rückmeldung statt Fehlertext.
      if (controller.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        setOutput(t("ki.aborted"));
        setStreaming("");
      } else {
        // Fehler sichtbar machen statt still zu verschlucken (unhandled rejection).
        const msg = t("ki.error", { message: e instanceof Error ? e.message : String(e) });
        setOutput(msg);
        setStreaming("");
        await autoRemember("").catch(() => {}); // no-op Guard
      }
    } finally {
      // KRITISCH: busy immer zurücksetzen — sonst bleiben nach einem Fehler
      // alle Buttons (inkl. Senden) dauerhaft disabled.
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function runActionInner(action: KIAction, signal?: AbortSignal) {
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
      {
        action,
        selection,
        context: ctx,
        style: rewriteOptions.style,
        rewriteOpts: action === "umschreiben" ? rewriteOptions : undefined,
        chatMessage: chatInput,
        slotId,
        history: llmHistory,
        memoryContext: memoryBlock || undefined,
        // Dokumenten-RAG: Bücher/Dokumente des aktiven Projekts als Faktenbasis.
        projectId: projectId ?? null,
      },
      (chunk) => setStreaming((s) => s + chunk),
      { signal },
    );
    setOutput(res.text);
    setStreaming("");
    setOffline(res.offline);
    setRagSources(res.ragSources ?? []);
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
    <aside id="app-ai-panel" tabIndex={-1} aria-label={t("ki.title")} className="ki-panel">
      <h3>{t("ki.title")}</h3>

      {/* Jederzeitige Modell-Auswahl (Header): aktives Modell, Wechsel ohne Neustart */}
      <ModelPicker settings={settings} onSelect={selectModel} toggleId="ki-model-picker-toggle" />

      {offline && <span className="offline-badge">{t("ki.offline")}</span>}

      {/* Modell-Dropdown entfernt — redundant mit ModelPicker */}

      {/* Erweiterte Umschreib-Optionen: nur bei activeAction === "umschreiben" */}
      {activeAction === "umschreiben" && (
        <div className="ki-rewrite-options">
          <label className="ki-style">
            {t("ki.styleLabel")}:
            <select
              aria-label={t("ki.styleLabel")}
              value={rewriteOptions.style}
              onChange={(e) => {
                const v = e.target.value as RewriteStyle;
                setRewriteOptions((o) => ({ ...o, style: v }));
              }}
            >
              {STYLES.map((s) => <option key={s} value={s}>{t(STYLE_LABELS[s])}</option>)}
            </select>
          </label>
          <label className="ki-length">
            {t("ki.lengthLabel")}:
            <select
              aria-label={t("ki.lengthLabel")}
              value={rewriteOptions.length}
              onChange={(e) => setRewriteOptions((o) => ({ ...o, length: e.target.value as RewriteLength }))}
            >
              {LENGTHS.map((l) => <option key={l} value={l}>{t(LENGTH_LABELS[l])}</option>)}
            </select>
          </label>
          <label className="ki-target">
            {t("ki.targetLabel")}:
            <select
              aria-label={t("ki.targetLabel")}
              value={rewriteOptions.target}
              onChange={(e) => setRewriteOptions((o) => ({ ...o, target: e.target.value as RewriteTarget }))}
            >
              {TARGETS.map((tg) => <option key={tg.value} value={tg.value}>{t(tg.key)}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="ki-actions">
        {ACTIONS.map((a) => (
          <button key={a.id} onClick={() => run(a.id)} disabled={busy}>
            {t(a.key)}
          </button>
        ))}
      </div>

      <div className="ki-chat-input">
        <textarea
          placeholder={t("ki.chatPh")}
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
        <button className="ki-send" onClick={() => run("chat")} disabled={busy}>
          {t("ki.send")}
        </button>
      </div>

      <WhisperButton
        chapterId={chapterId}
        onResult={(text) => setChatInput((v) => (v ? v + "\n" + text : text))}
      />

      {/* KI-Analysen: offline, ohne Provider */}
      <button className="ki-analyze" onClick={runAnalysis} disabled={busy}>
        {t("ki.analyze")}
      </button>
      {analysis && (
        <div className="ki-analysis">
          <span>{t("ki.sentiment")} {analysis.sentiment.label} ({analysis.sentiment.score})</span>
          <span>{t("ki.avgSentence")} {analysis.style.avgSentenceLength} {t("ki.words")} · {t("ki.dialog")} {Math.round(analysis.style.dialogueRatio * 100)}%</span>
          <span>LIX {analysis.readability.lix} — {analysis.readability.level}</span>
        </div>
      )}

      {/* Persistierter Chatverlauf */}
      <div className="ki-history">
        <button className="ki-history-toggle" onClick={() => setShowHistory((v) => !v)}>
          {t("ki.history")} {showHistory ? t("ki.historyHide") : t("ki.historyShow", { count: history.length })}
        </button>
        {showHistory && (
          <>
            <div className="ki-history-list">
              {history.length === 0 && <p className="ki-history-empty">{t("ki.historyEmpty")}</p>}
              {history.map((m) => (
                <div key={m.id} className={`ki-history-msg ki-history-${m.role}`}>
                  <span className="ki-history-role">{m.role === "user" ? t("ki.roleUser") : t("ki.roleAi")}</span>
                  <p>{m.content.slice(0, 400)}{m.content.length > 400 ? "…" : ""}</p>
                </div>
              ))}
            </div>
            {history.length > 0 && (
              <button onClick={resetHistory}>{t("ki.clearHistory")}</button>
            )}
          </>
        )}
      </div>

      <div className="ki-output">
        {/* Sprint 19d: klarer busy-Zustand statt eingefrorener Buttons.
            Aktionen/Senden bleiben während busy disabled, aber Abbrechen
            ist jederzeit klickbar; Elapsed-Timer + Lade-Hinweis nach 10 s
            ohne erstes Token (große lokale Modelle brauchen 1–2 Min). */}
        {busy && (
          <div className="ki-busy" role="status" aria-live="polite">
            <span className="ki-busy-label">{t("ki.busy", { seconds: elapsed })}</span>
            {elapsed >= 10 && !streaming && !output && (
              <span className="ki-slow-hint">
                {t("ki.slowHint")}
              </span>
            )}
            <button className="ki-cancel" onClick={cancelRun}>
              {t("ki.cancel")}
            </button>
          </div>
        )}
        {(streaming || output) && usedModel && (
          <p className="ki-response-model">
            → {usedModel}
            {offline ? <span className="model-offline">{t("ki.offlineSuffix")}</span> : null}
          </p>
        )}
        {streaming && <pre className="streaming">{streaming}</pre>}
        {output && <p>{output}</p>}
        {ragSources.length > 0 && (
          <p className="ki-rag-sources" data-testid="ki-rag-sources">
            {t("ki.ragSources")}: {ragSources.join(" · ")}
          </p>
        )}
      </div>

      {output && !busy && (
        <button className="ki-insert" onClick={insertIntoDoc}>
          {t("ki.insert")}
        </button>
      )}

      {/* KI-Gedächtnis: Langzeit-Erinnerungen, Kontext-Vorschläge, Export, Bereinigung */}
      <div className="ki-memory">
        <button className="ki-memory-toggle" onClick={() => setShowMemory((v) => !v)}>
          {t("ki.memory")} {memStats ? `(${memStats.total})` : ""}
        </button>
        {showMemory && (
          <div className="ki-memory-body">
            {memStats && (
              <p className="ki-memory-stats">
                {t("ki.memoryStats", { total: memStats.total, auto: memStats.auto, manual: memStats.manual })}
                {memStats.oldest && ` · ${t("ki.memorySince", { date: new Date(memStats.oldest).toLocaleDateString(DATE_LOCALE[lang]) })}`}
              </p>
            )}

            {/* Suchen */}
            <div className="ki-memory-search">
              <input
                placeholder={t("ki.memSearchPh")}
                value={memQuery}
                onChange={(e) => setMemQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doMemorySearch()}
              />
              <button onClick={doMemorySearch}>{t("ki.search")}</button>
            </div>

            {/* Manuelle Erinnerung anlegen */}
            <div className="ki-memory-add">
              <select value={memKind} onChange={(e) => setMemKind(e.target.value as MemoryKind)}>
                {MEM_KINDS.map((k) => <option key={k} value={k}>{t(MEM_KIND_LABELS[k])}</option>)}
              </select>
              <input placeholder={t("ki.memTitlePh")} value={memTitle} onChange={(e) => setMemTitle(e.target.value)} />
              <textarea placeholder={t("ki.memContentPh")} value={memContent} onChange={(e) => setMemContent(e.target.value)} />
              <button onClick={addManualMemory}>{t("ki.remember")}</button>
            </div>

            {/* Eintragsliste (Suchergebnis oder alles) */}
            <div className="ki-memory-list">
              {(memSearch ?? memories).length === 0 && <p className="ki-memory-empty">{t("ki.memEmpty")}</p>}
              {(memSearch ?? memories).map((m) => (
                <div key={m.id} className={`ki-memory-entry ki-memory-${m.kind}`}>
                  <span className="ki-memory-kind">{t(MEM_KIND_LABELS[m.kind])}</span>
                  <strong>{m.title}</strong>
                  <p>{m.content.slice(0, 180)}{m.content.length > 180 ? "…" : ""}</p>
                  <span className="ki-memory-meta">
                    {m.source} · {t("ki.importance", { value: m.importance })}
                    {m.lastUsedAt ? ` · ${t("ki.lastUsed", { date: new Date(m.lastUsedAt).toLocaleDateString(DATE_LOCALE[lang]) })}` : ` · ${t("ki.neverUsed")}`}
                  </span>
                  <button className="ki-memory-delete" onClick={() => removeMemory(m.id)} title={t("ki.memDeleteTitle")}>✕</button>
                </div>
              ))}
            </div>

            {/* Export */}
            <div className="ki-memory-export">
              <button onClick={() => downloadMemory("json")}>{t("ki.exportJson")}</button>
              <button onClick={() => downloadMemory("markdown")}>{t("ki.exportMd")}</button>
            </div>

            {/* Bereinigung */}
            <div className="ki-memory-cleanup">
              <button onClick={() => showCleanupPreview(30)} title={t("ki.cleanupTitle30")}>{t("ki.cleanupPreview30")}</button>
              <button onClick={() => showCleanupPreview(90)} title={t("ki.cleanupTitle90")}>{t("ki.cleanupPreview90")}</button>
              {cleanupPreviewCount !== null && (
                <span className="ki-memory-cleanup-preview">
                  {t("ki.affected", { count: cleanupPreviewCount })}{" "}
                  <button onClick={() => cleanupOld(30)}>{t("ki.delete30")}</button>
                  <button onClick={() => cleanupOld(90)}>{t("ki.delete90")}</button>
                </span>
              )}
              <button className="ki-memory-wipe" onClick={wipeMemory} title={t("ki.wipeTitle")}>{t("ki.wipe")}</button>
            </div>
          </div>
        )}
      </div>

      {/* Erweiterter KI-Schreibassistent: Auto-Complete, Style Transfer, Dialoge, Impulse */}
      <AIWritingAssistant />
    </aside>
  );
}
