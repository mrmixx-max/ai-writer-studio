// Statusbar mit live Wort-/Zeichenzähler + Dirty-Indikator.
import { useEditorStore } from "@/store/editorStore";

export function WordCountBar() {
  // Einzelne Selektoren statt `useEditorStore()` ohne Selektor: In Zustand v5
  // rendert ein selektorloser Aufruf bei JEDER Store-Änderung neu — auch beim
  // content-Update des Autosaves, das diese Leiste gar nicht betrifft.
  const wordCount = useEditorStore((s) => s.wordCount);
  const charCount = useEditorStore((s) => s.charCount);
  const dirty = useEditorStore((s) => s.dirty);
  return (
    <div className="wordcount-bar">
      <span>{wordCount} Wörter</span>
      <span>{charCount} Zeichen</span>
      {dirty ? <span className="dirty">● nicht gespeichert</span> : <span className="saved">✓ gespeichert</span>}
    </div>
  );
}
