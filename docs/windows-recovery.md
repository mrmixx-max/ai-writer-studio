# Windows Release Recovery

## Symptome

- Release-Build startet (Prozess `ai-writer-studio.exe` läuft im Task-Manager)
- **Kein Fenster sichtbar** — weder im Taskbar noch auf dem Desktop
- WebView2-Prozesse (`msedgewebview2.exe`) sind im Task-Manager sichtbar
- Dev-Mode (`npm run tauri dev`) funktioniert einwandfrei

## Ursache

Ein hängengebliebener Prozess eines vorherigen Release-Builds blockiert die WebView2-User-Data-Ordner-Instanz. Der neue Start kann kein sichtbares Fenster erzeugen.

## Diagnose

### 1. Prozessprüfung

```powershell
Get-Process ai-writer-studio
```

Wenn Prozesse zurückkehren, die kein Fenster haben → Zombie.

### 2. Log prüfen

Logs liegen unter:
```
%APPDATA%\com.aiwriterstudio.app\logs\
```

Konsolen-Ausgabe (für Debugging):
```powershell
$env:RUST_LOG="info"
& "C:\Users\<user>\AppData\Local\Programs\AI Writer Studio\ai-writer-studio.exe"
```

## Recovery

### Schritt 1: App sauber beenden

```powershell
Get-Process ai-writer-studio | Stop-Process -Force
```

### Schritt 2: Falls Zombie (Zugriff verweigert)

```powershell
# Parent-Prozess ebenfalls killen
Get-Process ai-writer-studio | Select-Object Id, Parent
Stop-Process -Id <ParentId> -Force

# Oder via WMIC (funktioniert auch bei hängenden Prozessen)
wmic process where "name='ai-writer-studio.exe'" delete
```

### Schritt 3: Neuer Start

Die App startet normal. Das Fenster sollte sofort sichtbar sein.

## Prävention

- Das Build-Script (`scripts/build-windows.ps1`) beendet automatisch alte App-Prozesse vor jedem Build
- `tauri-plugin-single-instance` verhindert parallele Instanzen zur Laufzeit
- Log-Dateien im App-Datenverzeichnis ermöglichen Diagnose ohne Debugger

## Hinweise

- **Nicht** `msedgewebview2.exe` global killen — andere Apps (Outlook, Teams) nutzen WebView2
- Dev-Mode ist nicht betroffen (anderer WebView2-User-Data-Ordner)
- Falls das Problem persistiert: WebView2 Runtime reparieren (Einstellungen → Apps → Microsoft Edge WebView2 → Ändern → Reparieren)
