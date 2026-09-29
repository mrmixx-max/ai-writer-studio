// BookWriterPanel UI Components - Configuration and Form sections

import { useI18n } from "@/i18n";
import { listStyles } from "@/services/bookwriter/prompts/library";
import type { BookWriterState, BookWriterActions, ViewMode } from "./types";

const STYLE_PRESETS = listStyles();

export interface ConfigFormProps {
  state: BookWriterState;
  actions: BookWriterActions;
}

export function ConfigForm({ state, actions }: ConfigFormProps) {
  const { t } = useI18n();

  // Fallback for strict i18n keys
  const tFlex = (key: string, fallback: string) => {
    try {
      return t(key as any) || fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div className="bw-config">
      <h3>{tFlex("bookwriter.config.title", "Konfiguration")}</h3>

      <div className="bw-row">
        <label>
          {tFlex("bookwriter.config.topic", "Thema")}
          <input
            type="text"
            value={state.topic}
            onChange={(e) => actions.setTopic(e.target.value)}
            placeholder={tFlex("bookwriter.config.topicPlaceholder", "Worum geht es in deinem Buch?")}
          />
        </label>
      </div>

      <div className="bw-row">
        <label>
          {tFlex("bookwriter.config.genre", "Genre")}
          <select value={state.genre} onChange={(e) => actions.setGenre(e.target.value)}>
            <option value="Sachbuch">Sachbuch</option>
            <option value="Roman">Roman</option>
            <option value="Kurzgeschichte">Kurzgeschichte</option>
            <option value="Ratgeber">Ratgeber</option>
            <option value="Biografie">Biografie</option>
            <option value="Kinderbuch">Kinderbuch</option>
            <option value="Fachbuch">Fachbuch</option>
          </select>
        </label>

        <label>
          {tFlex("bookwriter.config.targetAudience", "Zielgruppe")}
          <input
            type="text"
            value={state.targetAudience}
            onChange={(e) => actions.setTargetAudience(e.target.value)}
            placeholder={tFlex("bookwriter.config.targetAudiencePlaceholder", "z. B. Einsteiger, Fortgeschrittene")}
          />
        </label>
      </div>

      <div className="bw-row">
        <label>
          {tFlex("bookwriter.config.chapterCount", "Kapitel-Anzahl")}
          <input
            type="number"
            min="1"
            max="50"
            value={state.chapterCount}
            onChange={(e) => actions.setChapterCount(Number(e.target.value))}
          />
        </label>

        <label>
          {tFlex("bookwriter.config.wordsPerChapter", "Wörter pro Kapitel")}
          <input
            type="number"
            min="100"
            max="10000"
            step="100"
            value={state.wordsPerChapter}
            onChange={(e) => actions.setWordsPerChapter(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="bw-row">
        <label>
          {tFlex("bookwriter.config.polish", "Nachbearbeitung")}
          <input
            type="checkbox"
            checked={state.polish}
            onChange={(e) => actions.setPolish(e.target.checked)}
          />
        </label>

        <label>
          {tFlex("bookwriter.config.tone", "Stil")}
          <select value={state.tone} onChange={(e) => actions.setTone(e.target.value)}>
            <option value="">{tFlex("bookwriter.config.toneDefault", "Standard")}</option>
            {STYLE_PRESETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bw-row">
        <label>
          {tFlex("bookwriter.config.viewMode", "Ansicht")}
          <select value={state.viewMode} onChange={(e) => actions.setViewMode(e.target.value as ViewMode)}>
            <option value="classic">{tFlex("bookwriter.config.viewClassic", "Klassisch")}</option>
            <option value="planner">{tFlex("bookwriter.config.viewPlanner", "Planer")}</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export interface PremiseConceptFormProps {
  state: BookWriterState;
  actions: BookWriterActions;
}

export function PremiseConceptForm({ state, actions }: PremiseConceptFormProps) {
  const { t } = useI18n();

  // Fallback for strict i18n keys
  const tFlex = (key: string, fallback: string) => {
    try {
      return t(key as any) || fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div className="bw-premise">
      <h3>{tFlex("bookwriter.premise", "Prämisse")}</h3>

      <textarea
        value={state.premise}
        onChange={(e) => actions.setPremise(e.target.value)}
        placeholder={tFlex("bookwriter.premisePh", "Was ist die Kernidee?")}
        rows={4}
      />

      <div className="bw-buttons">
        <button
          onClick={() => actions.setIsSuggestingConcept(true)}
          disabled={!state.topic.trim() || state.isSuggestingConcept}
        >
          {state.isSuggestingConcept
            ? (tFlex("bookwriter.conceptSuggestBusy", "Wird erstellt..."))
            : (tFlex("bookwriter.conceptSuggest", "Konzept vorschlagen"))}
        </button>
      </div>

      {state.concept && (
        <div className="bw-concept">
          <h4>{tFlex("bookwriter.concept", "Konzept")}</h4>
          <p>{state.concept}</p>
          <button onClick={() => actions.setConcept("")}>{tFlex("bookwriter.concept.discard", "Verwerfen")}</button>
        </div>
      )}
    </div>
  );
}

export interface OutlineDisplayProps {
  outline: { title: string; chapters: Array<{ number: number; title: string; summary: string }> } | null;
  chapters: Array<{ number: number; title: string; content: string; status: string }>;
  currentChapter: number;
  onChapterClick: (num: number) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function OutlineDisplay({ outline, chapters, currentChapter, onChapterClick, onRegenerate, isRegenerating }: OutlineDisplayProps) {
  const { t } = useI18n();

  // Fallback for strict i18n keys
  const tFlex = (key: string, fallback: string) => {
    try {
      return t(key as any) || fallback;
    } catch {
      return fallback;
    }
  };

  if (!outline) return null;

  return (
    <div className="bw-outline">
      <div className="bw-outline-header">
        <h3>{outline.title}</h3>
        <button onClick={onRegenerate} disabled={isRegenerating}>
          {isRegenerating ? tFlex("bookwriter.regeneratingOutline", "Gliederung wird neu erstellt...") : tFlex("bookwriter.regenerateOutline", "🔄 Gliederung neu generieren")}
        </button>
      </div>

      <ul className="bw-chapter-list">
        {outline.chapters.map((ch) => {
          const chapter = chapters.find((c) => c.number === ch.number);
          const status = chapter?.status || "planned";
          const isActive = ch.number === currentChapter;

          return (
            <li
              key={ch.number}
              className={`bw-chapter-item ${status} ${isActive ? "active" : ""}`}
              onClick={() => onChapterClick(ch.number)}
            >
              <span className="bw-chapter-num">Kap. {ch.number}</span>
              <span className="bw-chapter-title">{ch.title}</span>
              <span className={`bw-status-badge bw-status-${status}`}>{status}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}