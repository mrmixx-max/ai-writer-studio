// Sprint 24, Agent 4: PromptLibraryPanel (NEUE Datei).
//
// Prompt-Bibliothek: Liste + Kategorie-Filter + Suchfeld + Prompt-Karten
// (Name, Beschreibung, Tags, Favorit-Stern) + Verwenden/Neu/Loeschen.
// Bloomberg-Terminal-Stil per Inline-Styles (kein neues CSS-Asset).
// "Verwenden" zaehlt die Nutzung und reicht den Prompttext per onUse
// weiter (Default: in den KI-Panel-Store als Streaming-Text).
import { useEffect, useMemo, useState } from "react";
import {
  addPrompt,
  deletePrompt,
  getPrompts,
  incrementUsage,
  toggleFavorite,
  PROMPT_CATEGORIES,
  type LibraryPrompt,
  type NewLibraryPrompt,
  type PromptCategory,
} from "@/services/prompts/promptLibrary";
import { usePromptStore } from "@/store/promptStore";

export interface PromptLibraryPanelProps {
  onUse?: (promptText: string, prompt: LibraryPrompt) => void;
}

const TERM: React.CSSProperties = {
  background: "#0a0e14",
  color: "#ffb000",
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #2a3340",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minHeight: 0,
};

const INPUT: React.CSSProperties = {
  background: "#10151d",
  color: "#ffb000",
  border: "1px solid #2a3340",
  borderRadius: 4,
  padding: "6px 8px",
  fontFamily: "inherit",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const BTN: React.CSSProperties = {
  background: "#131a24",
  color: "#ffb000",
  border: "1px solid #ffb000",
  borderRadius: 4,
  padding: "4px 10px",
  fontFamily: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const CARD: React.CSSProperties = {
  background: "#10151d",
  border: "1px solid #2a3340",
  borderRadius: 6,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  writing: "Schreiben",
  editing: "Lektorat",
  research: "Recherche",
  marketing: "Marketing",
  business: "Business",
  creative: "Kreativ",
};

type CategoryFilter = "all" | "favorites" | PromptCategory;

export function PromptLibraryPanel({ onUse }: PromptLibraryPanelProps) {
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<PromptCategory>("writing");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");

  const refresh = async () => {
    setPrompts(await getPrompts());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (category === "favorites" && !p.favorite) return false;
      if (category !== "all" && category !== "favorites" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [prompts, query, category]);

  const handleSearch = (value: string) => {
    // Clientseitiger Filter (sichtbares Memo) — inkl. Tags und Prompttext.
    setQuery(value);
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await deletePrompt(id);
    await refresh();
  };

  const handleUse = async (p: LibraryPrompt) => {
    await incrementUsage(p.id);
    await refresh();
    if (onUse) {
      onUse(p.prompt, p);
    } else {
      const store = usePromptStore.getState();
      store.set("streamingText", p.prompt);
      store.set("tab", "generate");
    }
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formPrompt.trim()) return;
    const draft: NewLibraryPrompt = {
      name: formName.trim(),
      category: formCategory,
      description: formDescription.trim() || formName.trim(),
      prompt: formPrompt,
      variables: [],
      tags: [],
      favorite: false,
    };
    await addPrompt(draft);
    setFormName("");
    setFormDescription("");
    setFormPrompt("");
    setShowForm(false);
    await refresh();
  };

  return (
    <div style={TERM} data-testid="prompt-library-panel">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span aria-hidden="true">💡</span>
        <strong data-testid="prompt-library-title">Prompt-Bibliothek</strong>
        <span data-testid="prompt-library-count" style={{ color: "#5fff87" }}>
          {visible.length}/{prompts.length}
        </span>
        <span style={{ flex: 1 }} />
        <button style={BTN} data-testid="prompt-library-new" onClick={() => setShowForm((s) => !s)}>
          + Neu
        </button>
      </div>

      <input
        style={INPUT}
        data-testid="prompt-library-search"
        type="search"
        placeholder="Prompts suchen …"
        aria-label="Prompts suchen"
        value={query}
        onChange={(e) => void handleSearch(e.target.value)}
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Kategorie-Filter">
        {(["all", "favorites", ...PROMPT_CATEGORIES] as CategoryFilter[]).map((c) => (
          <button
            key={c}
            data-testid={`prompt-library-filter-${c}`}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            style={{
              ...BTN,
              background: category === c ? "#ffb000" : "#131a24",
              color: category === c ? "#0a0e14" : "#ffb000",
            }}
          >
            {c === "all" ? "Alle" : c === "favorites" ? "★ Favoriten" : CATEGORY_LABEL[c as PromptCategory]}
          </button>
        ))}
      </div>

      <select
        style={INPUT}
        data-testid="prompt-library-category"
        aria-label="Kategorie wählen"
        value={category}
        onChange={(e) => setCategory(e.target.value as CategoryFilter)}
      >
        <option value="all">Alle Kategorien</option>
        <option value="favorites">★ Favoriten</option>
        {PROMPT_CATEGORIES.map((c) => (
          <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
        ))}
      </select>

      {showForm && (
        <div style={{ ...CARD, borderColor: "#ffb000" }} data-testid="prompt-library-form">
          <input
            style={INPUT}
            data-testid="prompt-library-form-name"
            placeholder="Name …"
            aria-label="Name des neuen Prompts"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <select
            style={INPUT}
            data-testid="prompt-library-form-category"
            aria-label="Kategorie des neuen Prompts"
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value as PromptCategory)}
          >
            {PROMPT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <input
            style={INPUT}
            data-testid="prompt-library-form-description"
            placeholder="Beschreibung …"
            aria-label="Beschreibung des neuen Prompts"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
          <textarea
            style={{ ...INPUT, minHeight: 70 }}
            data-testid="prompt-library-form-prompt"
            placeholder="Prompttext …"
            aria-label="Prompttext des neuen Prompts"
            value={formPrompt}
            onChange={(e) => setFormPrompt(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button style={BTN} data-testid="prompt-library-submit" onClick={() => void handleCreate()}>
              Speichern
            </button>
            <button
              style={{ ...BTN, borderColor: "#2a3340", color: "#8b98a9" }}
              data-testid="prompt-library-cancel"
              onClick={() => setShowForm(false)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}
        data-testid="prompt-library-list"
      >
        {visible.length === 0 && (
          <div data-testid="prompt-library-empty" style={{ color: "#8b98a9" }}>
            Keine Prompts gefunden.
          </div>
        )}
        {visible.map((p) => (
          <article key={p.id} style={CARD} data-testid={`prompt-library-card-${p.id}`}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <strong data-testid={`prompt-library-name-${p.id}`}>{p.name}</strong>
              <span style={{ flex: 1 }} />
              <button
                style={{ ...BTN, borderColor: p.favorite ? "#ffb000" : "#2a3340" }}
                data-testid={`prompt-library-fav-${p.id}`}
                aria-label={p.favorite ? `${p.name} aus Favoriten entfernen` : `${p.name} zu Favoriten hinzufügen`}
                aria-pressed={p.favorite}
                onClick={() => void handleToggleFavorite(p.id)}
              >
                {p.favorite ? "★" : "☆"}
              </button>
            </div>
            <div style={{ color: "#c9d4e3" }} data-testid={`prompt-library-desc-${p.id}`}>
              {p.description}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} data-testid={`prompt-library-tags-${p.id}`}>
              <span
                style={{ fontSize: 11, color: "#0a0e14", background: "#ffb000", borderRadius: 3, padding: "1px 6px" }}
              >
                {CATEGORY_LABEL[p.category] ?? p.category}
              </span>
              {p.tags.map((t) => (
                <span key={t} style={{ fontSize: 11, color: "#8b98a9", border: "1px solid #2a3340", borderRadius: 3, padding: "1px 6px" }}>
                  #{t}
                </span>
              ))}
              {p.usageCount > 0 && (
                <span style={{ fontSize: 11, color: "#5fff87" }} data-testid={`prompt-library-usage-${p.id}`}>
                  {p.usageCount}× verwendet
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={BTN} data-testid={`prompt-library-use-${p.id}`} onClick={() => void handleUse(p)}>
                ▶ Verwenden
              </button>
              <button
                style={{ ...BTN, borderColor: "#2a3340", color: "#ff5555" }}
                data-testid={`prompt-library-del-${p.id}`}
                aria-label={`${p.name} löschen`}
                onClick={() => void handleDelete(p.id)}
              >
                Löschen
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
