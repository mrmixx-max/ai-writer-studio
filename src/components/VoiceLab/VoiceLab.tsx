// Stimmen-Labor: Stilprofile + Übersetzung + Split-View + Voice-Lab-Features.
import { useState } from "react";
import { createVoice, listVoices } from "@/services/voice";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";
import type { Chapter } from "@/types/project";
import { AudioWaveformPlayer } from "./AudioWaveformPlayer";
import { BatchTTS } from "./BatchTTS";
import { TranscriptEditor } from "./TranscriptEditor";
import { AudioNotes } from "./AudioNotes";

const PRESET_VOICES = [
  { name: "nüchtern", prompt: "Schreibe den Text nüchtern, sachlich, ohne Emotion." },
  { name: "expressionistisch", prompt: "Schreibe den Text expressionistisch, verzerrt, mit Gewalt der Empfindung." },
  { name: "essayistisch", prompt: "Schreibe den Text essayistisch, denkend, mit Einschüben und Gedankensprüngen." },
  { name: "protokollarisch", prompt: "Schreibe den Text protokollarisch, wie ein Verhör- oder Beobachtungsprotokoll." },
  { name: "paranoisch", prompt: "Schreibe den Text paranoisch, mit Beziehungensehschaft und Systemen hinter allem." },
  { name: "poetisch", prompt: "Schreibe den Text poetisch, mit Rhythmus, Bildern, Verdichtung." },
  { name: "sachlich-juristisch", prompt: "Schreibe den Text juristisch, mit Konditionalsätzen und Haftungsausschlüssen." },
];

type VoiceLabTab = "voices" | "player" | "readaloud" | "transcripts" | "notes";

export function VoiceLab({
  text,
  chapters = [],
  chapterId = null,
}: {
  text: string;
  chapters?: Chapter[];
  chapterId?: string | null;
}) {
  const [voices, setVoices] = useState(listVoices());
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [splitMode, setSplitMode] = useState<"translate" | "collide" | "contrast">("translate");
  const [tab, setTab] = useState<VoiceLabTab>("voices");

  const selected = voices.find((v) => v.id === voiceId);

  async function addPreset(p: typeof PRESET_VOICES[0]) {
    await createVoice(p.name, "", p.prompt);
    setVoices(listVoices());
  }

  async function addCustom() {
    const name = window.prompt("Stimme-Name:");
    if (!name) return;
    const prompt = window.prompt("Prompt-Template:");
    if (!prompt) return;
    await createVoice(name, "", prompt);
    setVoices(listVoices());
  }

  async function run() {
    if (!selected) return;
    setBusy(true);
    setOutput("");
    let userPrompt: string;
    if (splitMode === "translate") {
      userPrompt = `${selected.promptTemplate}\n\nORIGINAL:\n${text}\n\nÜBERSETZT:`;
    } else if (splitMode === "collide") {
      userPrompt = `Kollidiere diesen Text mit der Stimme "${selected.promptTemplate}". Erzeuge eine Mischung beider.\n\nORIGINAL:\n${text}`;
    } else {
      userPrompt = `Erzeuge eine Kontrastversion: dieselbe Situation, aber in der Stimme "${selected.promptTemplate}".\n\nORIGINAL:\n${text}`;
    }
    await runKIAction(DEFAULT_SETTINGS, { action: "umschreiben", selection: text, context: userPrompt }, (t) => setOutput((o) => o + t));
    setBusy(false);
  }

  return (
    <div className="voice-lab">
      <div className="voice-lab-tabs" role="tablist">
        <button role="tab" onClick={() => setTab("voices")} className={tab === "voices" ? "active" : ""}>Stimmen</button>
        <button role="tab" onClick={() => setTab("player")} className={tab === "player" ? "active" : ""}>Player</button>
        <button role="tab" onClick={() => setTab("readaloud")} className={tab === "readaloud" ? "active" : ""}>Buch vorlesen</button>
        <button role="tab" onClick={() => setTab("transcripts")} className={tab === "transcripts" ? "active" : ""}>Transkripte</button>
        <button role="tab" onClick={() => setTab("notes")} className={tab === "notes" ? "active" : ""}>Memos</button>
      </div>

      {tab === "player" && (
        <div className="voice-lab-panel">
          <AudioWaveformPlayer src={null} label="Audio abspielen (Waveform)" />
        </div>
      )}
      {tab === "readaloud" && (
        <div className="voice-lab-panel">
          <BatchTTS chapters={chapters} />
        </div>
      )}
      {tab === "transcripts" && (
        <div className="voice-lab-panel">
          <TranscriptEditor chapterId={chapterId} />
        </div>
      )}
      {tab === "notes" && (
        <div className="voice-lab-panel">
          {chapterId ? (
            <AudioNotes chapterId={chapterId} />
          ) : (
            <p>(Kein Kapitel geöffnet — Memos sind kapitelgebunden.)</p>
          )}
        </div>
      )}

      {tab === "voices" && (<>
      <div className="voice-toolbar">
        <button onClick={() => setSplitMode("translate")} className={splitMode === "translate" ? "active" : ""}>Übersetzen</button>
        <button onClick={() => setSplitMode("collide")} className={splitMode === "collide" ? "active" : ""}>Kollidieren</button>
        <button onClick={() => setSplitMode("contrast")} className={splitMode === "contrast" ? "active" : ""}>Kontrast</button>
        <button onClick={addCustom}>+ Eigene Stimme</button>
      </div>

      <div className="voice-list">
        {PRESET_VOICES.map((p) => (
          <button key={p.name} onClick={() => addPreset(p)} title={p.prompt}>+ {p.name}</button>
        ))}
      </div>

      <select value={voiceId ?? ""} onChange={(e) => setVoiceId(e.target.value || null)}>
        <option value="">Eigene Stimme wählen…</option>
        {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.isFavorite ? " ★" : ""}</option>)}
      </select>

      <button onClick={run} disabled={!selected || busy || !text}>
        {selected ? `In "${selected.name}" übersetzen` : "Stimme wählen"}
      </button>

      <div className="voice-split">
        <div className="original">
          <h4>Original</h4>
          <pre>{text || "(kein Text ausgewählt)"}</pre>
        </div>
        <div className="translated">
          <h4>Variante</h4>
          <pre>{output || "(noch keine Variante)"}</pre>
        </div>
      </div>
      </>)}
    </div>
  );
}
