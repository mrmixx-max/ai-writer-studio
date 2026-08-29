<#
.SYNOPSIS
    Gemeinsame Hilfsfunktionen fuer die Build-Skripte.

.DESCRIPTION
    Wird von build-windows.ps1 und create-installer.ps1 per Dot-Sourcing
    geladen:  . (Join-Path $ScriptDir 'common.ps1')

    Zweck: Die ISCC-Suche existierte doppelt und lief dadurch auseinander.
    Sie gehoert an genau eine Stelle.
#>

Set-StrictMode -Version Latest

function Test-Tool {
    <# Prueft, ob ein Kommando im PATH liegt. #>
    param([Parameter(Mandatory)][string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Find-Iscc {
    <#
      Sucht ISCC.exe (Inno Setup Compiler) robust:
        1. Registry-Uninstall-Eintrag - findet auch Inno Setup 7 und
           benutzerdefinierte Zielordner wie C:\InnoSetup71\
        2. bekannte Standardpfade fuer Version 6 und 7
        3. PATH

      Eine reine Pfadliste genuegt nicht: Inno Setup laesst den Zielordner
      frei waehlen, und die Hauptversion wandert (6 -> 7).

      Rueckgabe: vollstaendiger Pfad oder $null.
    #>
    $candidates = @()

    $regPaths = @(
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    try {
        $found = Get-ItemProperty $regPaths -ErrorAction SilentlyContinue |
                 Where-Object { $_.DisplayName -like '*Inno Setup*' -and $_.InstallLocation }
        foreach ($f in $found) {
            $candidates += (Join-Path $f.InstallLocation 'ISCC.exe')
        }
    } catch {
        # Registry nicht lesbar - die Pfadsuche greift weiterhin.
    }

    foreach ($ver in @('7', '6')) {
        $candidates += "${env:ProgramFiles(x86)}\Inno Setup $ver\ISCC.exe"
        $candidates += "$env:ProgramFiles\Inno Setup $ver\ISCC.exe"
        $candidates += "C:\InnoSetup$ver\ISCC.exe"
        $candidates += "C:\InnoSetup${ver}1\ISCC.exe"
        $candidates += "C:\Program Files (x86)\Inno Setup $ver\ISCC.exe"
        $candidates += "$env:LOCALAPPDATA\Programs\Inno Setup $ver\ISCC.exe"
    }

    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return (Resolve-Path $c).Path }
    }

    $cmd = Get-Command 'iscc' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    return $null
}

function Get-IsccHelpText {
    <# Einheitliche Installationsanweisung. #>
    @"
Inno Setup wurde nicht gefunden.

Installation:
  winget install JRSoftware.InnoSetup

Alternativ von https://jrsoftware.org/isdl.php herunterladen.
Liegt Inno Setup in einem eigenen Ordner, ISCC.exe zum PATH hinzufuegen.
"@
}
