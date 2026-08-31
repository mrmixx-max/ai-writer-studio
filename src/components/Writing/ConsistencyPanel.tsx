// ConsistencyPanel: Einfache Konsistenz-Checks.
import { useState } from "react";

export interface ConsistencyIssue {
  type: "contradiction" | "missing" | "inconsistent";
  text: string;
  detail: string;
}

export function ConsistencyPanel() {
  const [text, setText] = useState("");
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);

  const handleCheck = () => {
    const found: ConsistencyIssue[] = [];
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);

    // Einfache Checks: Widersprüche mit "aber/jedoch/trotzdem"
    for (const s of sentences) {
      const lower = s.toLowerCase();
      if (lower.includes("immer") || lower.includes("nie")) {
        const opposite = lower.includes("immer") ? "nie" : "immer";
        if (sentences.some((o) => o !== s && o.toLowerCase().includes(opposite) && o.toLowerCase().includes(lower.split(" ")[0]))) {
          const word = lower.includes("immer") ? "immer" : "nie"; found.push({ type: "contradiction", text: s.trim(), detail: "Widerspruch: " + word + " vs Gegenteil" });
        }
      }
    }

    // Namen finden und prüfen ob sie konsistent sind
    const nameRegex = /[A-ZÄÖÜ][a-zäöüß]{2,}/g;
    const names = new Set<string>();
    const nameMatches = text.match(nameRegex) || [];
    for (const n of nameMatches) {
      if (["Der", "Die", "Das", "Ein", "Eine", "Und", "Aber", "Wenn", "Dass", "Weil"].includes(n)) continue;
      names.add(n);
    }

    if (names.size > 20) {
      found.push({ type: "missing", text: `${names.size} verschiedene Namen gefunden`, detail: "Vielleicht zu viele für eine Geschichte. Sind alle nötig?" });
    }

    setIssues(found);
  };

  return (
    <div className="plugin-panel consistency-panel">
      <h3>✅ Konsistenz-Check</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text hier einfügen..."
        className="ws-input"
      />
      <button onClick={handleCheck} className="ws-btn">Prüfen</button>

      {issues.length > 0 && (
        <div className="consistency-issues">
          {issues.map((issue, i) => (
            <div key={i} className={`issue issue-${issue.type}`}>
              <strong>{issue.type === "contradiction" ? "⚠️ Widerspruch" : "💡 Hinweis"}</strong>
              <p>{issue.detail}</p>
              <small>{issue.text}</small>
            </div>
          ))}
        </div>
      )}
      {issues.length === 0 && text.length > 0 && <p className="consistency-ok">✅ Keine offensichtlichen Probleme gefunden.</p>}
    </div>
  );
}
