// Traumlogik-Generator: assoziatives Schreiben mit Reglern.
import { useState } from "react";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";

export function DreamLogicPanel({ text }: { text: string }) {
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [coherence, setCoherence] = useState(0.5);
  const [strangeness, setStrangeness] = useState(0.5);
  const [symbolism, setSymbolism] = useState(0.5);
  const [darkness, setDarkness] = useState(0.3);

  async function run(mode: string) {
    if (!text.trim()) return;
    setBusy(true);
    setOutput("");
    await runKIAction(
      DEFAULT_SETTINGS,
      {
        action: "umschreiben",
        selection: text,
        context: `Modus: ${mode}
Regler:
- Kohärenz: ${coherence} (0=fragmentiert, 1=logisch)
- Fremdheit: ${strangeness} (0=realistisch, 1=surreal)
- Symbolik: ${symbolism} (0=wörtlich, 1=dicht symbolisch)
- Düsternis: ${darkness} (0=hell, 1=dunkel/unheimlich)

Wandle den Text entsprechend um. Nur den umgewandelten Text ausgeben.`,
      },
      (t) => setOutput((o) => o + t),
    );
    setBusy(false);
  }

  return (
    <div className="dream-panel">
      <h4>Traumlogik-Generator</h4>
      <label>Kohärenz: {coherence}
        <input type="range" min={0} max={1} step={0.1} value={coherence} onChange={(e) => setCoherence(+e.target.value)} />
      </label>
      <label>Fremdheit: {strangeness}
        <input type="range" min={0} max={1} step={0.1} value={strangeness} onChange={(e) => setStrangeness(+e.target.value)} />
      </label>
      <label>Symbolik: {symbolism}
        <input type="range" min={0} max={1} step={0.1} value={symbolism} onChange={(e) => setSymbolism(+e.target.value)} />
      </label>
      <label>Düsternis: {darkness}
        <input type="range" min={0} max={1} step={0.1} value={darkness} onChange={(e) => setDarkness(+e.target.value)} />
      </label>
      <div className="dream-actions">
        <button onClick={() => run("traumhaft")} disabled={busy}>Traumhaft</button>
        <button onClick={() => run("Realität kippen")} disabled={busy}>Realität kippen</button>
        <button onClick={() => run("Halluzinationslogik")} disabled={busy}>Halluzination</button>
      </div>
      {output && <div className="dream-output">{output}</div>}
    </div>
  );
}
