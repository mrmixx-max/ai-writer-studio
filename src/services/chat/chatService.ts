// Chat Service (Sprint 29): Freies Chatten mit Ollama LLM.
// streaming + history + autoren-assistent.

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface SendMessageOptions {
  model?: string;
  systemPrompt?: string;
  stream?: boolean;
  temperature?: number;
}

const AUTHORS_SYSTEM_PROMPT = `Du bist ein erfahrener Literaturagent und Ghostwriter. Du hilfst Autoren bei:
- Handlungsideen und Plot-Entwicklung
- Charakterentwicklung und -tiefe
- Dialog-Schreibstil und -Rhythmus
- Weltbau und Recherche
- Kapitelstruktur und Pacing
- Schlusskorrektur und Stilistik

Antworte auf Deutsch, präzise und konstruktiv. Gib konkrete Beispiele. Stelle Rückfragen, wenn etwas unklar ist.`;

/**
 * Sendet eine Nachricht und gibt die Antwort zurück.
 */
export async function sendMessage(
  messages: ChatMessage[],
  content: string,
  options: SendMessageOptions = {},
): Promise<ChatMessage> {
  const { model = "llama3.2", systemPrompt = AUTHORS_SYSTEM_PROMPT, temperature = 0.8 } = options;

  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content },
  ];

  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        options: { temperature, num_predict: 1000 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

    const data = await response.json();
    const assistantContent = data.message?.content ?? "Keine Antwort erhalten.";

    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: assistantContent,
      timestamp: Date.now(),
    };
  } catch (e) {
    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: `⚠️ Ollama nicht erreichbar (localhost:11434).\n\nFehler: ${e instanceof Error ? e.message : String(e)}\n\nStarte Ollama mit dem gewählten Modell (${model}) oder nutze den Demo-Modus.`,
      timestamp: Date.now(),
    };
  }
}

/**
 * Streaming-Chat mit Callback.
 */
export async function sendMessageStreaming(
  messages: ChatMessage[],
  content: string,
  onChunk: (chunk: string) => void,
  options: SendMessageOptions = {},
): Promise<ChatMessage> {
  const { model = "llama3.2", systemPrompt = AUTHORS_SYSTEM_PROMPT, temperature = 0.8 } = options;

  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content },
  ];

  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: true,
        options: { temperature, num_predict: 1000 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Kein Response-Body");

    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            fullContent += json.message.content;
            onChunk(json.message.content);
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: fullContent,
      timestamp: Date.now(),
    };
  } catch (e) {
    const errorMsg = `⚠️ Ollama nicht erreichbar.\n\nFehler: ${e instanceof Error ? e.message : String(e)}`;
    onChunk(errorMsg);
    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: errorMsg,
      timestamp: Date.now(),
    };
  }
}

/**
 * Prüft ob Ollama läuft.
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
