// TemplatePanel: Text-Vorlagen + Generator (Sprint 20, Agent 5).
//
// Standalone-Panel — bewusst KEINE Abhaengigkeit zu anderen Panels.
// Liste mit Kategorie-Filter, Template-Editor (Name, Kategorie, Prompt,
// Variablen), Variable-Eingabefelder, Generieren-Button (LLM mit
// gerendertem Prompt) und Ergebnis-Anzeige.
//
// Der LLM-Call laeuft ueber die injizierbare `generate`-Funktion
// (Mock in Tests, Default: `completeOnce` mit den App-Settings).
// Bloomberg-Terminal-Stil: bg #000, accent #ffa028, border #333,
// monospace (IBM Plex Mono).

import { useEffect, useState } from "react";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  renderTemplate,
  templateCategoryLabel,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type TemplateVariable,
  type TextTemplate,
} from "@/services/templates/templateManager";
import { completeOnce } from "@/services/llm";
import { loadSettings } from "@/services/settings";

export interface TemplatePanelProps {
  /** Injizierbare Generate-Funktion (Mock in Tests, Default: echter LLM-Call). */
  generate?: (prompt: string) => Promise<string>;
  className?: string;
}

type CategoryFilter = "all" | TemplateCategory;

const ACCENT = "#ffa028";

const panelStyle: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  fontSize: 12,
};

const boxStyle: React.CSSProperties = {
  border: "1px solid #333",
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  color: "#e8e8e8",
  border: "1px solid #333",
  fontFamily: "inherit",
  fontSize: 12,
  padding: "4px 6px",
  width: "100%",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  background: "#000",
  color: ACCENT,
  border: `1px solid ${ACCENT}`,
  fontFamily: "inherit",
  fontSize: 12,
  padding: "4px 10px",
  cursor: "pointer",
};

async function defaultGenerate(prompt: string): Promise<string> {
  const settings = loadSettings();
  return completeOnce(settings, prompt);
}

const EMPTY_VAR: TemplateVariable = {
  name: "",
  label: "",
  type: "text",
  defaultValue: "",
};

