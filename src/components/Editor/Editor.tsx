// Editor-Komponente: TipTap 2 Rich-Text mit Markdown-Shortcuts, Toolbar, Wortzähler.
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { tiptapToText, countWords, countChars } from "@/services/editor/count";
import "./editor.css";

interface EditorProps {
  /** Wird bei jeder Änderung (debounced via Autosave) aufgerufen. */
  onChange?: (json: string) => void;
  /** Initialer Inhalt (TipTap-JSON-String) beim Laden eines Kapitels. */
  initialContent?: string;
  focusMode?: boolean;
}

export function Editor({ onChange, initialContent, focusMode }: EditorProps) {
  const setCounts = useEditorStore((s) => s.setCounts);
  const timerRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Schreib hier… (Markdown-Shortcuts aktiv: # für H1, ## für H2, - für Liste, > für Zitat)",
      }),
    ],
    content: initialContent ? safeParse(initialContent) : "",
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const text = tiptapToText(editor.getJSON());
      setCounts(countWords(text), countChars(text));
      // Autosave: 5 Sekunden nach letzter Änderung
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        onChange?.(json);
      }, 5000);
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        spellcheck: "true",
      },
    },
  });

  // Initiale Zählung
  useEffect(() => {
    if (editor) {
      const text = tiptapToText(editor.getJSON());
      setCounts(countWords(text), countChars(text));
    }
    // bewusst nur [editor]: initiale Zählung soll einmalig nach Mount laufen
  }, [editor]);

  // Fokusmodus umschalten
  useEffect(() => {
    const el = document.querySelector(".editor-shell");
    if (el) el.classList.toggle("focus-mode", !!focusMode);
  }, [focusMode]);

  const stopAutosave = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Sofort speichern wenn Komponente unmountet (verhindert Datenverlust)
  useEffect(() => {
    return () => {
      stopAutosave();
      if (editor) onChange?.(JSON.stringify(editor.getJSON()));
    };
    // bewusst nur [editor]: cleanup soll aktuellen Editor-Inhalt sichern
  }, [editor]);

  if (!editor) return <div className="editor-shell">Lade Editor…</div>;

  return (
    <div className="editor-shell">
      <div className="editor-toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "active" : ""}>
          <b>B</b>
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "active" : ""}>
          <i>I</i>
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive("heading", { level: 1 }) ? "active" : ""}>
          H1
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive("heading", { level: 2 }) ? "active" : ""}>
          H2
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive("heading", { level: 3 }) ? "active" : ""}>
          H3
        </button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "active" : ""}>
          • Liste
        </button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive("orderedList") ? "active" : ""}>
          1. Liste
        </button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive("blockquote") ? "active" : ""}>
          ❝ Zitat
        </button>
      </div>
      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return "";
  }
}
