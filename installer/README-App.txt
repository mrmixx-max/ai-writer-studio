AI Writer Studio
Lokales Manuskriptstudio mit KI
================================================================

Erste Schritte
--------------
1. Starte AI Writer Studio ueber das Startmenue.
2. Der Einrichtungsassistent fuehrt dich durch die Anbindung
   eines KI-Anbieters. Du kannst ihn ueberspringen.
3. Lege ein Projekt an und darin ein erstes Kapitel.

Deine Daten
-----------
  Projekte und Datenbank   %APPDATA%\AI Writer Studio\user_data\
  Protokolle               %APPDATA%\AI Writer Studio\logs\
  Exporte                  %APPDATA%\AI Writer Studio\exports\
  Sicherungen              %APPDATA%\AI Writer Studio\backups\

Sicherung: Kopiere den Ordner user_data, um alle Projekte zu
sichern. Zum Wiederherstellen den Ordner zuruecklegen.

KI-Anbieter einrichten
----------------------
Ollama (lokal, empfohlen)
  1. Ollama von https://ollama.com installieren
  2. In der Eingabeaufforderung:  ollama serve
  3. Modelle laden, zum Beispiel:
       ollama pull llama3.2
       ollama pull nomic-embed-text     (fuer Projektwissen)

LM Studio (lokal)
  1. LM Studio installieren, Modell laden
  2. Lokalen Server aktivieren (Port 1234)

OpenAI (Cloud)
  API-Schluessel in den Einstellungen eintragen.
  Hinweis: Dabei werden Textausschnitte an OpenAI uebertragen.

Ohne laufenden Anbieter bleiben Editor, Projektverwaltung,
Export, Konsistenzpruefung und die lexikalische Suche im
Projektwissen vollstaendig nutzbar.

Tastenkuerzel
-------------
  Strg+S           Kapitel speichern
  Strg+B / Strg+I  Fett / Kursiv
  Strg+1..3        Ueberschrift 1 bis 3
  F11              Fokusmodus

Fehlersuche
-----------
Bei Problemen hilft die Protokolldatei:
  %APPDATA%\AI Writer Studio\logs\app.log

Lizenz
------
MIT. Siehe LICENSE.txt im Installationsordner.

(C) 2026 Erik Gieske
