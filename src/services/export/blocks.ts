// Re-Export der Block-Transformation aus dem allgemeinen Export-Service,
// damit bookwriter/export ohne die projektbezogenen Nebeneffekte von
// index.ts (collaboration, printlayout) importierbar bleibt.

export { toBlocks } from "./index";
export type { Block } from "./index";