// Sprint 19c (Send-Debug): URL-Normalisierung für lokale Provider.
//
// Problem: Der Default `http://localhost:11434` kann vom System zu IPv6 ::1
// aufgelöst werden, Ollama bindet default aber nur IPv4 (127.0.0.1) →
// fetch schlägt fehl → App zeigt "Offline-Modus / Provider nicht erreichbar",
// obwohl `curl http://127.0.0.1:11434/api/tags` antwortet.
// Fix: Hostname "localhost" immer zu 127.0.0.1 normalisieren, bevor ein
// Provider seine Base-URL speichert. IPv4-Loopback funktioniert in beiden
// Welten (IPv4-Stack + IPv6-fähige Systeme lösen 127.0.0.1 nie zu ::1 auf).

/**
 * Ersetzt den Hostnamen "localhost" durch "127.0.0.1".
 * Lässt alle anderen Hosts, Ports, Pfade, Query-Strings und Credentials
 * unverändert. Ungültige/relative URLs werden unverändert zurückgegeben.
 */
export function normalizeLocalBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() === "localhost") {
      url.hostname = "127.0.0.1";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return baseUrl;
  }
}
