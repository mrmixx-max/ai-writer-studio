// CORS-Health-Monitor (Sprint 4, Agent 1): Visuelle Ampel beim CLI-Start.
//
// Prüft die Erreichbarkeit lokaler LLM-Instanzen (Ollama, LM Studio) und
// kombiniert sie mit dem CORS-Pre-Flight aus Sprint 3 (ollamaCors.ts):
//   🟢 grün  = erreichbar UND CORS akzeptiert
//   🟡 gelb  = erreichbar, aber CORS blockiert (403 → OLLAMA_ORIGINS)
//   🔴 rot   = nicht erreichbar / sonstiger Fehlerstatus
//
// Einchecken eines beliebigen lokalen OpenAI-kompatiblen Endpunkts (z.B.
// Hermes-Agent-Gateway unter localhost) läuft über denselben Mechanismus.

export type TrafficLightStatus = "green" | "yellow" | "red";

export interface HealthCheck {
  name: string;
  url: string;
  reachable: boolean;
  corsOk: boolean;
  status: TrafficLightStatus;
  message: string;
}

/** Standard-Endpunkte der lokalen Instanzen (Sprint-4-Default). */
export const DEFAULT_LOCAL_ENDPOINTS: { name: string; url: string }[] = [
  { name: "Ollama", url: "http://127.0.0.1:11434/api/tags" },
  { name: "LM Studio", url: "http://127.0.0.1:1234/v1/models" },
  { name: "Hermes Agent", url: "http://127.0.0.1:8080/health" },
];

/**
 * Prüft EINE lokale Instanz: erst Erreichbarkeit (GET, kurzer Timeout),
 * dann CORS-Interpretation (403 = blockiert, ok = grün).
 */
export async function checkInstanceHealth(
  name: string,
  url: string,
  timeoutMs = 3000,
): Promise<HealthCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal } as RequestInit);
    if (res.ok) {
      return { name, url, reachable: true, corsOk: true, status: "green", message: "OK" };
    }
    if (res.status === 403) {
      return {
        name,
        url,
        reachable: true,
        corsOk: false,
        status: "yellow",
        message: `CORS blockiert (403) — Instanz mit OLLAMA_ORIGINS bzw. erlaubtem Origin starten`,
      };
    }
    return {
      name,
      url,
      reachable: true,
      corsOk: false,
      status: "red",
      message: `HTTP-Status ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      name,
      url,
      reachable: false,
      corsOk: false,
      status: "red",
      message: `Nicht erreichbar: ${msg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Prüft alle lokalen Endpunkte parallel. */
export async function checkAllLocalInstances(
  endpoints: { name: string; url: string }[] = DEFAULT_LOCAL_ENDPOINTS,
): Promise<HealthCheck[]> {
  return Promise.all(endpoints.map((e) => checkInstanceHealth(e.name, e.url)));
}

/** Ampel-Symbol je Status. */
export function trafficLightSymbol(status: TrafficLightStatus): string {
  switch (status) {
    case "green": return "🟢";
    case "yellow": return "🟡";
    default: return "🔴";
  }
}

/**
 * Rendert die Ampel-Übersicht (Mehrzeilen-Klartext, ohne ANSI-Farben —
 * die Icons liefern die Ampel; farbiges Rendering im Terminal-Entry-Point).
 */
export function renderTrafficLights(checks: HealthCheck[]): string {
  if (checks.length === 0) {
    return "Lokale Instanzen: (keine lokalen Instanzen konfiguriert)";
  }
  const lines = ["Lokale Instanzen — Health-Check:"];
  for (const c of checks) {
    const suffix = c.status === "yellow" ? " → OLLAMA_ORIGINS setzen" : "";
    lines.push(`  ${trafficLightSymbol(c.status)} ${c.name} (${c.url}): ${c.message}${suffix}`);
  }
  return lines.join("\n");
}
