// ChapterOutlinePanel: Sidebar-Panel mit Kapitel-Gliederung.
//
// Zeigt alle Überschriften (H1, H2, H3) als klickbare Liste.
// Klick auf einen Eintrag scrollt die Editor-Ansicht zur entsprechenden Position.

import { useState, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { OutlineItem } from "./ChapterOutlineExtension";

interface ChapterOutlinePanelProps {
  editor: Editor | null;
}

export function ChapterOutlinePanel({ editor }: ChapterOutlinePanelProps) {
  const [items, setItems] = useState<OutlineItem[]>([]);

  // Outline aus dem Editor lesen (polling-basiert für Kompatibilität)
  useEffect(() => {
    if (!editor) return;

    const updateOutline = () => {
      const { state } = editor;
      const items: OutlineItem[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          const level = node.attrs.level || 1;
          const text = node.textContent.trim();
          if (text) {
            items.push({ level, text, pos });
          }
        }
      });
      setItems(items);
    };

    updateOutline();
    editor.on("update", updateOutline);
    return () => {
      editor.off("update", updateOutline);
    };
  }, [editor]);

  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(pos).run();
      // Scroll into view
      const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
      if (dom) {
        dom.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [editor]
  );

  if (items.length === 0) {
    return (
      <div className="chapter-outline">
        <h3 className="chapter-outline__title">Kapitel-Gliederung</h3>
        <p className="chapter-outline__empty">
          Noch keine Überschriften. Verwende #, ## oder ### im Text.
        </p>
      </div>
    );
  }

  return (
    <div className="chapter-outline">
      <h3 className="chapter-outline__title">Kapitel-Gliederung</h3>
      <ul className="chapter-outline__list">
        {items.map((item, idx) => (
          <li
            key={`${item.pos}-${idx}`}
            className={`chapter-outline__item chapter-outline__item--level-${item.level}`}
            style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
            onClick={() => scrollToHeading(item.pos)}
            title={`Gehe zu: ${item.text}`}
          >
            <span className="chapter-outline__bullet">
              {item.level === 1 ? "●" : item.level === 2 ? "○" : "·"}
            </span>
            <span className="chapter-outline__text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
