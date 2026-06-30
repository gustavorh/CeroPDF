import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const ROTATE_CAPS: Capabilities = { canRotate: true };

export const useRotateStore = createPageGridStore({
  multiDoc: false,
  capabilities: ROTATE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.rotado.pdf`,
});
