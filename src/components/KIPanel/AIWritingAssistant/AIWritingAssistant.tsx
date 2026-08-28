// AI Writing Assistant — Panel mit 4 Werkzeugen:
// Auto-Complete, Style Transfer, Dialog-Generator, Writing-Prompts.
// Wird als eigener Abschnitt im KIPanel gerendert.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  debounce,
  fetchAutoComplete,
  type AutoCompleteSuggestion,
} from "@/services/aiwriting/autocomplete";
import {
  LITERARY_STYLES,
  transferStyle,
} from "@/services/aiwriting/styletransfer";
import {
  generateDialog,
  type DialogLine,
} from "@/services/aiwriting/dialoggen";
import {
  generateWritingPrompts,
  type WritingPrompt,
} from "@/services/aiwriting/writingprompts";
import { DEFAULT_SETTINGS } from "@/types/config";
import { getDocumentContext } from "@/services/ki/context";
import "./aiwriting.css";

type Tab = "autocomplete" | "style" | "dialog" | "prompts";

const TABS: { id: Tab; label: string }[] = [
  { id: "autocomplete", label: "Auto-Complete" },
  { id: "style", label: "Style Transfer" },
  { id: "dialog", label: "Dialoge" },
  { id: "prompts", label: "Impulse" },
];

const PROMPT_KINDS = ["frei", "szene", "konflikt", "figur", "ort", "öffnung"] as const;

