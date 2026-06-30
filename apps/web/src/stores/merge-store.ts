import { buildExportDownloadFilename, defaultProjectDisplayName } from "@/lib/project-display-name";
import {
  createPageGridStore,
  type Capabilities,
} from "@/lib/page-grid/use-page-grid";

export const MERGE_CAPS: Capabilities = {
  canReorder: true,
  canRotate: true,
  canHide: true,
  canRemove: true,
  canSelect: true,
};

export const useMergeStore = createPageGridStore({
  multiDoc: true,
  capabilities: MERGE_CAPS,
  features: { projectName: true, optimizeSize: true },
  exportPhase: "merging",
  exportUsesSelection: true,
  buildFilename: buildExportDownloadFilename,
  defaultProjectName: defaultProjectDisplayName,
});
