// IdeasPanel: Plot-Twists, Konflikte, Settings generieren.
import { useState } from "react";
import { generateIdeas, generateRandomPrompt, type IdeaSeed } from "@/services/writing/ideas";

export function IdeasPanel() {
  const [ideas, setIdeas] = useState<IdeaSeed[]>([]);
  const [prompt, setPrompt] = useState(generateRandomPrompt());

  const handleGenerate = (type: "plot" | "conflict" | "setting" | "flaw") => {
    setIdeas(generateIdeas(type, 5));
  };

  return (
    <div className="plugin-panel ideas-panel">
      <h3>💡 Ideen-Generator</h3>

      <div className="idea-prompt">
        <p>{prompt}</p>
        <button onClick={() => setPrompt(generateRandomPrompt())} className="idea-refresh">🔄 Neuer Prompt</button>
      </div>

      <div className="idea-buttons">
        <button onClick={() => handleGenerate("plot")}>🎭 Plot-Twists</button>
        <button onClick={() => handleGenerate("conflict")}>⚔️ Konflikte</button>
        <button onClick={() => handleGenerate("setting")}>🗺️ Settings</button>
        <button onClick={() => handleGenerate("flaw")}>💔 Charakter-Fehler</button>
      </div>

      {ideas.length > 0 && (
        <div className="idea-list">
          {ideas.map((idea) => (
            <div key={idea.id} className="idea-card">
              <strong>{idea.title}</strong>
              <p>{idea.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
