// Statusbar mit live Wort-/Zeichenzähler + Dirty-Indikator.
import { useEditorStore } from "@/store/editorStore";

export function WordCountBar() {
  const { wordCount, charCount, dirty } = useEditorStore();
  return (
    <div className="wordcount-bar">
      <span>{wordCount} Wörter</span>
      <span>{charCount} Zeichen</span>
      {dirty ? <span className="dirty">● nicht gespeichert</span> : <span className="saved">✓ gespeichert</span>}
    </div>
  );
}
