// Ollama-Modell-Manager (Sprint 9, Agent 4).
//
// Verwaltet lokal installierte Ollama-Modelle (Standard: http://127.0.0.1:11434,
// Modelle z. B. unter D:\ollama\models):
// - listInstalledModels(): GET {base}/api/tags → Name + Größe je Modell
// - pullModel(): POST {base}/api/pull (stream:true) mit Fortschritts-Callback
// - deleteModel(): DELETE {base}/api/delete
//
// Grundsätze:
// - Additiv, kein Breaking Change: bestehende Provider/Router bleiben unangetastet.
// - Alle Fehler als ModelManagerError mit sprechender (deutscher) Nachricht.

/** Standard-Adresse des lokalen Ollama-Servers. */
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

/** Hinweis-Pfad des Modellverzeichnisses (nur Anzeige, kein Dateizugriff). */
export const OLLAMA_MODELS_DIR_HINT = "D:\\ollama\\models";

/** Warnschwelle für freien Plattenplatz (Default 10 GB — Modelle sind groß). */
export const LOW_DISK_THRESHOLD_BYTES = 10 * 1024 ** 3;

/** Ein installiertes Ollama-Modell (Subset von /api/tags). */
export interface InstalledModel {
  name: string;
  /** Größe in Bytes (0, wenn der Server keine meldet). */
  size: number;
  digest?: string;
  modifiedAt?: string;
  parameterSize?: string;
  quantization?: string;
}

/** Fortschritt eines laufenden Modell-Downloads (/api/pull-Stream). */
export interface PullProgress {
  /** Roh-Status von Ollama, z. B. "pulling manifest", "downloading", "verifying", "success". */
  status: string;
  completed?: number;
  total?: number;
  /** 0–100, oder null wenn (noch) kein total bekannt ist. */
  percent: number | null;
}

/** Fortschritts-Callback für pullModel(). */
export type PullProgressCallback = (progress: PullProgress) => void;

/** Fehler des Modell-Managers (Netzwerk, HTTP-Status, Stream-Fehler). */
export class ModelManagerError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ModelManagerError";
    this.cause = cause;
  }
}

const SERVE_HINT = "Ollama nicht erreichbar. Server starten: `ollama serve` (Standard-Port 11434).";

function base(baseUrl: string | undefined): string {
  const b = (baseUrl ?? DEFAULT_OLLAMA_BASE_URL).trim() || DEFAULT_OLLAMA_BASE_URL;
  return b.replace(/\/+$/, "");
}

function requireName(name: string, aktion: string): string {
  const n = (name ?? "").trim();
  if (!n) throw new ModelManagerError(`Kein Modellname angegeben — nichts zu ${aktion}.`);
  return n;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();
  } catch {
    // kein JSON — Status reicht
  }
  return `HTTP-Status ${res.status}`;
}

/**
 * Listet die installierten Modelle (GET /api/tags).
 * Leere/unbekannte Antwort → leeres Array (kein Crash im UI).
 */
export async function listInstalledModels(baseUrl?: string): Promise<InstalledModel[]> {
  const url = `${base(baseUrl)}/api/tags`;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    throw new ModelManagerError(SERVE_HINT, e);
  }
  if (!res.ok) throw new ModelManagerError(`Modellliste fehlgeschlagen: ${await readError(res)}.`);
  let data: { models?: unknown };
  try {
    data = (await res.json()) as { models?: unknown };
  } catch (e) {
    throw new ModelManagerError("Modellliste: ungültige Server-Antwort (kein JSON).", e);
  }
  if (!Array.isArray(data.models)) return [];
  return data.models
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
    .map((m) => ({
      name: String(m["name"] ?? ""),
      size: typeof m["size"] === "number" && Number.isFinite(m["size"]) ? m["size"] : 0,
      digest: typeof m["digest"] === "string" ? m["digest"] : undefined,
      modifiedAt: typeof m["modified_at"] === "string" ? m["modified_at"] : undefined,
      parameterSize: typeof m["details"] === "object" && m["details"] !== null
        ? (typeof (m["details"] as Record<string, unknown>)["parameter_size"] === "string"
          ? String((m["details"] as Record<string, unknown>)["parameter_size"])
          : undefined)
        : undefined,
      quantization: typeof m["details"] === "object" && m["details"] !== null
        ? (typeof (m["details"] as Record<string, unknown>)["quantization_level"] === "string"
          ? String((m["details"] as Record<string, unknown>)["quantization_level"])
          : undefined)
        : undefined,
    }))
    .filter((m) => m.name !== "");
}

