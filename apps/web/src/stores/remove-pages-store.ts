import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const REMOVE_CAPS: Capabilities = { canRemove: true, canSelect: true };

export const useRemovePagesStore = createPageGridStore({
  multiDoc: false,
  capabilities: REMOVE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.sin-paginas.pdf`,
});
