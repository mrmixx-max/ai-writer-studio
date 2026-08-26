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
    AppVersion     = '0.1.0'
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
}
