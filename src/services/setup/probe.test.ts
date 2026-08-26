// Tests: Anbieterprüfung gegen echte lokale HTTP-Server und toten Port.
//
// Kein Mocking von fetch: Es wird ein echter Server gestartet, damit auch
// Antwortformate und Fehlerpfade tatsächlich durchlaufen werden.

import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { probeOllama, probeLmStudio, probeOpenAi } from "@/services/setup/probe";

let server: Server | null = null;

/** Startet einen Server, der auf jede Anfrage mit body antwortet. */
async function serve(status: number, body: unknown): Promise<number> {
  server = createServer((_req, res) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  const addr = server!.address();
  if (typeof addr === "object" && addr) return addr.port;
  throw new Error("Port nicht ermittelbar");
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((r) => server!.close(() => r()));
    server = null;
  }
});

// Garantiert geschlossener Port für die Offline-Fälle.
const DEAD = "http://127.0.0.1:9";

describe("Ollama-Prüfung", () => {
  it("erkennt geladene Modelle", async () => {
    const port = await serve(200, { models: [{ name: "llama3.2" }, { name: "mistral" }] });
    const r = await probeOllama(`http://127.0.0.1:${port}`);

    expect(r.reachable).toBe(true);
    expect(r.models).toEqual(["llama3.2", "mistral"]);
    expect(r.message).toContain("2 Modelle");
    expect(r.latencyMs).toBeTypeOf("number");
  });

  it("meldet laufenden Dienst ohne Modell mit Handlungsanweisung", async () => {
    const port = await serve(200, { models: [] });
    const r = await probeOllama(`http://127.0.0.1:${port}`);

    expect(r.reachable).toBe(true);
    expect(r.models).toHaveLength(0);
    // Der Nutzer muss erfahren, WAS er tun soll.
    expect(r.message).toContain("ollama pull");
  });

  it("bleibt bei totem Port ruhig und nennt den nächsten Schritt", async () => {
    const r = await probeOllama(DEAD);

    expect(r.reachable).toBe(false);
    expect(r.models).toHaveLength(0);
    expect(r.message).toContain("ollama serve");
    // Kein Alarmismus: Es muss klar sein, dass die App weiter nutzbar ist.
    expect(r.message).toContain("auch ohne");
  });

  it("wirft nie, sondern liefert immer ein Ergebnis", async () => {
    await expect(probeOllama("http://nicht.existent.invalid:1")).resolves.toBeTruthy();
  });

  it("meldet unerwarteten Status als Hinweis auf fremden Dienst", async () => {
    const port = await serve(404, {});
    const r = await probeOllama(`http://127.0.0.1:${port}`);

    expect(r.reachable).toBe(false);
    expect(r.message).toContain("404");
  });
});

describe("LM-Studio-Prüfung", () => {
  it("liest das OpenAI-kompatible Format", async () => {
    const port = await serve(200, { data: [{ id: "mistral-7b" }] });
    const r = await probeLmStudio(`http://127.0.0.1:${port}`);

    expect(r.reachable).toBe(true);
    expect(r.models).toEqual(["mistral-7b"]);
  });

  it("nennt bei totem Port den lokalen Server", async () => {
    const r = await probeLmStudio(DEAD);

    expect(r.reachable).toBe(false);
    expect(r.message).toContain("lokalen Server");
  });
});

describe("OpenAI-Prüfung", () => {
  it("überträgt ohne Schlüssel nichts", async () => {
    const r = await probeOpenAi("   ");

    expect(r.reachable).toBe(false);
    expect(r.message).toContain("Kein API-Schlüssel");
  });
});
