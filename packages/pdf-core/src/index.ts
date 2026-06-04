export { MAX_FILE_BYTES, MAX_COMBINED_PAGES } from "./constants";
export { exportMergedPdf } from "./merge";
export type { BytesProvider, ExportPageRef } from "./merge";
export { parseRanges, splitPdfByPage, splitPdfByRanges } from "./split";
export type { PageRange, SplitChunk } from "./split";
export { flattenAnnotations } from "./annotate";
export type {
  Annotation,
  AnnotationBase,
  HighlightAnnotation,
  RectAnnotation,
  TextAnnotation,
} from "./annotate";
export { readDocumentBytes } from "./storage/types";
export type { DocumentBacking } from "./storage/types";
export {
  OPFS_THRESHOLD_BYTES,
  clearOpfsDir,
  deleteOpfsFile,
  isOpfsSupported,
  writeOpfsFile,
} from "./storage/opfs";
