import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const ORGANIZE_CAPS: Capabilities = {
  canReorder: true,
  canRotate: true,
  canRemove: true,
  canSelect: true,
};

export const useOrganizeStore = createPageGridStore({
  multiDoc: false,
  capabilities: ORGANIZE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.organizado.pdf`,
});
