// Dialog mit dem Text: Kapitel antwortet aus verschiedenen Rollen.
import { useState } from "react";
import { saveDialogue, listDialogues } from "@/services/dialogue";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";

const ROLES = [
  { id: "narrator", label: "Erzähler", prompt: "Antworte als Erzähler des Textes." },
  { id: "critic", label: "Kritiker", prompt: "Antwecke als literarischer Kritiker." },
  { id: "character", label: "Figur", prompt: "Antwecke als eine Figur aus dem Text." },
  { id: "opponent", label: "Gegner", prompt: "Antwecke als Gegner des Autors." },
  { id: "reader", label: "Leser", prompt: "Antwecke als künftiger Leser." },
];

export function DialoguePanel({ chapterId, text }: { chapterId: string; text: string }) {
  const [role, setRole] = useState(ROLES[0]);
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(listDialogues(chapterId));

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    setOutput("");
    const res = await runKIAction(
      DEFAULT_SETTINGS,
      {
        action: "chat",
        selection: text,
        context: `${role.prompt}\n\nNutzerkommentar: ${message}`,
      },
      (t) => setOutput((o) => o + t),
    );
    await saveDialogue(chapterId, role.label, message, res.text);
    setHistory(listDialogues(chapterId));
    setBusy(false);
    setMessage("");
  }

  return (
    <div className="dialogue-panel">
      <div className="dialogue-roles">
        {ROLES.map((r) => (
          <button key={r.id} onClick={() => setRole(r)} className={role.id === r.id ? "active" : ""}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="dialogue-history">
        {history.map((h) => (
          <div key={h.id} className="dialogue-item">
            <strong>{h.role}:</strong> {h.message}
            <p>{h.response}</p>
          </div>
        ))}
      </div>
      <div className="dialogue-input">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Frage an ${role.label}…`} rows={2} />
        <button onClick={send} disabled={busy || !message.trim()}>Senden</button>
      </div>
      {output && <div className="dialogue-output">{output}</div>}
    </div>
  );
}