export function TemplatePanel({ generate, className }: TemplatePanelProps) {
  const doGenerate = generate ?? defaultGenerate;
  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor-State für neues Template
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("blog");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [vars, setVars] = useState<TemplateVariable[]>([]);

  const refresh = async () => {
    setTemplates(await getTemplates());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const visible = filter === "all" ? templates : templates.filter((t) => t.category === filter);

  const select = (t: TextTemplate) => {
    setSelectedId(t.id);
    setEditing(false);
    setResult(null);
    setError(null);
    const initial: Record<string, string> = {};
    for (const v of t.variables) initial[v.name] = v.defaultValue;
    setValues(initial);
  };

  const startCreate = () => {
    setEditing(true);
    setSelectedId(null);
    setResult(null);
    setError(null);
    setName("");
    setCategory("blog");
    setDescription("");
    setPrompt("");
    setVars([]);
  };

  const saveNew = async () => {
    if (!name.trim() || !prompt.trim()) {
      setError("Name und Prompt sind Pflichtfelder.");
      return;
    }
    const created = await createTemplate({
      name: name.trim(),
      category,
      description: description.trim(),
      prompt,
      variables: vars.filter((v) => v.name.trim() !== ""),
    });
    await refresh();
    select(created);
  };

  const removeSelected = async () => {
    if (!selected) return;
    await deleteTemplate(selected.id);
    setSelectedId(null);
    setResult(null);
    await refresh();
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const rendered = await renderTemplate(selected.id, values);
      const out = await doGenerate(rendered);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className} style={panelStyle} data-testid="template-panel">
      <div style={{ color: ACCENT, fontWeight: "bold" }}>
        📝 TEXT-VORLAGEN + GENERATOR
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} role="group" aria-label="Kategorie-Filter">
        {(["all", ...TEMPLATE_CATEGORIES] as CategoryFilter[]).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            aria-pressed={filter === c}
            style={{
              ...buttonStyle,
              background: filter === c ? ACCENT : "#000",
              color: filter === c ? "#000" : ACCENT,
            }}
          >
            {c === "all" ? "Alle" : templateCategoryLabel(c)}
          </button>
        ))}
      </div>

      <div style={boxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: ACCENT }}>Vorlagen ({visible.length})</span>
          <button style={buttonStyle} onClick={startCreate}>
            + Neu
          </button>
        </div>
        {visible.length === 0 && <span style={{ color: "#888" }}>Keine Vorlagen in dieser Kategorie.</span>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {visible.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => select(t)}
                aria-pressed={selectedId === t.id}
                style={{
                  ...buttonStyle,
                  width: "100%",
                  textAlign: "left",
                  borderColor: selectedId === t.id ? ACCENT : "#333",
                  color: selectedId === t.id ? ACCENT : "#e8e8e8",
                }}
              >
                {t.name} [{templateCategoryLabel(t.category)}]
              </button>
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <div style={boxStyle} data-testid="template-editor">
          <span style={{ color: ACCENT }}>Neues Template</span>
          <label>
            Name
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} aria-label="Template-Name" />
          </label>
          <label>
            Kategorie
            <select
              style={inputStyle}
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              aria-label="Template-Kategorie"
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {templateCategoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Beschreibung
            <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Template-Beschreibung" />
          </label>
          <label>
            Prompt (mit {"{{variable}}"})
            <textarea
              style={{ ...inputStyle, minHeight: 80 }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Template-Prompt"
            />
          </label>
          <div>
            <span>Variablen ({vars.length})</span>
            {vars.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  style={inputStyle}
                  placeholder="name"
                  value={v.name}
                  aria-label={`Variable ${i + 1} Name`}
                  onChange={(e) =>
                    setVars((prev) => prev.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))
                  }
                />
                <input
                  style={inputStyle}
                  placeholder="Label"
                  value={v.label}
                  aria-label={`Variable ${i + 1} Label`}
                  onChange={(e) =>
                    setVars((prev) => prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))
                  }
                />
                <select
                  style={inputStyle}
                  value={v.type}
                  aria-label={`Variable ${i + 1} Typ`}
                  onChange={(e) =>
                    setVars((prev) =>
                      prev.map((p, j) => (j === i ? { ...p, type: e.target.value as TemplateVariable["type"] } : p)),
                    )
                  }
                >
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="select">select</option>
                </select>
                <input
                  style={inputStyle}
                  placeholder="Default"
                  value={v.defaultValue}
                  aria-label={`Variable ${i + 1} Standardwert`}
                  onChange={(e) =>
                    setVars((prev) =>
                      prev.map((p, j) => (j === i ? { ...p, defaultValue: e.target.value } : p)),
                    )
                  }
                />
              </div>
            ))}
            <button style={{ ...buttonStyle, marginTop: 4 }} onClick={() => setVars((prev) => [...prev, { ...EMPTY_VAR }])}>
              + Variable
            </button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ ...buttonStyle, background: ACCENT, color: "#000" }} onClick={() => void saveNew()}>
              Speichern
            </button>
            <button style={buttonStyle} onClick={() => setEditing(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {selected && !editing && (
        <div style={boxStyle} data-testid="template-detail">
          <span style={{ color: ACCENT }}>{selected.name}</span>
          {selected.description && <span style={{ color: "#888" }}>{selected.description}</span>}
          {selected.variables.map((v) => (
            <label key={v.name}>
              {v.label || v.name}
              {v.type === "select" ? (
                <select
                  style={inputStyle}
                  value={values[v.name] ?? ""}
                  aria-label={v.label || v.name}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                >
                  {(v.options ?? [v.defaultValue]).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={inputStyle}
                  type={v.type === "number" ? "number" : "text"}
                  value={values[v.name] ?? ""}
                  aria-label={v.label || v.name}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                />
              )}
            </label>
          ))}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              style={{ ...buttonStyle, background: ACCENT, color: "#000" }}
              onClick={() => void handleGenerate()}
              disabled={busy}
            >
              {busy ? "Generiert…" : "⚡ Generieren"}
            </button>
            <button style={buttonStyle} onClick={() => void removeSelected()}>
              Löschen
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ border: "1px solid #f44", color: "#f66", padding: 8 }} role="alert">
          {error}
        </div>
      )}

      {result !== null && (
        <div style={boxStyle} data-testid="template-result">
          <span style={{ color: ACCENT }}>Ergebnis</span>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{result}</pre>
        </div>
      )}
    </div>
  );
}
