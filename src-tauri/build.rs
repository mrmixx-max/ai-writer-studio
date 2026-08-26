// Tauri-Build-Skript.
// Ohne diese Datei wird tauri-build nie ausgeführt: Windows-Icon, EXE-Metadaten
// (Datei-/Produktversion, Beschreibung, Publisher) und der Manifest werden dann
// NICHT in die Binärdatei eingebettet, und der Build bricht ab.
fn main() {
    tauri_build::build()
}
