// ChatPanel (Sprint 29): Freies Chatten mit Ollama LLM.
// Senden-Button rechts oben im Header.
import { useState, useCallback, useRef, useEffect } from "react";
import {
  sendMessageStreaming,
  isOllamaAvailable,
  type ChatMessage,
} from "@/services/chat/chatService";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isOllamaAvailable().then(setOllamaAvailable);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    if (!input.trim() || busy) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, assistantMsg]);

    try {
      await sendMessageStreaming(
        messages,
        userMsg.content,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + chunk }
                : m,
            ),
          );
        },
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Fehler: ${e instanceof Error ? e.message : String(e)}` }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "'IBM Plex Mono', monospace",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header mit Senden-Button rechts oben */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ color: AMBER, fontWeight: 700, fontSize: 14 }}>
          💬 CHAT
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: DIM, fontSize: 10 }}>
            {ollamaAvailable ? "🟢 Online" : "🔴 Offline"}
          </div>
          <button
            onClick={send}
            disabled={busy}
            style={{
              padding: "6px 14px",
              background: busy ? DIM : AMBER,
              color: "#000",
              border: "none",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            {busy ? "⏳" : "📤 SENDEN"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: DIM, textAlign: "center", marginTop: 40 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
            <div>Stelle eine Frage zum Schreiben...</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              z.B. "Schreibe einen Dialog zwischen zwei Charakteren"
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 12,
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "8px 12px",
                background: msg.role === "user" ? AMBER : PANEL,
                color: msg.role === "user" ? "#000" : TEXT,
                border: `1px solid ${msg.role === "user" ? AMBER : BORDER}`,
                fontSize: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content || "..."}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht eingeben... (Enter zum Senden)"
          rows={2}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: PANEL,
            border: `1px solid ${BORDER}`,
            color: TEXT,
            fontSize: 12,
            fontFamily: "inherit",
            resize: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
