# Sprint 19c Agent 1 — Send-Debug Abschlussbericht

**Datum:** 2026-09-07 · **Agent:** Send-Debug (Agent 1) · **Scope:** `src/services/llm/*` (kein Commit, kein Build)

## 1. Diagnose

### Symptom A: Senden-Button „reagiert nicht"
**Ursache:** `runKIAction` (`src/services/ki/index.ts`, Zeile 50) awaitet
`provider.healthCheck()` **synchron vor jedem KI-Aufruf**. Solange der Check
hängt, bleibt `busy=true` im KIPanel (`KIPanel.tsx`, `run()`) — alle Buttons
inkl. Senden sind `disabled`, es gibt keinen Fortschritt, kein Timeout-Feedback.
Der Button wirkt „tot". Der `finally`-Block setzt `busy` zwar korrekt zurück,
aber erst **nach** dem Hängen. `fetchWithTimeout` (`stream.ts`) nutzt zwar
`AbortController`, der Health-Timeout lag aber bei **5s** — bei IPv6-Fehlschlag
(siehe B) mit DNS-Wartezeit spürbar, und jeder Senden-Klick zahlt diese Latenz
voll, bevor überhaupt der Offline-Fallback erscheint.

### Symptom B: „Ollama nicht erreichbar" obwohl Ollama läuft
**Ursache:** Default `ollamaBaseUrl: "http://localhost:11434"` (`types/config.ts`).
`localhost` löst auf vielen Windows-Systemen zu **IPv6 `::1`** auf, Ollama
bindet default aber nur **IPv4 `127.0.0.1`**. `curl http://127.0.0.1:11434`
antwortet, der App-Healthcheck gegen `localhost` schlägt fehl →
`runKIAction` fällt in den Offline-Fallback („Provider nicht erreichbar").
Der Provider übernahm `baseUrl` **verbatim**, ohne Normalisierung.

## 2. Fix (nur `src/services/llm/`)
- **Neu `baseUrl.ts`:** `normalizeLocalBaseUrl()` ersetzt Host `localhost` →
  `127.0.0.1` (Port/Pfad/Query bleiben, Remote-/Cloud-Hosts und ungültige
  URLs unverändert, kein Throw).
- **`ollama.ts`:** Konstruktor normalisiert `baseUrl`; `HEALTH_TIMEOUT`
  **5000 → 3000 ms** (lokales `/api/tags` antwortet in ms; 3s reicht als
  Erreichbarkeits-Signal, Senden-Button wird schneller wieder frei).
- **`openai-compatible.ts`:** gleiche Normalisierung im Konstruktor (deckt
  LM Studio, gpt2api, OpenAI, OpenRouter, Nous ab — Cloud-URLs unverändert,
  da nur `localhost` ersetzt wird) + `HEALTH_TIMEOUT` **5000 → 3000 ms**.
- `fetchWithTimeout` (`stream.ts`, AbortController) unverändert — bereits korrekt.

## 3. Tests (neu: `src/services/llm/senddebug.test.ts`, 6 Tests, alle grün)
- Normalisierung: `localhost` → `127.0.0.1` (Port/Pfad erhalten).
- `127.0.0.1`/Remote-/Cloud-Hosts unverändert; ungültige URLs kein Throw.
- HealthCheck gegen nie antwortenden Server → `false` nach 3s (Ollama + LMStudio,
  Fake-Timer).
- `OllamaProvider("http://localhost:11434")` fetcht tatsächlich
  `http://127.0.0.1:11434/api/tags`.

## 4. Self-Check
- `npm run typecheck` ✅ · `npm run lint` ✅
- `npx vitest run src/services/llm/ src/components/KIPanel/` ✅ (inkl. 6 neuer Tests)

## 5. Offene Punkte / Hinweise
- User mit bereits gespeicherter `localhost`-URL profitieren sofort (Normalisierung
  läuft im Konstruktor, keine Migration nötig). Optional: Default in
  `types/config.ts` künftig direkt auf `http://127.0.0.1:11434` ändern.
- `SettingsPanel`-Hilfetexte nennen weiter `localhost` — unkritisch, da normalisiert.
