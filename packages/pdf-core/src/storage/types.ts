/**
 * A document's bytes can live in memory (small files) or on disk via OPFS (large files).
 * Callers should not branch on the kind; use `readDocumentBytes` to get the bytes uniformly.
 */
export type DocumentBacking =
  | { kind: "memory"; bytes: ArrayBuffer }
  | { kind: "opfs"; handle: FileSystemFileHandle };

/** Read the document's bytes regardless of backing. */
export async function readDocumentBytes(
  backing: DocumentBacking,
): Promise<ArrayBuffer> {
  if (backing.kind === "memory") return backing.bytes;
  const file = await backing.handle.getFile();
  return await file.arrayBuffer();
}
