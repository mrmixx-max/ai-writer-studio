// KI-Panel: rechte Seitenleiste mit Aktionen + Streaming-Ausgabe.
import { useState } from "react";
import { runKIAction } from "@/services/ki";
import { getDocumentContext } from "@/services/ki/context";
import { DEFAULT_SETTINGS } from "@/types/config";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { WhisperButton } from "@/components/Whisper/WhisperButton";
import type { KIAction, RewriteStyle } from "@/services/ki/types";
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
  const [style, setStyle] = useState<RewriteStyle>("sachlich");
  const [chatInput, setChatInput] = useState("");
  const editor = useEditorStore();

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
    const ctx = getDocumentContext();
    // Selektion: im echten Editor via window.getSelection(); hier Placeholder
    const selection = (window.getSelection()?.toString() ?? "").slice(0, 4000);
    const res = await runKIAction(
      DEFAULT_SETTINGS,
      { action, selection, context: ctx, style, chatMessage: chatInput },
      (t) => setStreaming((s) => s + t),
    );
    setOutput(res.text);
    setStreaming("");
    setOffline(res.offline);
    setBusy(false);
    setChatInput("");
  }

  return (
    <aside className="ki-panel">
      <h3>KI-Assistent</h3>

      {offline && <span className="offline-badge">Offline-Modus</span>}

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
        <input
          placeholder="Freie Frage an die KI…"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run("chat")}
        />
      </div>

      <WhisperButton
        chapterId={useProjectStore.getState().activeChapterId}
        onResult={(text) => setChatInput((v) => (v ? v + "\n" + text : text))}
      />

      <div className="ki-output">
        {streaming && <pre className="streaming">{streaming}</pre>}
        {output && <p>{output}</p>}
      </div>

      {output && !busy && (
        <button className="ki-insert" onClick={insertIntoDoc}>
          In Dokument einfügen
        </button>
      )}
    </aside>
  );
}
