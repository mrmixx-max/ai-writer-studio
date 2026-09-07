# Sprint 19d — Agent 2 Abschlussbericht: KI-Panel UX für langsame lokale Modelle

Datum: 2026-09-07 · Agent 2 (KI-Panel UX) · kein Commit, kein Build

## Ziel
LFM2-24B (CPU) braucht 60–120 s+ bis zum ersten Token. Bisher: `busy=true` →
alle Buttons disabled, keine Rückmeldung → User denkt, die App hängt.
Jetzt: klarer busy-Zustand mit Abbrechen-Button, Elapsed-Timer und
Lade-Hinweis.

## Geändert (3 Dateien)

1. **`src/components/KIPanel/KIPanel.tsx`** (eigenes File)
   - `run()` erzeugt pro Run einen `AbortController` (`abortRef`), Guard
     `if (busy) return` verhindert überlappende Runs (u. a. Return-Taste
     während busy). Signal wird an `runActionInner(action, signal)` →
     `runKIAction(…, { signal })` durchgereicht.
   - Abbruch-Catch: bei `signal.aborted`/`AbortError` → Output „Abgebrochen.“
     (kein Fehlertext, kein `autoRemember`), `busy` wird im `finally`
     zurückgesetzt, `abortRef` geleert.
   - Elapsed-Timer: `useEffect` auf `busy` (1-s-`setInterval`, Reset bei Ende).
   - Busy-UI (`role="status"`, `aria-live="polite"`): „KI arbeitet… {elapsed}s“
     + `Abbrechen`-Button (jederzeit klickbar, Aktionen/Senden bleiben
     während busy disabled) + ab 10 s ohne erstes Token:
     „Großes Modell lädt — erste Antwort kann 1-2 Min dauern“.
2. **`src/services/ki/index.ts`** (kein Agent-1-File; minimal, rückkompatibel)
   - `runKIAction(settings, req, onToken, opts?: { signal?: AbortSignal })`:
     Signal wird als 3. Argument an `provider.chat(messages, options, signal)`
     durchgereicht (Interface `LLMProvider.chat` + alle Provider unterstützen
     `signal` bereits). Abort-Fehler werden erneut geworfen (Panel zeigt
     „Abgebrochen.“), alle anderen Fehler behalten Offline-Fallback.
3. **`src/components/KIPanel/KIPanel.test.tsx`** (eigenes File)
   - 5 bestehende `runKIAction`-Assertions um 4. Arg (`expect.anything()`)
     ergänzt — sonst wären sie am neuen optionalen Param gescheitert.

## Tests (3 neu, alle grün)
In `src/components/KIPanel/KIPanel.busyRecovery.test.tsx`,
neuer Block „KIPanel langsame Modelle (Sprint 19d)“:
1. Abbrechen-Button erscheint bei busy, ist enabled, `signal` ist `AbortSignal`;
   Klick → `signal.aborted`, Output „Abgebrochen.“, Senden wieder enabled.
2. Warte-Anzeige (Fake-Timer): kein Hinweis nach 5 s, Hinweis + Timer-Status
   nach 11 s ohne Token.
3. Return während busy startet keinen zweiten Run (`runKIAction` 1×).

## Verifikation
- `npx vitest run src/components/KIPanel/KIPanel.busyRecovery.test.tsx
  src/components/KIPanel/KIPanel.test.tsx` → **2 Files, 21 Tests, alle grün**
  (18 bestehend + 3 neu).
- `npx tsc --noEmit -p tsconfig.json` → fehlerfrei.
- Lernpunkt: `runKIAction` wird erst nach `await saveMsg()` erreicht —
  Tests brauchen `waitFor` auf den Mock-Call (kein synchrones Assert).

## Offene Punkte / Hinweise an Agent 1
- `src/services/llm/*` unangetastet. Falls ein Provider `signal` ignoriert,
  wirkt Abbrechen erst nach Response-Ende — bitte prüfen (Agent 1).
- Kein Styling für `.ki-busy`/`.ki-slow-hint`/`.ki-cancel` hinzugefügt
  (funktionale Klassen, ungestylt nutzbar); Design kann nachziehen.
