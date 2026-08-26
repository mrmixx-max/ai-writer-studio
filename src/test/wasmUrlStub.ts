// Test-Stub für den Vite-Asset-Import `sql.js/dist/sql-wasm.wasm?url`.
//
// In Tests gibt es keinen Vite-Dev-Server, der die Asset-URL bedient.
// Deshalb wird hier der absolute Dateisystempfad zur WASM-Datei aus
// node_modules geliefert — sql.js kann den unter Node direkt öffnen.
//
// Ein leerer String funktioniert NICHT: sql.js versucht dann `open('')`
// und scheitert mit ENOENT.

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(here, "../../node_modules/sql.js/dist/sql-wasm.wasm");

export default wasmPath;
