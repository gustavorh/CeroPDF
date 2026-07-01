import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const RESIZE_CAPS: Capabilities = { canResize: true };

export const useResizeStore = createPageGridStore({
  multiDoc: false,
  capabilities: RESIZE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.redimensionado.pdf`,
});
