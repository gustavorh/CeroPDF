/**
 * pdf.js throws when a render is cancelled; React Strict Mode / unmount can trigger that — not a user-visible failure.
 */
export function isBenignPdfPreviewError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  return (
    name === "RenderingCancelledException" ||
    name === "AbortException" ||
    name === "AbortError"
  );
}
