// EditorQuickActions (WP 40.1): Kontextuelle Schwebe-Leiste über der Textauswahl.
//
// Erscheint bei Markierungen > 3 Wörtern und bietet 1-Klick-Aktionen, die
// direkt die lokalen Werkzeuge aus dem Werkzeuge-Panel nutzen (kein LLM):
//   ⚡ Stil & Sinne · 🎭 Dialog-Check · 🎬 Roman → Drehbuch
//
// Ergebnis-Handling: Übernehmen (fügt Anmerkung ein), Anheften (Randkommentar),
// Verwerfen.
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useCallback, useState } from "react";
import {
  calculateCognitiveLoad,
  calculateReadingTime,
} from "@/services/analytics/cognitiveAttention";
import { classifySenseChannels } from "@/services/linguistics/synesthesiaMatrix";
import { detectExpositionDump, detectSubtextMarkers } from "@/services/dramaturgy/dialogueSubtext";
import { proseToScreenplay } from "@/services/screenplay/screenplayTransmuter";
import { analyzeStyleFingerprint, findOverusedPhrases } from "@/services/analytics/styleFingerprint";
import { getLogger } from "@/services/logger";

const log = getLogger("editor/quickActionsBubble");

const BG = "#0d1117";
const BORDER = "#30363d";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";
const GREEN = "#00e676";

export type BubbleActionId = "style" | "dialogue" | "screenplay";

export interface EditorQuickActionsProps {
  editor: Editor | null;
  /** Wird beim Anheften als Randkommentar gerufen. */
  onPinComment?: (text: string) => void;
}

