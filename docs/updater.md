# Auto-Updater (Tauri Updater-Plugin)

AI Writer Studio aktualisiert sich selbst über das Tauri-Updater-Plugin
(`tauri_plugin_updater`). Die gesamte Update-Logik liegt im Backend
(`src-tauri/src/updater.rs`), das Frontend (`src/components/Settings/UpdateCheck.tsx`,
eingebettet im Settings-Panel) ruft nur Commands auf und zeigt den Fortschritt.

## Beteiligte Dateien (nicht ohne Grund anfassen)

| Datei | Rolle |
|---|---|
| `src-tauri/src/updater.rs` | Commands `check_for_updates`, `download_and_install_update`, `relaunch_app`; emittiert `update://progress` und `update://installed` |
| `src-tauri/src/main.rs` | Plugin-Init (`.plugin(tauri_plugin_updater::Builder::new().build())`) + Command-Registrierung im `invoke_handler` |
| `src-tauri/tauri.conf.json` → `plugins.updater` | `active: true`, `pubkey` (Minisign-Public-Key), `endpoints` (Feed-URL) |
| `scripts/generate-update-manifest.ps1` | Erzeugt `latest.json` aus den Build-Artefakten |
| `scripts/release.config.psd1` | Zentrale Release-Konfiguration (`AppVersion`, `AppUrl`, …) |
| `src/components/Settings/UpdateCheck.tsx` | UI: Prüfen → Herunterladen → Neustart |

## Wie Updates funktionieren

1. **Prüfung:** `check_for_updates` lädt den Update-Feed von
   `https://github.com/mrmixx-max/ai-writer-studio/releases/latest/download/latest.json`
   (stabiler Link, zeigt immer auf das neueste Release). Das Plugin vergleicht
   die Feed-Version mit der installierten (`app.package_info().version`).
   Ergebnis ans Frontend: `{ available, current_version, version, notes, date }`.
2. **Download + Installation:** `download_and_install_update` lädt das
   plattformspezifische Artefakt (Windows: `AI-Writer-Studio_<version>_x64-setup.nsis.zip`),
   **prüft die Minisign-Signatur gegen den im Build eingebetteten Public Key**
   (`pubkey` in `tauri.conf.json`) und installiert. Eine manipulierte oder
   falsch signierte Datei wird verworfen — Fehlertext: „Update-Installation
   fehlgeschlagen …“.
3. **Fortschritt:** Während des Downloads sendet das Backend
   `update://progress`-Events (`{ downloaded, total }`), nach erfolgreicher
   Installation `update://installed` (`{ version }`). Danach startet die App
   automatisch neu (`app.restart()`).
4. **Manueller Neustart:** `relaunch_app` startet die App neu (Restart-Prompt
   im „bereit“-Zustand der UI).

Schlägt der Netzwerkzugriff fehl, meldet der Check einen verständlichen Fehler
(„Update-Check fehlgeschlagen …“) — **die App bleibt voll funktionsfähig**.
Updates sind opt-in per Button, es gibt keinen stillen Auto-Download.

### Feed-Format (`latest.json`)

```json
{
  "version": "1.1.0",
  "pub_date": "2026-09-01T12:00:00Z",
  "notes": "Neu: …",
  "platforms": {
    "windows-x86_64": {
      "signature": "<Inhalt der .sig-Datei>",
      "url": "https://github.com/mrmixx-max/ai-writer-studio/releases/download/v1.1.0/AI-Writer-Studio_1.1.0_x64-setup.nsis.zip"
    }
  }
}
```

Erzeugt wird die Datei von `scripts/generate-update-manifest.ps1` (Details siehe
Header-Kommentar im Skript). Die Artefakte (`.nsis.zip` + `.sig`) entstehen beim
`tauri build`, weil `bundle.createUpdaterArtifacts: true` gesetzt ist.

### Feed-Workflow key-agnostisch (`scripts/updater-feed.mjs`, Sprint 11)

Key-agnostisch heißt: **Ohne Signing-Key wird nichts signiert und nichts
publiziert** — es entsteht nur ein `UNSIGNED`-Draft, der explizit gestoppt wird.

```sh
# 1) Draft bauen (ohne Key → unsigned Draft + Exit 2, Stopp vor Publishing)
node scripts/updater-feed.mjs --repo mrmixx-max/ai-writer-studio \
  --tag v1.1.0 --notes-file NOTES.md --out latest.json

# 2) Opt-in via release.mjs (default AUS — normale Releases bleiben unverändert)
node scripts/release.mjs --updater-feed -- --repo mrmixx-max/ai-writer-studio --tag v1.1.0 --out latest.json

# 3) Mit Key (CI/Release-Rechner): Signatur übernehmen → signierter Feed, Exit 0
TAURI_SIGNING_PRIVATE_KEY=... node scripts/updater-feed.mjs --repo ... --tag v1.1.0 \
  --sig windows-x86_64="$(cat *.nsis.zip.sig)" --out latest.json
```

