import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const CROP_CAPS: Capabilities = { canCrop: true };

export const useCropStore = createPageGridStore({
  multiDoc: false,
  capabilities: CROP_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.recortado.pdf`,
});
