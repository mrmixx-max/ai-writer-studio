// CharacterTooltip: Tooltip-Komponente für Charakter-Tags.
//
// Zeigt beim Hover über einen @CharakterName-Tooltip mit Infos.
// Wird über den ProseMirror-Decorations gesteuert.

import { useState, useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { CharacterInfo } from "./CharacterTagExtension";

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  info: CharacterInfo | null;
}

interface CharacterTooltipProps {
  editor: Editor | null;
  getCharacterInfo?: (name: string) => CharacterInfo | null;
}

export function CharacterTooltip({ editor, getCharacterInfo }: CharacterTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: "",
    info: null,
  });
  const timeoutRef = useRef<number | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("character-tag")) {
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const name = target.getAttribute("data-character-name") || "";
      const info = getCharacterInfo?.(name) ?? null;

      // Positioniere Tooltip über dem Element
      const rect = target.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        name,
        info,
      });
    },
    [getCharacterInfo]
  );

  useEffect(() => {
    const container = editor?.view.dom;
    if (!container) return;

    container.addEventListener("mousemove", handleMouseMove);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [editor, handleMouseMove]);

  if (!tooltip.visible) return null;

  return (
    <div
      className="character-tooltip"
      style={{
        position: "fixed",
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, -100%)",
        zIndex: 1000,
      }}
    >
      <div className="character-tooltip__name">{tooltip.name}</div>
      {tooltip.info && (
        <div className="character-tooltip__details">
          {tooltip.info.role && (
            <div className="character-tooltip__row">
              <span className="character-tooltip__label">Rolle:</span>
              <span>{tooltip.info.role}</span>
            </div>
          )}
          {tooltip.info.age && (
            <div className="character-tooltip__row">
              <span className="character-tooltip__label">Alter:</span>
              <span>{tooltip.info.age}</span>
            </div>
          )}
          {tooltip.info.traits && (
            <div className="character-tooltip__row">
              <span className="character-tooltip__label">Merkmale:</span>
              <span>{tooltip.info.traits}</span>
            </div>
          )}
        </div>
      )}
      <div className="character-tooltip__arrow" />
    </div>
  );
}