Regeln:

- Ohne `TAURI_SIGNING_PRIVATE_KEY` (oder `TAURI_PRIVATE_KEY`): Draft mit
  `"unsigned": true` + leeren Signaturen schreiben, dann **exakt** ausgeben:
  `Kein Signing-Key gefunden. Key erzeugen mit: tauri signer generate -w`
  und mit Exit-Code 2 stoppen (`latest.json` NICHT als Release-Asset hochladen).
- Mit Key: nur übergebene `--sig`-Werte übernehmen (das Skript signiert nicht
  selbst, der Key-Wert wird nie ausgegeben/geloggt).
- Fixture-Modus ohne Netzwerk: `node scripts/updater-feed.mjs --release-json
  release.json --out latest.json` (`{tag, body, assets[]}`).
- Tests: `npx vitest run tests/updater-feed.test.ts` (reine Fixtures, keine
  Keys, kein Netzwerk).

## Key-Rotation (Signaturschlüssel wechseln)

Der `pubkey` in `tauri.conf.json` ist **öffentlich** (kein Secret) und wird in
den Build eingebettet. Ablauf bei Schlüsselwechsel:

1. Neues Minisign-Schlüsselpaar erzeugen (`tauri signer generate`).
2. **Neuen `pubkey` in `tauri.conf.json` eintragen.**
3. **Übergangs-Release:** Das letzte Release mit dem *alten* Schlüssel signieren,
   das erste Release mit dem *neuen* Schlüssel **zusätzlich** so bereitstellen,
   dass Clients mit altem Key es noch verifizieren können. Praktisch heißt das:
   Mindestens ein Release ausliefern, dessen Artefakte mit dem alten Schlüssel
   signiert sind, aber bereits den neuen `pubkey` eingebettet haben — danach
   greift der neue Schlüssel.
4. Alten Private Key sicher vernichten (nicht ins Repo committen — Private Keys
   gehören **niemals** ins Git; nur `pubkey` in `tauri.conf.json` ist öffentlich
   und bleibt).
5. Diesen Abschnitt + Versionshinweis im Changelog aktualisieren.

**Ohne Übergangs-Release sperren sich alte Clients selbst aus** (Signatur mit
unbekanntem Key → Update wird verworfen).

## Release-Flow (damit Updates fließen)

Checkliste pro Release — jeder Schritt ist Pflicht, sonst erhalten Clients kein
oder ein kaputtes Update:

1. **Version bump:** `AppVersion` in `scripts/release.config.psd1` erhöhen und
   per `scripts/sync-version.ps1` (falls vorhanden) in `tauri.conf.json` und
   `package.json` synchronisieren. Alle drei müssen übereinstimmen.
2. **Build:** `tauri build` (Windows-Ziel `nsis`). Prüfen, dass
   `AI-Writer-Studio_<version>_x64-setup.nsis.zip` **und** `.sig` erzeugt wurden
   (`bundle.createUpdaterArtifacts` muss `true` bleiben).
3. **Manifest:** `scripts/generate-update-manifest.ps1 [-Version x.y.z]` laufen
   lassen → erzeugt signierte `latest.json`. Signatur-Spalte gegen `.sig`-Datei
   gegenprüfen.
4. **GitHub-Release erstellen:** Tag `v<version>` (z. B. `v1.1.0`) pushen,
   Release mit **allen drei Dateien** als Assets hochladen:
   `…-setup.nsis.zip`, `….sig`, `latest.json`. Ohne `latest.json` am stabilen
   `…/releases/latest/download/latest.json`-Pfad sehen Clients nichts.
5. **Verifizieren:** `latest.json`-URL im Browser öffnen (Version/platforms-URL
   prüfen), dann in einer installierten Vorversion auf „Nach Updates suchen“
   klicken und den Flow bis zum Neustart durchspielen.
6. **Changelog:** `docs/CHANGELOG.md` ergänzen (`node scripts/release.mjs --changelog`).

Häufige Fehlerquellen: Tag ohne `v`-Präfix (Feed-URL `…/download/v<version>`
stimmt dann nicht), `latest.json` vergessen hochzuladen, Version in
`tauri.conf.json` ≠ Tag-Version (Plugin meldet „aktuell“, obwohl ein Release
existiert).
