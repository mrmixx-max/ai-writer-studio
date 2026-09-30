import { memo } from "react";
import { useI18n } from "@/i18n";
import type { EditorMode } from "@/types/mode";
import { MODES } from "../modeRegistry";
import type { ModeEntry } from "../types";

interface ModeSwitcherProps {
  mode: EditorMode;
  modesCollapsed: boolean;
  onModeChange: (mode: EditorMode) => void;
  onToggleCollapsed: () => void;
}

/**
 * ModeSwitcher — rendert den kollabierbaren Modus-Schalter.
 * Extrahiert aus Sidebar.tsx für bessere Testbarkeit und Wiederverwendbarkeit.
 */
export const ModeSwitcher = memo(function ModeSwitcher({
  mode,
  modesCollapsed,
  onModeChange,
  onToggleCollapsed,
}: ModeSwitcherProps) {
  const { t } = useI18n();

  return (
    <section className="sb-modes">
      <button
        className="sb-section-toggle"
        aria-expanded={!modesCollapsed}
        onClick={onToggleCollapsed}
      >
        <span aria-hidden="true">{modesCollapsed ? "▸" : "▾"}</span> MODES
      </button>
      {!modesCollapsed && (
        <nav className="mode-switcher" aria-label={t("sidebar.modesLabel")}>
          {MODES.map((m: ModeEntry) => {
            const label = t(m.key);
            return (
              <button
                key={m.id}
                title={label}
                aria-label={`${label} – ${t(m.descKey)}`}
                aria-pressed={mode === m.id}
                data-mode={m.id}
                className={mode === m.id ? "active" : ""}
                onClick={() => onModeChange(m.id)}
              >
                <span aria-hidden="true">{m.icon}</span>
                <span className="sb-label">{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </section>
  );
});