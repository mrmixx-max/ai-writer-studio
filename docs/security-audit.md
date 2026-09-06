# Security Audit — AI Writer Studio (Tauri 2 + React + TS)

Stand: Sprint 8 / Agent 1 (Security Hardening & Input Validation).
Scope: Renderer (React/WebView2), IPC/Capabilities, Input-Validation, Secrets, Markdown-Rendering, CSP.

## 1. Threat Model

| # | Asset | Bedrohung | Vektor | Status |
|---|-------|-----------|--------|--------|
| T1 | WebView2-DOM | Stored-XSS via LLM-Output (Prompt-Injection → HTML) | `BlurbGenPanel.amazonDescription` → `dangerouslySetInnerHTML` | **GEFUNDEN → GEFIXT** (sanitizeHtml) |
| T2 | WebView2-DOM | Reflected-XSS via Markdown-Roh-HTML | `MarkdownViewerPanel` (eigener Renderer, escapet) | OK (defense-in-depth: sanitizeFilename für Download) |
| T3 | Dateisystem | Path Traversal via Datei-/Projektnamen | `validateFilename` (Regex zu schwach: kein `%2e`, kein `..\`, kein absolut) | **GEFUNDEN → GEFIXT** (detectPathTraversal) |
| T4 | Dateisystem | Traversal via Download-Dateiname (UI-Input) | `MarkdownViewerPanel.fileName` → `a.download` unvalidiert | **GEFUNDEN → GEFIXT** (sanitizeFilename) |
| T5 | Logs/Fehlerreports | Credential-Leak (API-Keys in Logs) | kein Redaction-Helper vorhanden | **GEFUNDEN → GEFIXT** (redactSecrets) |
| T6 | WebView2 | Clickjacking/Plugin-/Frame-Injection | CSP ohne `object-src`/`frame-*`/`base-uri` | **GEFUNDEN → GEFIXT** (CSP gehärtet) |
| T7 | Markdown-Links | `javascript:`-URIs in generiertem Markdown | `sanitizeMarkdown` (Regex, kein `vbscript:`/md-Link-Schutz) | **GEFUNDEN → GEFIXT** |
| T8 | IPC/FS-Scope | Überbreite FS-Capabilities | `fs:allow-read-file/write-file` global + Scope auf Dokumente/Desktop | OFFEN (Medium) — Empfehlung: Scope auf App-Verzeichnisse einengen |
| T9 | Credentials at rest | KDP-Credentials: Key-Management lokal | AES-256-GCM ok, Schlüsselableitung lokal | OFFEN (Medium) — Empfehlung: DPAPI/Secret-Service (vgl. SEC-003) |
| T10 | DoS (Client) | Riesen-Inputs an Sanitizer/Renderer | keine Längen-Caps | **GEFUNDEN → GEFIXT** (200k-Cap, bounded loops) |

**Bilanz: 7 gefunden & gefixt, 2 offen (Medium, dokumentiert), Rest ok.**

## 2. OWASP Top 10 — Mapping für diese Tauri-App

1. **A03 Injection (XSS)** — T1/T2/T7. Fix: `sanitizeHtml` (Allowlist, dependency-frei), `sanitizeMarkdown` delegiert dorthin; BlurbGen sanitiziert LLM-HTML. Tests: `tests/security/xss-hardening.test.ts` (24 Tests).
2. **A01 Broken Access Control / Path Traversal** — T3/T4. Fix: `detectPathTraversal` (plain, `\`, absolut, `%2e`/`%c0%af`, doppelt-kodiert, Null-Byte, UNC), Windows-Reserviertheits-Check, `sanitizeFilename` für UI-Pfade.
3. **A02 Cryptographic Failures / Secret-Leak** — T5. Fix: `redactSecrets` (OpenRouter/OpenAI/GitHub/Slack/Bearer/Private-Key). Regel: jeder Log-/Fehlerpfad mit Secrets läuft durch `redactSecrets`.
4. **A05 Security Misconfiguration (CSP)** — T6. Fix: CSP um `object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'; media-src 'self' blob:` erweitert. Bewusst behalten: `wasm-unsafe-eval` (SQLite/Tiptap-WASM), `unsafe-inline` Styles, Updater-Hosts in `connect-src`.
5. **A06 Vulnerable Components** — keine neue Dependency eingeführt (Sanitizer ohne DOMPurify, um Supply-Chain klein zu halten); `npm audit` weiterhin regelmäßig (vgl. SEC-004).
6. **A04 Insecure Design / Prompt-Injection** — System-Prompt/User-Input-Trennung + Längenlimits (`validatePrompt`, RateLimiter) bleiben Pflicht; LLM-Output gilt als **nicht vertrauenswürdig** (T1 als Beleg).
7. **A07 Auth-Failures** — keine Änderung (lokale App, keine Sessions).
8. **A08 Data-Integrity (Updates)** — signierte Updates via `tauri-plugin-updater` aktiv; Updater-Hosts in CSP allowlisted.
9. **A09 Logging-Failures** — `redactSecrets` schließt die Lücke für neue Codepfade; Alt-Codepfade bei Touch reviewen.
10. **A10 SSRF/Exfiltration** — `isSafeHref`-Allowlist (`http/https/mailto/relativ`), keine `file:/blob:`-Ziele aus Content; `connect-src` deckt nur App-APIs + Updater ab.

## 3. Was geändert wurde (keine Breaking Changes — nur Additive + interne Härtung)

- `src/utils/validation/index.ts`: neu `sanitizeHtml`, `detectPathTraversal`, `sanitizeFilename`, `redactSecrets`; gehärtet `sanitizeMarkdown`, `containsXSS` (iframe/svg-Erkennung), `validateFilename` (kodiert/absolut/reserviert), `validatePrompt`/`validateProjectName` (stärkere Traversal-Erkennung, gleiche Fehlermeldungs-Keys). Alle alten Exporte/Signaturen erhalten.
- `src/components/BlurbGen/BlurbGenPanel.tsx`: `sanitizeHtml(result.amazonDescription)` vor `dangerouslySetInnerHTML`.
- `src/components/Writing/MarkdownViewerPanel.tsx`: `sanitizeFilename(fileName)` für Download.
- `src-tauri/tauri.conf.json`: CSP gehärtet (s. o.).
- `tests/security/xss-hardening.test.ts`: 24 Tests (Injection, Traversal, Overflow, Redaction).

## 4. Offene Empfehlungen (nicht in diesem Sprint)

- R1 (Medium): FS-Capabilities einengen (`fs:allow-read-file/write-file` global → Scope auf `$APPDATA/$DOCUMENT/<AppDir>`).
- R2 (Medium): Schlüsselableitung für KDP-Credentials auf DPAPI/Secret-Service umstellen (SEC-003).
- R3 (Low): `dragDropEnabled` evaluieren (Drop externer Dateien als Content-Vektor) + `npm audit` in CI.
- R4 (Low): Alt-Logpfade auf `redactSecrets` umstellen; Security-Test-Suite in `npm run verify` bereits enthalten.

## 5. Verifikation

- `npx vitest run tests/security/` — alle grün (bestehende + 24 neue Tests).
- `npm run typecheck` — grün (keine neuen Typfehler).
- Keine Interface-Änderungen: alle Fixes sind additive Exporte oder interne Verschärfungen mit gleichen Throw-Semantiken.
