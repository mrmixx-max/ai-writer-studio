// Manuskript-Vergleich: Diff-Engine, nebeneinander-View und PDF-Export mit Markup.
export { diffWords, diffLines, diffStats } from "./diff";
export type { DiffOp, DiffSegment, DiffLine, DiffStats } from "./diff";
export { CompareView } from "./CompareView";
export type { CompareVersionMeta } from "./CompareView";
export { buildComparePdf, downloadComparePdf } from "./compareExport";
