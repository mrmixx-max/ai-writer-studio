; ============================================================================
;  AI Writer Studio — Inno Setup 6
;
;  Version, Produktname und Pfade kommen aus scripts\release.config.psd1
;  und werden per /D-Parameter übergeben (siehe create-installer.ps1).
;  Die Defaults unten greifen nur beim direkten Öffnen in der Inno-IDE.
;
;  Kompilieren:  iscc installer\ai-writer-studio.iss
;  Oder:         npm run installer
; ============================================================================

#ifndef MyAppName
  #define MyAppName "AI Writer Studio"
#endif
#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#ifndef MyAppPublisher
  #define MyAppPublisher "Erik Gieske"
#endif
#ifndef MyAppURL
  #define MyAppURL "https://github.com/mrmixx-max/ai-writer-studio"
#endif
#ifndef MyAppSupportURL
  #define MyAppSupportURL "https://github.com/mrmixx-max/ai-writer-studio/issues"
#endif
#ifndef MyAppUpdatesURL
  #define MyAppUpdatesURL "https://github.com/mrmixx-max/ai-writer-studio/releases"
#endif
#ifndef MyAppExeName
  #define MyAppExeName "ai-writer-studio.exe"
#endif
#ifndef MyAppId
  #define MyAppId "{{8F3A9C41-5E27-4B18-9D6A-7C2E8B4F1A03}"
#endif
#ifndef MyOutputBaseFilename
  #define MyOutputBaseFilename "AI-Writer-Studio-Setup"
#endif

; Quellverzeichnisse relativ zu dieser .iss-Datei
#define SrcRoot   ".."
#define BuildDir  SrcRoot + "\src-tauri\target\release"
#define IconDir   SrcRoot + "\assets\icons"
#define OutDir    SrcRoot + "\release"

; Dateizuordnungen
#define ProjectExt     ".aiwsproj"
#define ChapterExt     ".aiwschapter"
#define ProjectProgId  "AIWriterStudio.Project.1"
#define ChapterProgId  "AIWriterStudio.Chapter.1"