export function AIWritingAssistant() {
  const [tab, setTab] = useState<Tab>("autocomplete");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editor = getDocumentContext();

  // ---- Auto-Complete ----
  const [acPrefix, setAcPrefix] = useState("");
  const [acSuggestions, setAcSuggestions] = useState<AutoCompleteSuggestion[]>([]);
  const acAbort = useRef<AbortController | null>(null);
  const acDebounced = useMemo(
    () =>
      debounce((prefix: string) => {
        acAbort.current?.abort();
        const ctrl = new AbortController();
        acAbort.current = ctrl;
        fetchAutoComplete(DEFAULT_SETTINGS, { prefix, signal: ctrl.signal })
          .then((s) => {
            if (!ctrl.signal.aborted) setAcSuggestions(s);
          })
          .catch(() => setAcSuggestions([]));
      }, 700),
    [],
  );
  useEffect(() => () => acDebounced.cancel(), [acDebounced]);
  useEffect(() => {
    if (tab === "autocomplete" && acPrefix.trim().length > 8) acDebounced(acPrefix);
  }, [acPrefix, tab, acDebounced]);

  // ---- Style Transfer ----
  const [stStyleId, setStStyleId] = useState(LITERARY_STYLES[0].id);
  const [stSource, setStSource] = useState("");
  const [stResult, setStResult] = useState("");
  const [stOffline, setStOffline] = useState(false);

  // ---- Dialog-Generator ----
  const [dgChars, setDgChars] = useState("ANNA: vollendet 40, geheime Trauer\nBENNO: ihr Bruder, verlegen, macht Witze, wenn ihm unwohl ist");
  const [dgSituation, setDgSituation] = useState("");
  const [dgGoal, setDgGoal] = useState("");
  const [dgSubtext, setDgSubtext] = useState(true);
  const [dgLines, setDgLines] = useState<DialogLine[]>([]);

  // ---- Writing-Prompts ----
  const [wpKind, setWpKind] = useState<(typeof PROMPT_KINDS)[number]>("frei");
  const [wpPrompts, setWpPrompts] = useState<WritingPrompt[]>([]);

  async function runStyleTransfer() {
    setBusy(true); setError(""); setStResult("");
    try {
      const res = await transferStyle(DEFAULT_SETTINGS, {
        text: stSource || editor,
        styleId: stStyleId,
      });
      setStResult(res.text);
      setStOffline(res.offline);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  async function runDialog() {
    setBusy(true); setError(""); setDgLines([]);
    try {
      const characters = dgChars
        .split(/\r?\n/)
        .map<{ name: string; description?: string } | null>((l) => {
          const m = l.match(/^([^:]+)(?::\s*(.*))?$/);
          return m ? { name: m[1].trim(), description: m[2]?.trim() } : null;
        })
        .filter((c): c is { name: string; description?: string } => !!c && !!c.name);
      if (characters.length < 2) {
        setError("Mindestens zwei Figuren nötig (eine pro Zeile: NAME: Beschreibung).");
        setBusy(false);
        return;
      }
      const res = await generateDialog(DEFAULT_SETTINGS, {
        characters,
        situation: dgSituation || editor.slice(-500) || "Eine Szene aus dem laufenden Kapitel.",
        goal: dgGoal || undefined,
        withSubtext: dgSubtext,
        lineCount: 8,
      });
      setDgLines(res.lines);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  const runPrompts = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const res = await generateWritingPrompts(DEFAULT_SETTINGS, {
        kind: wpKind,
        count: 5,
        context: editor.slice(-1200),
      });
      setWpPrompts(res);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }, [wpKind, editor]);

  // Erste Impulse beim ersten Öffnen des Tabs laden
  const promptsLoaded = useRef(false);
  useEffect(() => {
    if (tab === "prompts" && !promptsLoaded.current) {
      promptsLoaded.current = true;
      void runPrompts();
    }
  }, [tab, runPrompts]);

  function insertIntoEditor(text: string) {
    // Nutzt die Editor-Store-API, falls vorhanden; sonst Clipboard-freundlicher Fallback
    const w = window as unknown as { __aiWriterInsert?: (t: string) => void };
    if (typeof w.__aiWriterInsert === "function") w.__aiWriterInsert(text);
    else void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  return (
    <section className="aiwa" data-testid="ai-writing-assistant">
      <h3 className="aiwa__title">KI-Schreibassistent</h3>
      <div className="aiwa__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`aiwa__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="aiwa__error" role="alert">{error}</p>}

      {tab === "autocomplete" && (
        <div className="aiwa__body">
          <p className="aiwa__hint">Tippt ein paar Wörter in das Feld — der Assistent schlägt Fortsetzungen vor (Debounce 700 ms).</p>
          <textarea
            className="aiwa__input"
            rows={4}
            placeholder="Der Zug verspätete sich, und während sie noch wartete, …"
            value={acPrefix}
            onChange={(e) => setAcPrefix(e.target.value)}
          />
          <ul className="aiwa__suggestions">
            {acSuggestions.map((s, i) => (
              <li key={i} className="aiwa__suggestion">
                <button className="aiwa__insert" onClick={() => insertIntoEditor(s.text)} title="Einfügen">
                  {s.text}
                </button>
                <span className={`aiwa__kind aiwa__kind--${s.kind}`}>
                  {s.kind === "llm" ? "KI" : "lokal"}
                </span>
              </li>
            ))}
            {!acSuggestions.length && <li className="aiwa__hint">Noch keine Vorschläge.</li>}
          </ul>
        </div>
      )}

      {tab === "style" && (
        <div className="aiwa__body">
          <label className="aiwa__label">
            Zielstil
            <select value={stStyleId} onChange={(e) => setStStyleId(e.target.value)}>
              {LITERARY_STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <textarea
            className="aiwa__input"
            rows={5}
            placeholder="Zu übertragender Text (leer = markierter/aktueller Text)"
            value={stSource}
            onChange={(e) => setStSource(e.target.value)}
          />
          <button className="aiwa__action" disabled={busy} onClick={runStyleTransfer}>
            {busy ? "Übertrage…" : "Stil übertragen"}
          </button>
          {stResult && (
            <div className="aiwa__result">
              <pre className="aiwa__text">{stResult}</pre>
              <button className="aiwa__insert" onClick={() => insertIntoEditor(stResult)}>In Editor übernehmen</button>
              {stOffline && <span className="aiwa__kind aiwa__kind--offline">offline</span>}
            </div>
          )}
        </div>
      )}

      {tab === "dialog" && (
        <div className="aiwa__body">
          <label className="aiwa__label">
            Figuren (eine pro Zeile — NAME: Beschreibung)
            <textarea className="aiwa__input" rows={3} value={dgChars} onChange={(e) => setDgChars(e.target.value)} />
          </label>
          <label className="aiwa__label">
            Situation
            <textarea className="aiwa__input" rows={2} value={dgSituation} onChange={(e) => setDgSituation(e.target.value)} placeholder="Küche, früher Morgen, nach der Beerdigung" />
          </label>
          <label className="aiwa__label">
            Ziel der Szene
            <input className="aiwa__input" value={dgGoal} onChange={(e) => setDgGoal(e.target.value)} placeholder="Anna gibt ein Geheimnis preis — ohne es auszusprechen" />
          </label>
          <label className="aiwa__check">
            <input type="checkbox" checked={dgSubtext} onChange={(e) => setDgSubtext(e.target.checked)} />
            Untertext (gesagt ≠ gemeint)
          </label>
          <button className="aiwa__action" disabled={busy} onClick={runDialog}>
            {busy ? "Schreibe…" : "Dialog erzeugen"}
          </button>
          {dgLines.length > 0 && (
            <div className="aiwa__result">
              <ul className="aiwa__dialog">
                {dgLines.map((l, i) => (
                  <li key={i}>
                    <button className="aiwa__insert" onClick={() => insertIntoEditor(`${l.speaker}${l.stageDirection ? ` (${l.stageDirection})` : ""}: ${l.text}`)}>
                      <strong>{l.speaker}</strong>
                      {l.stageDirection && <em className="aiwa__stage"> ({l.stageDirection})</em>}
                      {": "}
                      {l.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "prompts" && (
        <div className="aiwa__body">
          <label className="aiwa__label">
            Art des Impulses
            <select value={wpKind} onChange={(e) => setWpKind(e.target.value as (typeof PROMPT_KINDS)[number])}>
              {PROMPT_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <button className="aiwa__action" disabled={busy} onClick={runPrompts}>
            {busy ? "Denke…" : "Neue Impulse"}
          </button>
          <ul className="aiwa__suggestions">
            {wpPrompts.map((p, i) => (
              <li key={i} className="aiwa__suggestion">
                <button className="aiwa__insert" onClick={() => insertIntoEditor(p.text)} title="Kopieren/Einfügen">
                  {p.text}
                </button>
                {p.offline && <span className="aiwa__kind aiwa__kind--offline">lokal</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