/** Führt eine Schwebe-Leisten-Aktion auf dem Text aus. */
export function runBubbleAction(action: BubbleActionId, text: string): string {
  switch (action) {
    case "style": {
      const fp = analyzeStyleFingerprint(text);
      const senses = classifySenseChannels(text);
      const load = calculateCognitiveLoad(text);
      const time = calculateReadingTime(text, "standard");
      const over = findOverusedPhrases(text, 5);
      const sensoryGap = senses.olfactory + senses.gustatory + senses.tactile === 0;
      return [
        `Stil-Check (${text.split(/\s+/).filter(Boolean).length} Wörter)`,
        `  Kognitive Belastung: ${load.index}/100 (${load.level})`,
        `  Ø Satzlänge: ${fp.avgSentenceLength.toFixed(1)} · Burstiness ${fp.burstiness.toFixed(2)}`,
        `  Lesezeit: ${Math.round(time.seconds)}s`,
        "",
        "5-Sinne-Balance:",
        `  👁 ${senses.visual} · 👂 ${senses.auditory} · 👃 ${senses.olfactory} · 👅 ${senses.gustatory} · ✋ ${senses.tactile}`,
        sensoryGap ? "  ⚠ Keine Geruchs-, Geschmacks- oder Tast-Eindrücke!" : "",
        over.length > 0
          ? `\nWiederholungen: ${over.map((o) => `${o.phrase} (${o.count}×)`).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "dialogue": {
      const dumps = detectExpositionDump(text);
      const tags = text.match(/\*[^*]+\*/g) ?? [];
      const markers = detectSubtextMarkers(text, tags);
      const verbs =
        text.match(/\b(sagte|fragte|antwortete|rief|murmelte|flüsterte|schrie|meinte|erwiderte)\b/gi) ?? [];
      return [
        `Dialog-Check (${text.split(/\s+/).filter(Boolean).length} Wörter)`,
        `  Sprechverben: ${verbs.length}${verbs.length > 4 ? " ⚠ viele Inquit-Formeln" : ""}`,
        "",
        dumps.length > 0
          ? `Expositions-Dumps (${dumps.length}):\n${dumps.map((d) => `  ⚠ "${d.phrase}" — ${d.reason}`).join("\n")}`
          : "  ✓ Keine Infodumps",
        "",
        markers.length > 0
          ? `Subtext-Marker (${markers.length}):\n${markers.map((m) => `  "${m.statement}" vs. ${m.actionTag}`).join("\n")}`
          : "  Hinweis: Handlungs-Tags (*...*) für Subtext-Analyse nötig.",
      ].join("\n");
    }

    case "screenplay": {
      const doc = proseToScreenplay(text);
      const scenes = doc.scenes ?? [];
      return [
        `Drehbuch-Wandlung: ${scenes.length} Szene(n)`,
        "",
        ...scenes.slice(0, 4).map((s) => {
          const lines = [`${s.slugline}`];
          for (const a of s.action.slice(0, 3)) lines.push(`  ${a}`);
          for (const d of s.dialogue.slice(0, 3)) {
            lines.push(`  ${d.character.toUpperCase()}`);
            if (d.parenthetical) lines.push(`    (${d.parenthetical})`);
            for (const l of d.lines.slice(0, 2)) lines.push(`    ${l}`);
          }
          return lines.join("\n");
        }),
      ].join("\n");
    }

    default:
      return "";
  }
}

const ACTIONS: { id: BubbleActionId; label: string; title: string }[] = [
  { id: "style", label: "⚡ Stil & Sinne", title: "Passive Verben, Füllwörter, 5-Sinne-Balance" },
  { id: "dialogue", label: "🎭 Dialog-Check", title: "Sprechverben, Infodumps, Subtext" },
  { id: "screenplay", label: "🎬 Roman → Drehbuch", title: "Markierte Szene in Drehbuch umwandeln" },
];

export function EditorQuickActions({ editor, onPinComment }: EditorQuickActionsProps) {
  const [result, setResult] = useState<string>("");
  const [activeAction, setActiveAction] = useState<BubbleActionId | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAction = useCallback(
    (action: BubbleActionId) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, "\n\n");
      if (!text.trim()) return;
      setBusy(true);
      try {
        setResult(runBubbleAction(action, text));
        setActiveAction(action);
      } catch (err) {
        log.error("Schwebe-Leisten-Aktion fehlgeschlagen", err);
        setResult(`✗ Fehler: ${err instanceof Error ? err.message : String(err)}`);
        setActiveAction(action);
      } finally {
        setBusy(false);
      }
    },
    [editor],
  );

  const handleApply = useCallback(() => {
    if (!editor || !result) return;
    const { to } = editor.state.selection;
    const block = `\n\n[ANMERKUNG]\n${result}\n[/ANMERKUNG]`;
    editor.chain().focus().insertContentAt(to, block).run();
    setResult("");
    setActiveAction(null);
  }, [editor, result]);

  const handlePin = useCallback(() => {
    if (!result) return;
    onPinComment?.(result);
    setResult("");
    setActiveAction(null);
  }, [onPinComment, result]);

  const handleDiscard = useCallback(() => {
    setResult("");
    setActiveAction(null);
  }, []);

  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state }) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        const text = state.doc.textBetween(from, to, " ");
        // Erst ab > 3 Wörtern (WP-Anforderung)
        return text.trim().split(/\s+/).filter(Boolean).length > 3;
      }}
      options={{ placement: "top" }}
    >
      <div
        data-testid="editor-quick-actions"
        style={{
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          padding: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          maxWidth: 520,
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              data-testid={`bubble-action-${a.id}`}
              title={a.title}
              onClick={() => handleAction(a.id)}
              disabled={busy}
              style={{
                background: activeAction === a.id ? "#1f6feb33" : "transparent",
                color: activeAction === a.id ? CYAN : TEXT,
                border: `1px solid ${activeAction === a.id ? CYAN : BORDER}`,
                borderRadius: 4,
                padding: "4px 9px",
                fontSize: 11,
                cursor: busy ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {result && (
          <div style={{ marginTop: 6, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
            <pre
              data-testid="bubble-result"
              style={{
                color: GREEN,
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                whiteSpace: "pre-wrap",
                maxHeight: 220,
                overflow: "auto",
                margin: 0,
                maxWidth: 500,
              }}
            >
              {result}
            </pre>
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <button
                data-testid="bubble-apply"
                onClick={handleApply}
                style={{
                  background: AMBER,
                  color: BG,
                  border: "none",
                  borderRadius: 4,
                  padding: "4px 9px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓ Als Korrektur übernehmen
              </button>
              <button
                data-testid="bubble-pin"
                onClick={handlePin}
                style={{
                  background: "transparent",
                  color: CYAN,
                  border: `1px solid ${CYAN}`,
                  borderRadius: 4,
                  padding: "4px 9px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                📌 Als Randkommentar
              </button>
              <button
                data-testid="bubble-discard"
                onClick={handleDiscard}
                style={{
                  background: "transparent",
                  color: DIM,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: "4px 9px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                ✗ Verwerfen
              </button>
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
