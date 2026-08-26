// Schreib-Obstruktionen: absichtlich restriktiver Modus für kreative Reibung.
import { useState } from "react";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";

interface Rule {
  id: string;
  label: string;
  prompt: string;
  check: (text: string) => boolean;
}

const RULES: Rule[] = [
  { id: "no_adj", label: "keine Adjektive", prompt: "Keine Adjektive verwenden.", check: (t) => !/\b\w+(?:ig|lich|isch|bar)\b/i.test(t) },
  { id: "no_ich", label: "keine Ich-Perspektive", prompt: "Nicht aus Ich-Perspektive schreiben.", check: (t) => !/\b(ich|mein|mir)\b/i.test(t) },
  { id: "short", label: "nur kurze Sätze", prompt: "Nur Sätze unter 10 Wörtern.", check: (t) => t.split(/[.!?]+/).every((s) => s.trim().split(/\s+/).length <= 10) },
  { id: "questions", label: "nur Fragen", prompt: "Nur Fragen.", check: (t) => t.split(/[.!?]+/).every((s) => s.trim().endsWith("?")) },
  { id: "max9", label: "max. 9 Wörter/Satz", prompt: "Maximal 9 Wörter pro Satz.", check: (t) => t.split(/[.!?]+/).every((s) => s.trim().split(/\s+/).length <= 9) },
  { id: "concrete", label: "nur konkrete Substantive", prompt: "Keine abstrakten Begriffe (Liebe, Freiheit, Gerechtigkeit etc.).", check: (t) => !/\b(Liebe|Freiheit|Gerechtigkeit|Schönheit|Wahrheit|Frieden)\b/i.test(t) },
];

const PRESETS = [
  { name: "Oulipo", rules: ["no_adj", "short", "max9"] },
  { name: "Protokoll", rules: ["no_ich", "concrete"] },
  { name: "Verhör", rules: ["questions", "max9"] },
  { name: "Traumjournal", rules: ["short", "concrete"] },
  { name: "Kalte Akte", rules: ["no_adj", "no_ich", "concrete"] },
  { name: "Philosophische Miniatur", rules: ["max9", "short"] },
];

export function ObstructionPanel({ text }: { text: string }) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleRule(id: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function loadPreset(p: typeof PRESETS[0]) {
    setActive(new Set(p.rules));
  }

  function checkText() {
    const violations: string[] = [];
    RULES.filter((r) => active.has(r.id)).forEach((r) => {
      if (!r.check(text)) violations.push(r.label);
    });
    return violations;
  }

  async function rewriteUnderConstraints() {
    if (active.size === 0) return;
    setBusy(true);
    const rules = RULES.filter((r) => active.has(r.id)).map((r) => r.prompt).join(" ");
    await runKIAction(
      DEFAULT_SETTINGS,
      {
        action: "umschreiben",
        selection: text,
        context: `Schreibe diesen Text um unter diesen Regeln: ${rules}\n\nGib nur den umgeschriebenen Text.`,
      },
      (t) => setOutput((o) => o + t),
    );
    setBusy(false);
  }

  const violations = checkText();

  return (
    <div className="obstruction-panel">
      <div className="obstruction-presets">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => loadPreset(p)}>{p.name}</button>
        ))}
      </div>
      <div className="obstruction-rules">
        {RULES.map((r) => (
          <button key={r.id} onClick={() => toggleRule(r.id)} className={active.has(r.id) ? "active" : ""}>
            {r.label}
          </button>
        ))}
      </div>
      {active.size > 0 && (
        <div className="obstruction-check">
          {violations.length === 0 ? "✓ Alle Regeln erfüllt" : `✗ Verletzt: ${violations.join(", ")}`}
        </div>
      )}
      <button onClick={rewriteUnderConstraints} disabled={busy || active.size === 0 || !text}>
        Unter Restriktionen umschreiben
      </button>
      {output && <div className="obstruction-output">{output}</div>}
    </div>
  );
}
