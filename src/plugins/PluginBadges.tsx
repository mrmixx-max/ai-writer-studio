// PluginBadges: rendert die von Plugins registrierten Badges.
//
// Wird neben der WordCountBar in der Editor-Spalte eingebunden und
// erhält den aktuellen Wort-/Zeichenstand aus dem EditorStore.

import { useEditorStore } from "@/store/editorStore";
import { pluginManager } from "./PluginManager";
import { usePlugins } from "./PluginProvider";

export function PluginBadges() {
  usePlugins(); // Re-Render, wenn Plugins installiert/aktiviert werden
  const wordCount = useEditorStore((s) => s.wordCount);
  const charCount = useEditorStore((s) => s.charCount);
  const badges = pluginManager.getBadges();

  if (badges.length === 0) return null;

  return (
    <div className="plugin-badges">
      {badges.map(({ id, component: Badge }) => (
        <Badge key={id} wordCount={wordCount} charCount={charCount} />
      ))}
    </div>
  );
}
