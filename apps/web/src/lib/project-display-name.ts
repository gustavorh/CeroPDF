import type { WorkspaceDocument } from "@/types/workspace";

const FALLBACK = "CeroPDF_Documento";

/** Nombre mostrado por defecto: primer archivo + sufijo, o fallback legible (sin ISO). */
export function defaultProjectDisplayName(
  documents: WorkspaceDocument[],
): string {
  const stem = documents[0]?.name.replace(/\.pdf$/i, "").trim();
  if (stem) return `${stem}_fusionado`;
  return FALLBACK;
}

/** Nombre seguro para `download=` (sin caracteres prohibidos en nombres de archivo). */
export function buildExportDownloadFilename(
  projectName: string | null,
  documents: WorkspaceDocument[],
): string {
  const raw = projectName?.trim() || defaultProjectDisplayName(documents);
  const safe =
    raw
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim() || FALLBACK;
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}
