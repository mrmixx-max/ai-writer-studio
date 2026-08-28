// Dialog: Übersicht der Tastaturkürzel (Shift+F1).
// Nutzt Fokus-Falle + Escape + Fokuswiederherstellung via useModalA11y.

import { useRef } from "react";
import { useI18n, type TranslationKey } from "./index";
import { useModalA11y } from "./a11y";

const ROWS: { keys: string; labelKey: TranslationKey }[] = [
  { keys: "Strg/Cmd + S", labelKey: "shortcuts.save" },
  { keys: "Alt + 1", labelKey: "shortcuts.focusSidebar" },
  { keys: "Alt + 2", labelKey: "shortcuts.focusEditor" },
  { keys: "Alt + 3", labelKey: "shortcuts.focusAI" },
  { keys: "Strg/Cmd + ,", labelKey: "shortcuts.settings" },
  { keys: "Strg/Cmd + Shift + F", labelKey: "shortcuts.focusMode" },
  { keys: "F1", labelKey: "shortcuts.about" },
  { keys: "Shift + F1", labelKey: "shortcuts.help" },
  { keys: "Escape", labelKey: "shortcuts.escape" },
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onClose);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        className="shortcuts-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="shortcuts-help-title">{t("shortcuts.title")}</h3>
        <table>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.keys}>
                <th scope="row">
                  <kbd>{row.keys}</kbd>
                </th>
                <td>{t(row.labelKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="settings-actions">
          <button onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
