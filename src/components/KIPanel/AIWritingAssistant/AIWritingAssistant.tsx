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
import { loadSettings } from "@/services/settings";
import { getDocumentContext } from "@/services/ki/context";
import { useI18n, type TranslationKey } from "@/i18n";
import "./aiwriting.css";

type Tab = "autocomplete" | "style" | "dialog" | "prompts";

const TABS: { id: Tab; key: TranslationKey }[] = [
  { id: "autocomplete", key: "aiwa.tab.autocomplete" },
  { id: "style", key: "aiwa.tab.style" },
  { id: "dialog", key: "aiwa.tab.dialog" },
  { id: "prompts", key: "aiwa.tab.prompts" },
];

const PROMPT_KINDS = ["frei", "szene", "konflikt", "figur", "ort", "öffnung"] as const;
type PromptKind = (typeof PROMPT_KINDS)[number];

const PROMPT_KIND_LABELS: Record<PromptKind, TranslationKey> = {
  frei: "aiwa.kind.frei",
  szene: "aiwa.kind.szene",
  konflikt: "aiwa.kind.konflikt",
  figur: "aiwa.kind.figur",
  ort: "aiwa.kind.ort",
  "öffnung": "aiwa.kind.oeffnung",
};

export function AIWritingAssistant() {
  const { t } = useI18n();
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
        fetchAutoComplete(loadSettings(), { prefix, signal: ctrl.signal })
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
  const [wpKind, setWpKind] = useState<PromptKind>("frei");
  const [wpPrompts, setWpPrompts] = useState<WritingPrompt[]>([]);

  async function runStyleTransfer() {
    setBusy(true); setError(""); setStResult("");
    try {
      const res = await transferStyle(loadSettings(), {
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
        setError(t("aiwa.needTwoChars"));
        setBusy(false);
        return;
      }
      const res = await generateDialog(loadSettings(), {
        characters,
        situation: dgSituation || editor.slice(-500) || t("aiwa.dialogFallback"),
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
      const res = await generateWritingPrompts(loadSettings(), {
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
      <h3 className="aiwa__title">{t("aiwa.title")}</h3>
      <div className="aiwa__tabs" role="tablist">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            className={`aiwa__tab${tab === tb.id ? " is-active" : ""}`}
            onClick={() => setTab(tb.id)}
          >
            {t(tb.key)}
          </button>
        ))}
      </div>

      {error && <p className="aiwa__error" role="alert">{error}</p>}

      {tab === "autocomplete" && (
        <div className="aiwa__body">
          <p className="aiwa__hint">{t("aiwa.acHint")}</p>
          <textarea
            className="aiwa__input"
            rows={4}
            placeholder={t("aiwa.acPh")}
            value={acPrefix}
            onChange={(e) => setAcPrefix(e.target.value)}
          />
          <ul className="aiwa__suggestions">
            {acSuggestions.map((s, i) => (
              <li key={i} className="aiwa__suggestion">
                <button className="aiwa__insert" onClick={() => insertIntoEditor(s.text)} title={t("aiwa.insertTitle")}>
                  {s.text}
                </button>
                <span className={`aiwa__kind aiwa__kind--${s.kind}`}>
                  {s.kind === "llm" ? t("aiwa.kindLlm") : t("aiwa.kindLocal")}
                </span>
              </li>
            ))}
            {!acSuggestions.length && <li className="aiwa__hint">{t("aiwa.noSuggestions")}</li>}
          </ul>
        </div>
      )}

      {tab === "style" && (
        <div className="aiwa__body">
          <label className="aiwa__label">
            {t("aiwa.targetStyle")}
            <select value={stStyleId} onChange={(e) => setStStyleId(e.target.value)}>
              {LITERARY_STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <textarea
            className="aiwa__input"
            rows={5}
            placeholder={t("aiwa.sourcePh")}
            value={stSource}
            onChange={(e) => setStSource(e.target.value)}
          />
          <button className="aiwa__action" disabled={busy} onClick={runStyleTransfer}>
            {busy ? t("aiwa.transferring") : t("aiwa.transfer")}
          </button>
          {stResult && (
            <div className="aiwa__result">
              <pre className="aiwa__text">{stResult}</pre>
              <button className="aiwa__insert" onClick={() => insertIntoEditor(stResult)}>{t("aiwa.applyToEditor")}</button>
              {stOffline && <span className="aiwa__kind aiwa__kind--offline">offline</span>}
            </div>
          )}
        </div>
      )}

      {tab === "dialog" && (
        <div className="aiwa__body">
          <label className="aiwa__label">
            {t("aiwa.charsLabel")}
            <textarea className="aiwa__input" rows={3} value={dgChars} onChange={(e) => setDgChars(e.target.value)} />
          </label>
          <label className="aiwa__label">
            {t("aiwa.situation")}
            <textarea className="aiwa__input" rows={2} value={dgSituation} onChange={(e) => setDgSituation(e.target.value)} placeholder={t("aiwa.situationPh")} />
          </label>
          <label className="aiwa__label">
            {t("aiwa.goal")}
            <input className="aiwa__input" value={dgGoal} onChange={(e) => setDgGoal(e.target.value)} placeholder={t("aiwa.goalPh")} />
          </label>
          <label className="aiwa__check">
            <input type="checkbox" checked={dgSubtext} onChange={(e) => setDgSubtext(e.target.checked)} />
            {t("aiwa.subtext")}
          </label>
          <button className="aiwa__action" disabled={busy} onClick={runDialog}>
            {busy ? t("aiwa.writing") : t("aiwa.genDialog")}
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
            {t("aiwa.kindLabel")}
            <select value={wpKind} onChange={(e) => setWpKind(e.target.value as PromptKind)}>
              {PROMPT_KINDS.map((k) => (
                <option key={k} value={k}>{t(PROMPT_KIND_LABELS[k])}</option>
              ))}
            </select>
          </label>
          <button className="aiwa__action" disabled={busy} onClick={runPrompts}>
            {busy ? t("aiwa.thinking") : t("aiwa.newImpulses")}
          </button>
          <ul className="aiwa__suggestions">
            {wpPrompts.map((p, i) => (
              <li key={i} className="aiwa__suggestion">
                <button className="aiwa__insert" onClick={() => insertIntoEditor(p.text)} title={t("aiwa.copyTitle")}>
                  {p.text}
                </button>
                {p.offline && <span className="aiwa__kind aiwa__kind--offline">{t("aiwa.kindLocal")}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

