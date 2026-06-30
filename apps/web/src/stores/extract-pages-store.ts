import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const EXTRACT_CAPS: Capabilities = { canSelect: true };

export const useExtractPagesStore = createPageGridStore({
  multiDoc: false,
  capabilities: EXTRACT_CAPS,
  exportPhase: "processing",
  exportUsesSelection: true,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.extraido.pdf`,
});
