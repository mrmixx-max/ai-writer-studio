#
# Zentrale Release-Konfiguration für AI Writer Studio.
#
# EINZIGE Quelle für Version, Produktname und Pfade.
# Wird von build-windows.ps1, create-installer.ps1 und sync-version.ps1 geladen.
# Das Inno-Skript erhält die Werte per /D-Parameter, damit nichts doppelt gepflegt wird.
#

@{
    # ---- Produkt ----
    AppName        = 'AI Writer Studio'
    AppVersion     = '1.0.0'
    AppPublisher   = 'Erik Gieske'
    AppUrl         = 'https://github.com/mrmixx-max/ai-writer-studio'
    AppSupportUrl  = 'https://github.com/mrmixx-max/ai-writer-studio/issues'
    AppUpdatesUrl  = 'https://github.com/mrmixx-max/ai-writer-studio/releases'
    AppCopyright   = '(C) 2026 Erik Gieske'
    AppClaim       = 'Lokales Manuskriptstudio mit KI'

    # Stabile GUID. NIEMALS ändern — Windows erkennt Upgrades daran.
    AppId          = '{{8F3A9C41-5E27-4B18-9D6A-7C2E8B4F1A03}'

    # ---- Dateinamen ----
    ExeName        = 'ai-writer-studio.exe'
    InstallerName  = 'AI-Writer-Studio-Setup'

    # ---- Dateizuordnungen ----
    ProjectExt     = '.aiwsproj'
    ChapterExt     = '.aiwschapter'
    ProjectProgId  = 'AIWriterStudio.Project.1'
    ChapterProgId  = 'AIWriterStudio.Chapter.1'

    # ---- Pfade (relativ zum Repo-Wurzelverzeichnis) ----
    Paths = @{
        TauriRelease = 'src-tauri\target\release'
        IconDir      = 'assets\icons'
        InstallerDir = 'installer'
        OutputDir    = 'release'
        DistDir      = 'dist'
    }

    # ---- Build ----
    MinRustVersion = '1.77'
    MinNodeVersion = 20

    # ---- Auto-Update (tauri-plugin-updater) ----
    # Feed-Datei, die die App beim Start/Check abfragt (GitHub Releases).
    UpdateFeedFile  = 'latest.json'
    # Pfad zum Tauri-Updater-Signaturschluessel (relativ zum Nutzerprofil).
    # Erzeugen mit:  npx tauri signer generate -w "$HOME\.tauri\ai-writer-studio.key"
    TauriSigningKey = '.tauri\ai-writer-studio.key'

    # ---- Code-Signing (Authenticode via signtool) ----
    # Ohne Zertifikat wird der Build ohne Signatur durchgefuehrt (mit Warnung).
    # SHA1-Fingerprint des Zertifikats im Windows-Zertifikatspeicher ODER PFX-Datei.
    Signing = @{
        CertThumbprint  = ''                                  # z. B. 'A1B2C3...' (Cert:\CurrentUser\My)
        PfxPath         = ''                                  # alternativ: Pfad zur .pfx-Datei
        # PfxPasswort NIE hier ablegen — kommt aus der Umgebungsvariable SIGNTOOL_PFX_PASSWORD.
        TimestampServer = 'http://timestamp.digicert.com'
        Description     = 'AI Writer Studio'
        Url             = 'https://github.com/mrmixx-max/ai-writer-studio'
    }
}