interface PullStreamLine {
  status?: string;
  error?: string;
  completed?: number;
  total?: number;
  digest?: string;
}

function toProgress(line: PullStreamLine): PullProgress {
  const { status = "", completed, total } = line;
  const percent =
    typeof completed === "number" && typeof total === "number" && total > 0
      ? Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
      : status === "success"
        ? 100
        : null;
  return { status, completed, total, percent };
}

/**
 * Zieht ein Modell (POST /api/pull, stream:true) und meldet Fortschritt.
 * Löst erst auf, wenn der Stream mit {"status":"success"} endet.
 */
export async function pullModel(
  name: string,
  onProgress?: PullProgressCallback,
  opts?: { baseUrl?: string; signal?: AbortSignal },
): Promise<void> {
  const model = requireName(name, "laden");
  const url = `${base(opts?.baseUrl)}/api/pull`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model, stream: true }),
      signal: opts?.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ModelManagerError(SERVE_HINT, e);
  }
  if (!res.ok) throw new ModelManagerError(`Modell „${model}“ konnte nicht geladen werden: ${await readError(res)}.`);
  const emit = (p: PullProgress) => {
    try {
      onProgress?.(p);
    } catch {
      // Ein fehlerhafter UI-Callback darf den Download nicht abbrechen.
    }
  };
  // Kein lesbarer Stream (z. B. stream:false-Proxys) → einmalige Antwort auswerten.
  if (!res.body) {
    try {
      const data = (await res.json()) as PullStreamLine;
      if (data.error) throw new ModelManagerError(`Modell „${model}“ konnte nicht geladen werden: ${data.error}`);
      emit(toProgress({ status: data.status ?? "success" }));
      return;
    } catch (e) {
      if (e instanceof ModelManagerError) throw e;
      throw new ModelManagerError(`Modell „${model}“: ungültige Server-Antwort.`, e);
    }
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let parsed: PullStreamLine;
        try {
          parsed = JSON.parse(line) as PullStreamLine;
        } catch {
          continue; // unvollständige/fehlerhafte Zeile überspringen
        }
        if (parsed.error) {
          throw new ModelManagerError(`Modell „${model}“ konnte nicht geladen werden: ${parsed.error}`);
        }
        if (parsed.status) emit(toProgress(parsed));
        if (parsed.status === "success") finished = true;
      }
    }
    const tail = buffer.trim();
    if (tail) {
      try {
        const parsed = JSON.parse(tail) as PullStreamLine;
        if (parsed.error) {
          throw new ModelManagerError(`Modell „${model}“ konnte nicht geladen werden: ${parsed.error}`);
        }
        if (parsed.status) {
          emit(toProgress(parsed));
          if (parsed.status === "success") finished = true;
        }
      } catch (e) {
        if (e instanceof ModelManagerError) throw e;
        // Restmüll ignorieren
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // bereits geschlossen — egal
    }
  }
  if (!finished) {
    // Stream endete ohne success UND ohne error: als Fehler melden statt stillen Erfolg.
    throw new ModelManagerError(`Modell „${model}“: Download unvollständig (Stream endete ohne Bestätigung).`);
  }
}

/** Löscht ein installiertes Modell (DELETE /api/delete). */
export async function deleteModel(name: string, opts?: { baseUrl?: string }): Promise<void> {
  const model = requireName(name, "löschen");
  const url = `${base(opts?.baseUrl)}/api/delete`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
    });
  } catch (e) {
    throw new ModelManagerError(SERVE_HINT, e);
  }
  if (!res.ok) {
    throw new ModelManagerError(
      model && res.status === 404
        ? `Modell „${model}“ ist nicht installiert.`
        : `Modell „${model}“ konnte nicht gelöscht werden: ${await readError(res)}.`,
    );
  }
}

/** Formatiert Byte-Größen deutsch (B/KB/MB/GB/TB, Komma-Dezimal). Ungültig → „–“. */
export function formatModelSize(bytes: number): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "–";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = unit === 0 ? Math.round(value).toString() : value.toFixed(1).replace(".", ",");
  return `${rounded} ${units[unit]}`;
}

/** true, wenn der freie Plattenplatz unter der Schwelle liegt (Default 10 GB). */
export function isLowDiskSpace(
  freeBytes: number,
  thresholdBytes: number = LOW_DISK_THRESHOLD_BYTES,
): boolean {
  if (!Number.isFinite(freeBytes) || freeBytes < 0) return false;
  return freeBytes < thresholdBytes;
}
