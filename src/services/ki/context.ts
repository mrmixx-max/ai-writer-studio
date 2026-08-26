// Hook/Helper: liefert Dokument-Kontext (letzte ~2000 Zeichen) für KI-Aktionen.
import { useEditorStore } from "@/store/editorStore";
import { tiptapToText } from "@/services/editor/count";

/** Letzte ~2000 Zeichen des aktuellen Dokuments als Kontext. */
export function getDocumentContext(): string {
  const content = useEditorStore.getState().content;
  const text = tiptapToText(content);
  return text.length > 2000 ? text.slice(-2000) : text;
}
