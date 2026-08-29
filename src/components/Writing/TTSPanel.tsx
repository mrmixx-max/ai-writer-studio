// TTS-Panel: Text-to-Speech via Web Speech API (kein Download, kein Modell).
import { useState, useRef, useEffect } from "react";

interface Props {
  text?: string;
}

export function TTSPanel({ text: externalText }: Props) {
  const [text, setText] = useState(externalText || "");
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      // Deutsche Stimme bevorzugt
      const de = available.find(v => v.lang.startsWith("de"));
      if (de) setSelectedVoice(de.name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    if (externalText) setText(externalText);
  }, [externalText]);

  function speak() {
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utter.voice = voice;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function pause() {
    window.speechSynthesis.pause();
  }

  function resume() {
    window.speechSynthesis.resume();
  }

  const deVoices = voices.filter(v => v.lang.startsWith("de"));
  const otherVoices = voices.filter(v => !v.lang.startsWith("de"));

  return (
    <div className="tts-panel">
      <h3>🔊 Vorlesen</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text zum Vorlesen…"
        rows={6}
      />
      <div className="tts-controls">
        {!speaking ? (
          <button onClick={speak} disabled={!text.trim()}>
            ▶️ Vorlesen
          </button>
        ) : (
          <>
            <button onClick={pause}>⏸ Pause</button>
            <button onClick={resume}>▶️ Weiter</button>
            <button onClick={stop}>⏹ Stop</button>
          </>
        )}
      </div>
      <label>Stimme
        <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
          {deVoices.length > 0 && <optgroup label="Deutsch">
            {deVoices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
          </optgroup>}
          {otherVoices.length > 0 && <optgroup label="Andere">
            {otherVoices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
          </optgroup>}
        </select>
      </label>
      <label>Geschwindigkeit: {rate.toFixed(1)}
        <input type="range" min={0.5} max={2} step={0.1} value={rate}
          onChange={(e) => setRate(+e.target.value)} />
      </label>
      <label>Tonhöhe: {pitch.toFixed(1)}
        <input type="range" min={0} max={2} step={0.1} value={pitch}
          onChange={(e) => setPitch(+e.target.value)} />
      </label>
    </div>
  );
}
