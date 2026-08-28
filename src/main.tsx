import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installGlobalErrorHandlers } from "./services/resilience/globalErrorHandler";
import { installFetchRetryShim } from "./services/resilience/fetchRetryShim";
import "./theme.css";
import "./app.css";

// Globale Fehler-Handler VOR dem ersten React-Render installieren, damit
// auch Fehler beim Booten (DB-Init, i18n) protokolliert werden.
installGlobalErrorHandlers();
// Zentraler Retry für alle fetch()-basierten Netzwerkaufrufe.
installFetchRetryShim();

createRoot(document.getElementById("root")!).render(<App />);

// Service Worker für Offline-Support registrieren (Browser-Dev/Preview).
// Im Tauri-Desktop-Betrieb (tauri://-Protokoll) ist `serviceWorker` zwar
// vorhanden, `navigator.serviceWorker.register` scheitert aber — deshalb
// bewusst fire-and-forget mit Protokoll-Guard: Ein SW-Fehler darf den
// App-Start niemals blockieren.
if ("serviceWorker" in navigator) {
  const isTauri =
    typeof window !== "undefined" &&
    !!(window as any).__TAURI_INTERNALS__;
  const proto = window.location.protocol;
  if (!isTauri && (proto === "http:" || proto === "https:")) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* Offline-Caching ist optional — Stillstand ignorieren. */
      });
  }
}
