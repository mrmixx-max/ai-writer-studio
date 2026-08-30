// Editor-Komponente: TipTap 2 Rich-Text mit Markdown-Shortcuts, Toolbar, Wortzähler.
// Erweitert um: CharacterTag, SceneMarker und ChapterOutline.
import { useEditor, EditorContent, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useCallback, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { tiptapToText, countWords, countChars } from "@/services/editor/count";
import {
  CommentMark,
  TcInsertMark,
  TcDeleteMark,
  TrackChangesExtension,
  CollaborationPanel,
} from "@/components/Collaboration";
import {
  CharacterTagExtension,
  SceneMarkerExtension,
  ChapterOutlineExtension,
  ChapterOutlinePanel,
  CharacterTooltip,
  type CharacterInfo,
} from "./extensions";
import "./editor.css";
import { GitPanel } from "./GitPanel";
import { ModelPicker } from "@/components/KIPanel/ModelPicker";
import { useActiveModel } from "@/components/KIPanel/useActiveModel";

interface EditorProps {
  /** Wird bei jeder Änderung (debounced via Autosave) aufgerufen. */
  onChange?: (json: string) => void;
  /** Initialer Inhalt (TipTap-JSON-String) beim Laden eines Kapitels. */
  initialContent?: string;
  focusMode?: boolean;
  /** Callback zum Abrufen von Charakter-Infos für den Tooltip. */
  getCharacterInfo?: (name: string) => CharacterInfo | null;
  /** Zeigt die Kapitel-Gliederung-Sidebar an. */
  showOutline?: boolean;
  /** Zeigt die Collaboration-Sidebar an (Kommentare, Änderungen, Vorschläge, Vergleich). */
  showCollaboration?: boolean;
  /** Zeigt die Git-Sidebar an (Status, Commit, Branches, Konflikte, Diff). */
  showGit?: boolean;
  /** Projektverzeichnis für die Git-Integration. */
  gitDir?: string | null;
}

export function Editor({ onChange, initialContent, focusMode, getCharacterInfo, showOutline, showCollaboration, showGit, gitDir }: EditorProps) {
  const setCounts = useEditorStore((s) => s.setCounts);
  const chapterId = useEditorStore((s) => s.chapterId);
  const insertTrigger = useEditorStore((s) => s.insertTrigger);
  const timerRef = useRef<number | null>(null);
  const countTimerRef = useRef<number | null>(null);
  const [editorInstance, setEditorInstance] = useState<TipTapEditor | null>(null);
  const [trackChangesEnabled, setTrackChangesEnabled] = useState(false);
  // Dezentes Modell-Badge in der Editor-Kopfzeile: aktives Modell, Klick öffnet
  // dasselbe ModelPicker-Popover wie im KI-Panel (keine Duplikation der Auswahl).
  const { settings, selectModel } = useActiveModel();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Schreib hier… (Markdown-Shortcuts aktiv: # für H1, ## für H2, - für Liste, > für Zitat, @CharakterName für Charakter-Tags)",
      }),
      // Custom Extensions
      CharacterTagExtension.configure({
        getCharacterInfo,
      }),
      SceneMarkerExtension,
      ChapterOutlineExtension,
      // Collaboration
      CommentMark,
      TcInsertMark,
      TcDeleteMark,
      TrackChangesExtension,
    ],
    content: initialContent ? safeParse(initialContent) : "",
    onUpdate: ({ editor }) => {
      // Autosave: 5 Sekunden nach letzter Änderung
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        onChange?.(JSON.stringify(editor.getJSON()));
      }, 5000);

      // Wortzählung entprellt (300ms) — verhindert Re-Render bei jedem Keystroke
      if (countTimerRef.current) window.clearTimeout(countTimerRef.current);
      countTimerRef.current = window.setTimeout(() => {
        const text = tiptapToText(editor.getJSON());
        setCounts(countWords(text), countChars(text));
      }, 300);
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        spellcheck: "true",
      },
    },
  });

  // Editor-Instanz für das Outline-Panel speichern
  useEffect(() => {
    if (editor) setEditorInstance(editor);
  }, [editor]);

  // KI-Panel: Text am Ende einfügen (lauscht auf insertTrigger)
  // Verarbeitet die Queue (Race-Fix: mehrere Inserts hintereinander)
  const pendingInserts = useEditorStore((s) => s.pendingInserts);
  const consumeInsert = useEditorStore((s) => s.consumeInsert);
  useEffect(() => {
    if (insertTrigger > 0 && editor && pendingInserts.length > 0) {
      // Verarbeitet alle Texte in der Reihenfolge der Einfügung
      for (const text of pendingInserts) {
        editor.chain().focus().insertContent(text).run();
      }
      onChange?.(JSON.stringify(editor.getJSON()));
      // Queue leeren
      for (const text of pendingInserts) {
        consumeInsert(text);
      }
    }
  }, [insertTrigger, pendingInserts, editor, consumeInsert, onChange]);

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
        <span className="toolbar-divider" />
        <button
          onClick={() => editor.chain().focus().detectCharacterTags().run()}
          title="Charakter-Tags erkennen (@Name)"
        >
          @Tag
        </button>
        <span className="editor-toolbar-spacer" />
        <button
          onClick={() => {
            const selection = window.getSelection();
            const text = selection?.toString() || "";
            if (text) navigator.clipboard.writeText(text);
          }}
          title="Markierten Text kopieren (Ctrl+C)"
        >
          📋
        </button>
        <button
          onClick={() => {
            const blob = new Blob([editor.getHTML()], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "dokument.html";
            a.click();
            URL.revokeObjectURL(url);
          }}
          title="Speichern als HTML"
        >
          💾
        </button>
        <button
          onClick={() => {
            const printWindow = window.open("", "_blank");
            if (printWindow) {
              printWindow.document.write(`<!DOCTYPE html><html><head><title>Drucken</title><style>body{font-family:serif;padding:2cm;line-height:1.6;} h1,h2,h3{margin-top:1em;} blockquote{border-left:3px solid #ccc;padding-left:1em;color:#555;}</style></head><body>${editor.getHTML()}</body></html>`);
              printWindow.document.close();
              printWindow.print();
            }
          }}
          title="Drucken"
        >
          🖨️
        </button>
        <ModelPicker settings={settings} onSelect={selectModel} variant="badge" />
      </div>
      <div className="editor-body">
        <EditorContent editor={editor} className="editor-content" />
        {showOutline && (
          <aside className="editor-outline-sidebar">
            <ChapterOutlinePanel editor={editorInstance} />
          </aside>
        )}
        {showCollaboration && chapterId && (
          <aside className="editor-collab-sidebar">
            <CollaborationPanel
              editor={editorInstance}
              chapterId={chapterId}
              trackChangesEnabled={trackChangesEnabled}
              onToggleTrackChanges={setTrackChangesEnabled}
            />
          </aside>
        )}
        {showGit && (
          <aside className="editor-git-sidebar">
            <GitPanel dir={gitDir ?? null} />
          </aside>
        )}
      </div>
      {/* Character Tooltip (global, über dem Editor) */}
      <CharacterTooltip editor={editorInstance} getCharacterInfo={getCharacterInfo} />
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
