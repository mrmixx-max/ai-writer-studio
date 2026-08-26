/// <reference types="vite/client" />

// Typdeklarationen für Vite-spezifische Asset-Imports.
// Ohne diese Datei scheitert `tsc` an `import wasmUrl from "...?url"`.

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "*.wasm?url" {
  const src: string;
  export default src;
}