#define MyAppClaim "Lokales Manuskriptstudio mit KI"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
VersionInfoVersion={#MyAppVersion}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoProductName={#MyAppName}
VersionInfoCopyright=(C) 2026 {#MyAppPublisher}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppSupportURL}
AppUpdatesURL={#MyAppUpdatesURL}
AppComments={#MyAppClaim}

; ---------------------------------------------------------------------------
;  Rechte: Installation ohne Administrator.
;
;  PrivilegesRequired=lowest installiert nach %LOCALAPPDATA%\Programs — dort
;  darf jeder Nutzer schreiben, und die App braucht zur Laufzeit keine
;  erhoehten Rechte.
;
;  KEIN PrivilegesRequiredOverridesAllowed=dialog: Bei /SILENT und /VERYSILENT
;  gibt es keinen Dialog, weshalb Inno dann stillschweigend die vorhandenen
;  Administratorrechte verwendet ("Administrative install mode: Yes") und in
;  Program Files installiert. Das Ergebnis unterscheidet sich je nachdem, ob die
;  Konsole erhoeht war — genau die Art Unvorhersehbarkeit, die ein Installer
;  nicht haben darf. Wer bewusst systemweit installieren will, nutzt
;  /ALLUSERS (durch 'commandline' weiterhin erlaubt).
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline

DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=no
AllowNoIcons=yes
UsePreviousAppDir=yes

; Nur 64-Bit
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0

LicenseFile={#SrcRoot}\LICENSE.txt
InfoBeforeFile={#SrcRoot}\installer\README-Installer.txt

OutputDir={#OutDir}
OutputBaseFilename={#MyOutputBaseFilename}-{#MyAppVersion}-x64
Compression=lzma
SolidCompression=yes
LZMANumBlockThreads=2

; Branding
WizardStyle=modern
SetupIconFile={#IconDir}\setup-icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
WizardImageFile={#IconDir}\wizard-image.bmp
WizardSmallImageFile={#IconDir}\wizard-small.bmp
WizardImageStretch=no
ShowLanguageDialog=auto

; Aufräumen
CloseApplications=yes
CloseApplicationsFilter=*.exe
RestartApplications=no
Uninstallable=yes
CreateUninstallRegKey=yes

[Languages]
Name: "german";  MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
german.CreateDesktopIcon=&Desktop-Verknüpfung anlegen
german.AssocProject=Projektdateien ({#ProjectExt}) mit {#MyAppName} öffnen
german.AssocChapter=Kapiteldateien ({#ChapterExt}) mit {#MyAppName} öffnen
german.LaunchApp={#MyAppName} starten
german.AdditionalIcons=Zusätzliche Verknüpfungen:
german.FileAssoc=Dateizuordnungen:
english.CreateDesktopIcon=Create a &desktop shortcut
english.AssocProject=Open project files ({#ProjectExt}) with {#MyAppName}
english.AssocChapter=Open chapter files ({#ChapterExt}) with {#MyAppName}
english.LaunchApp=Launch {#MyAppName}
english.AdditionalIcons=Additional shortcuts:
english.FileAssoc=File associations:

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "assocproj";   Description: "{cm:AssocProject}";      GroupDescription: "{cm:FileAssoc}"
Name: "assocchap";   Description: "{cm:AssocChapter}";      GroupDescription: "{cm:FileAssoc}"; Flags: unchecked

[Files]
; ---------------------------------------------------------------------------
;  Nur finale Build-Artefakte. Bewusst NICHT eingepackt:
;    - node_modules, src, src-tauri (Quellcode)
;    - *.map (Source-Maps; im Release-Build ohnehin deaktiviert)
;    - *.pdb (Rust-Debugsymbole)
;    - target\debug
;  Das Frontend ist bereits in die EXE eingebettet (Tauri bundelt dist\).
; ---------------------------------------------------------------------------
Source: "{#BuildDir}\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; Dokumente
Source: "{#SrcRoot}\LICENSE.txt";              DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcRoot}\installer\README-App.txt"; DestDir: "{app}"; DestName: "README.txt"; Flags: ignoreversion

; Dokument-Icons für die Dateizuordnungen
Source: "{#IconDir}\file-project.ico"; DestDir: "{app}\icons"; Flags: ignoreversion
Source: "{#IconDir}\file-chapter.ico"; DestDir: "{app}\icons"; Flags: ignoreversion
Source: "{#IconDir}\icon.ico";         DestDir: "{app}\icons"; Flags: ignoreversion

[Dirs]
; Nutzerdatenverzeichnisse unter %APPDATA% vorbereiten.
; Die App legt sie beim Start ebenfalls an (main.rs) — hier nur, damit der
; Ordner schon nach der Installation existiert und im Uninstaller adressierbar ist.
Name: "{userappdata}\{#MyAppName}";           Flags: uninsneveruninstall
Name: "{userappdata}\{#MyAppName}\user_data"; Flags: uninsneveruninstall
Name: "{userappdata}\{#MyAppName}\logs";      Flags: uninsneveruninstall
Name: "{userappdata}\{#MyAppName}\exports";   Flags: uninsneveruninstall
Name: "{userappdata}\{#MyAppName}\backups";   Flags: uninsneveruninstall

[Icons]
; Startmenü
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; \
    IconFilename: "{app}\{#MyAppExeName}"; Comment: "{#MyAppClaim}"
; Deinstallation im Startmenü-Ordner
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; \
    IconFilename: "{app}\icons\icon.ico"
; Desktop (optional)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; \
    IconFilename: "{app}\{#MyAppExeName}"; Comment: "{#MyAppClaim}"; Tasks: desktopicon

[Registry]
; ---------------------------------------------------------------------------
;  Dateizuordnungen unter HKCU (kein Admin nötig).
;  uninsdeletekey/uninsdeletevalue sorgt dafür, dass bei der Deinstallation
;  ALLE Einträge wieder verschwinden — keine Registry-Reste.
; ---------------------------------------------------------------------------

; --- Anwendung registrieren (für "Öffnen mit") ---
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}"; \
    ValueType: string; ValueName: "FriendlyAppName"; ValueData: "{#MyAppName}"; \
    Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\shell\open\command"; \
    ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; \
    Flags: uninsdeletekey

; --- Projektdatei (.aiwsproj) ---
Root: HKCU; Subkey: "Software\Classes\{#ProjectProgId}"; \
    ValueType: string; ValueName: ""; ValueData: "{#MyAppName} Projekt"; \
    Flags: uninsdeletekey; Tasks: assocproj
Root: HKCU; Subkey: "Software\Classes\{#ProjectProgId}\DefaultIcon"; \
    ValueType: string; ValueName: ""; ValueData: "{app}\icons\file-project.ico"; \
    Flags: uninsdeletekey; Tasks: assocproj
Root: HKCU; Subkey: "Software\Classes\{#ProjectProgId}\shell\open\command"; \
    ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; \
    Flags: uninsdeletekey; Tasks: assocproj
Root: HKCU; Subkey: "Software\Classes\{#ProjectExt}"; \
    ValueType: string; ValueName: ""; ValueData: "{#ProjectProgId}"; \
    Flags: uninsdeletevalue uninsdeletekeyifempty; Tasks: assocproj
Root: HKCU; Subkey: "Software\Classes\{#ProjectExt}\OpenWithProgids"; \
    ValueType: none; ValueName: "{#ProjectProgId}"; \
    Flags: uninsdeletevalue; Tasks: assocproj

; --- Kapiteldatei (.aiwschapter) ---
Root: HKCU; Subkey: "Software\Classes\{#ChapterProgId}"; \
    ValueType: string; ValueName: ""; ValueData: "{#MyAppName} Kapitel"; \
    Flags: uninsdeletekey; Tasks: assocchap
Root: HKCU; Subkey: "Software\Classes\{#ChapterProgId}\DefaultIcon"; \
    ValueType: string; ValueName: ""; ValueData: "{app}\icons\file-chapter.ico"; \
    Flags: uninsdeletekey; Tasks: assocchap
Root: HKCU; Subkey: "Software\Classes\{#ChapterProgId}\shell\open\command"; \
    ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; \
    Flags: uninsdeletekey; Tasks: assocchap
Root: HKCU; Subkey: "Software\Classes\{#ChapterExt}"; \
    ValueType: string; ValueName: ""; ValueData: "{#ChapterProgId}"; \
    Flags: uninsdeletevalue uninsdeletekeyifempty; Tasks: assocchap
Root: HKCU; Subkey: "Software\Classes\{#ChapterExt}\OpenWithProgids"; \
    ValueType: none; ValueName: "{#ChapterProgId}"; \
    Flags: uninsdeletevalue; Tasks: assocchap

; --- Deinstallations-Metadaten ---
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; \
    ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; \
    Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; \
    ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; \
    Flags: uninsdeletekey

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchApp}"; \
    Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Vom Programm erzeugte Dateien im Installationsordner (nicht die Nutzerdaten!)
Type: filesandordirs; Name: "{app}\icons"
Type: files;          Name: "{app}\*.log"
Type: dirifempty;     Name: "{app}"

[UninstallRun]
; Explorer-Icon-Cache anstoßen, damit verwaiste Dateizuordnungs-Icons verschwinden.
Filename: "{cmd}"; Parameters: "/c ie4uinit.exe -show"; Flags: runhidden skipifdoesntexist

[Code]
{ --------------------------------------------------------------------------
   Shell benachrichtigen, damit neue Dateizuordnungen sofort greifen
   und nach der Deinstallation wieder verschwinden.
  -------------------------------------------------------------------------- }
const
  SHCNE_ASSOCCHANGED = $08000000;
  SHCNF_IDLIST       = $00000000;

procedure SHChangeNotify(wEventId, uFlags: Integer; dwItem1, dwItem2: Integer);
  external 'SHChangeNotify@shell32.dll stdcall';

procedure RefreshShell;
begin
  try
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, 0, 0);
  except
    { Nicht kritisch: Zuordnungen greifen dann erst nach dem nächsten Anmelden. }
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    RefreshShell;
end;

{ --------------------------------------------------------------------------
   Leere Registry-Huellen nach der Deinstallation entfernen.

   Warum noetig: `uninsdeletekeyifempty` prueft den Schluessel, BEVOR der
   Unterschluessel OpenWithProgids geloescht ist. Zurueck bleiben leere
   Container wie HKCU\Software\Classes\.aiwsproj — funktional harmlos, aber
   unsauber. Diese Routine raeumt sie in der richtigen Reihenfolge weg.
  -------------------------------------------------------------------------- }
procedure RemoveEmptyKey(RootKey: Integer; const Key: String);
var
  Names: TArrayOfString;
  Values: TArrayOfString;
begin
  if not RegKeyExists(RootKey, Key) then
    Exit;
  { Nur loeschen, wenn weder Unterschluessel noch Werte vorhanden sind. }
  if RegGetSubkeyNames(RootKey, Key, Names) and (GetArrayLength(Names) > 0) then
    Exit;
  if RegGetValueNames(RootKey, Key, Values) and (GetArrayLength(Values) > 0) then
    Exit;
  RegDeleteKeyIfEmpty(RootKey, Key);
end;

procedure CleanupRegistryLeftovers;
var
  DefaultProgId: String;
begin
  { Zuerst die Unterschluessel, dann die Huelle. }
  RegDeleteKeyIncludingSubkeys(HKEY_CURRENT_USER, 'Software\Classes\{#ProjectExt}\OpenWithProgids');
  RegDeleteKeyIncludingSubkeys(HKEY_CURRENT_USER, 'Software\Classes\{#ChapterExt}\OpenWithProgids');

  { Den Standardwert nur entfernen, wenn er auf UNSERE ProgId zeigt.
    Zeigt er auf eine fremde Anwendung, wird er nicht angetastet — sonst
    wuerden wir die Zuordnung eines anderen Programms zerstoeren.
    Ohne diesen Schritt bleibt eine Huelle mit (default)-Wert zurueck, die
    RemoveEmptyKey korrekt nicht loescht. }
  if RegQueryStringValue(HKEY_CURRENT_USER, 'Software\Classes\{#ProjectExt}', '', DefaultProgId) then
    if DefaultProgId = '{#ProjectProgId}' then
      RegDeleteValue(HKEY_CURRENT_USER, 'Software\Classes\{#ProjectExt}', '');

  if RegQueryStringValue(HKEY_CURRENT_USER, 'Software\Classes\{#ChapterExt}', '', DefaultProgId) then
    if DefaultProgId = '{#ChapterProgId}' then
      RegDeleteValue(HKEY_CURRENT_USER, 'Software\Classes\{#ChapterExt}', '');

  RemoveEmptyKey(HKEY_CURRENT_USER, 'Software\Classes\{#ProjectExt}');
  RemoveEmptyKey(HKEY_CURRENT_USER, 'Software\Classes\{#ChapterExt}');
  RemoveEmptyKey(HKEY_CURRENT_USER, 'Software\{#MyAppPublisher}\{#MyAppName}');
  RemoveEmptyKey(HKEY_CURRENT_USER, 'Software\{#MyAppPublisher}');
end;

{ --------------------------------------------------------------------------
   Deinstallation: Nutzerdaten NIE ungefragt loeschen.
   Projekte, Manuskripte und Backups liegen unter %APPDATA% und bleiben
   standardmaessig erhalten. Nur auf ausdrueckliche Bestaetigung wird geloescht.

   Bei stiller Deinstallation (/SILENT, /VERYSILENT) wird NICHT gefragt und
   NICHT geloescht: eine MsgBox wuerde dort unbeantwortet haengen bleiben.
  -------------------------------------------------------------------------- }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    CleanupRegistryLeftovers;

    DataDir := ExpandConstant('{userappdata}\{#MyAppName}');

    if DirExists(DataDir) and not UninstallSilent then
    begin
      if MsgBox(
        'Sollen auch deine Projekte, Manuskripte und Backups geloescht werden?' + #13#10#13#10 +
        DataDir + #13#10#13#10 +
        'Waehle "Nein", wenn du die Daten behalten moechtest. ' +
        'Das ist die empfohlene Antwort — die Daten bleiben dann fuer eine ' +
        'Neuinstallation erhalten.',
        mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;

    RefreshShell;
  end;
end;

{ Beim Deinstallieren zuerst prüfen, ob die App noch läuft. }
function InitializeUninstall(): Boolean;
begin
  Result := True;
end;


