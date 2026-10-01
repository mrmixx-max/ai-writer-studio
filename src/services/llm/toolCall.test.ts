// Tests für den Tool-Call-Parser (WP1.1).
//
// Kernaussage: Hermes-Modelle liefern Werkzeugaufrufe als TEXT. Ohne Parser
// würde ein korrekt geschriebener <tool_call> als Fließtext durchgehen und der
// Aufruf lautlos verschwinden.

import { describe, it, expect } from "vitest";
import { parseModelResponse, acceptToolCall, buildToolInstructions } from "./toolCall";

describe("parseModelResponse — Blöcke trennen", () => {
  it("trennt Scratchpad, Text und Werkzeugaufruf", () => {
    const raw =
      "<scratchpad>Ich prüfe das Pacing.</scratchpad>" +
      "Hier ist meine Analyse." +
      '<tool_call>{"name":"propose_patches","arguments":{"patches":[]}}</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.scratchpad).toBe("Ich prüfe das Pacing.");
    expect(r.text).toBe("Hier ist meine Analyse.");
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].name).toBe("propose_patches");
  });

  it("liest Argumente als Objekt", () => {
    const raw = '<tool_call>{"name":"x","arguments":{"a":1,"b":"zwei"}}</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.toolCalls[0].arguments).toEqual({ a: 1, b: "zwei" });
    expect(r.toolCalls[0].argumentsInvalid).toBe(false);
  });

  it("liest Argumente, die als JSON-String eingebettet sind", () => {
    // Kommt häufig vor: das Modell quotet das arguments-Objekt.
    const raw = '<tool_call>{"name":"x","arguments":"{\\"a\\":1}"}</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.toolCalls[0].arguments).toEqual({ a: 1 });
  });

  it("unterstützt die Kurzform mit tool/args", () => {
    const raw = '<tool_call>{"tool":"y","args":{"v":2}}</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.toolCalls[0].name).toBe("y");
    expect(r.toolCalls[0].arguments).toEqual({ v: 2 });
  });

  it("liest flache Argumente ohne arguments-Feld", () => {
    const raw = '<tool_call>{"name":"x","search":"alt","replace":"neu"}</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.toolCalls[0].arguments).toEqual({ search: "alt", replace: "neu" });
  });

  it("verarbeitet mehrere Aufrufe in Reihenfolge", () => {
    const raw =
      '<tool_call>{"name":"a","arguments":{}}</tool_call>' +
      "dazwischen" +
      '<tool_call>{"name":"b","arguments":{}}</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.toolCalls.map((c) => c.name)).toEqual(["a", "b"]);
  });

  it("ignoriert Groß-/Kleinschreibung der Tags", () => {
    const raw = '<TOOL_CALL>{"name":"x","arguments":{}}</TOOL_CALL>';
    expect(parseModelResponse(raw).toolCalls).toHaveLength(1);
  });

  it("kommt mit Markdown-Fences im Aufruf zurecht", () => {
    const raw = '<tool_call>```json\n{"name":"x","arguments":{"a":1}}\n```</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.toolCalls[0].arguments).toEqual({ a: 1 });
  });

  it("repariert fehlerhaftes JSON im Aufruf", () => {
    // Single-Quotes und unquotete Keys — die Kaskade aus structured.ts greift.
    const raw = "<tool_call>{'name':'x',arguments:{a:1}}</tool_call>";
    const r = parseModelResponse(raw);
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].name).toBe("x");
  });

  it("fängt einen Aufruf ohne schließendes Tag ab", () => {
    const raw = 'Analyse.\n<tool_call>{"name":"x","arguments":{"a":1}}';
    const r = parseModelResponse(raw);
    expect(r.toolCalls).toHaveLength(1);
    expect(r.text).toBe("Analyse.");
  });

  it("erkennt einen Aufruf, der nur den Namen enthält", () => {
    const raw = "<tool_call>propose_patches</tool_call>";
    const r = parseModelResponse(raw);
    expect(r.toolCalls[0].name).toBe("propose_patches");
    expect(r.toolCalls[0].arguments).toEqual({});
  });

  it("liefert leere Struktur bei leerer Eingabe", () => {
    const r = parseModelResponse("");
    expect(r).toEqual({ text: "", scratchpad: "", toolCalls: [] });
  });

  it("lässt normalen Text unverändert", () => {
    const r = parseModelResponse("Ein ganz normaler Absatz ohne Werkzeuge.");
    expect(r.text).toBe("Ein ganz normaler Absatz ohne Werkzeuge.");
    expect(r.toolCalls).toEqual([]);
  });

  it("markiert unlesbare Argumente als ungültig", () => {
    const raw = '<tool_call>{"name":"x","arguments":123}</tool_call>';
    const r = parseModelResponse(raw);
    expect(r.toolCalls[0].argumentsInvalid).toBe(true);
  });

  it("verwirft einen Aufruf ohne Namen", () => {
    const raw = '<tool_call>{"arguments":{"a":1}}</tool_call>';
    expect(parseModelResponse(raw).toolCalls).toEqual([]);
  });
});

describe("acceptToolCall — Whitelist", () => {
  it("lässt erlaubte Werkzeuge durch", () => {
    const call = { name: "ok", arguments: {}, argumentsInvalid: false };
    expect(acceptToolCall(call, ["ok", "other"])).toEqual(call);
  });

  it("lehnt erfundene Werkzeugnamen ab", () => {
    // Ein Modell, das ein Werkzeug erfindet, darf nicht in die Ausführung.
    const call = { name: "rm_rf", arguments: {}, argumentsInvalid: false };
    expect(acceptToolCall(call, ["ok"])).toBeNull();
  });

  it("lehnt Aufrufe mit ungültigen Argumenten ab", () => {
    const call = { name: "ok", arguments: {}, argumentsInvalid: true };
    expect(acceptToolCall(call, ["ok"])).toBeNull();
  });
});

describe("buildToolInstructions", () => {
  it("listet die Werkzeuge und das Format", () => {
    const s = buildToolInstructions([{ name: "t", description: "tut was" }]);
    expect(s).toContain("t: tut was");
    expect(s).toContain("<tool_call>");
    expect(s).toContain("<scratchpad>");
  });

  it("liefert leeren String ohne Werkzeuge", () => {
    expect(buildToolInstructions([])).toBe("");
  });
});
