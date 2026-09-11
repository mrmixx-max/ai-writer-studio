// AppDialog (Sprint 32): In-App-Ersatz fuer window.prompt/window.confirm.
// Tauri-WebView2 implementiert KEINE nativen Dialoge (prompt→null,
// confirm→false) — jede Aktion dahinter war in der installierten App tot
// (Projekt anlegen, Umbenennen, Löschen). Bloomberg-Stil.
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";

export type DialogRequest =
  | { kind: "prompt"; label: string; initial: string; resolve: (v: string | null) => void }
  | { kind: "confirm"; message: string; resolve: (v: boolean) => void };

const OVERLAY: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 900,
};

const BOX: React.CSSProperties = {
  background: "#11161f",
  border: "1px solid #ffa028",
  color: "#d5dbe5",
  fontFamily: "'IBM Plex Mono', monospace",
  padding: "16px 18px",
  minWidth: 300,
  maxWidth: 420,
};

const BTN: React.CSSProperties = {
  padding: "6px 14px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  border: "none",
};

export function AppDialog({ request, onDone }: { request: DialogRequest | null; onDone: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (request?.kind === "prompt") setValue(request.initial);
    if (request) inputRef.current?.focus();
  }, [request]);

  if (!request) return null;

  const finish = (v: string | boolean | null) => {
    if (request.kind === "prompt") (request.resolve as (v: string | null) => void)(v as string | null);
    else (request.resolve as (v: boolean) => void)(v as boolean);
    onDone();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = value.trim();
      finish(request.kind === "prompt" ? (v ? v : null) : true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(request.kind === "prompt" ? null : false);
    }
  };

  return (
    <div style={OVERLAY} onClick={() => finish(request.kind === "prompt" ? null : false)}>
      <div style={BOX} onClick={(e) => e.stopPropagation()} onKeyDown={onKey} role="dialog" aria-modal="true">
        <div style={{ fontSize: 13, marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {request.kind === "prompt" ? request.label : request.message}
        </div>
        {request.kind === "prompt" && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px",
              background: "#0a0e14",
              border: "1px solid #232b3a",
              color: "#d5dbe5",
              fontSize: 13,
              fontFamily: "inherit",
              marginBottom: 12,
            }}
          />
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            style={{ ...BTN, background: "#232b3a", color: "#d5dbe5" }}
            onClick={() => finish(request.kind === "prompt" ? null : false)}
          >
            {t("common.cancel")}
          </button>
          <button
            style={{ ...BTN, background: "#ffa028", color: "#000" }}
            onClick={() => {
              if (request.kind === "prompt") {
                const v = value.trim();
                finish(v ? v : null);
              } else finish(true);
            }}
          >
            {t("dialog.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
