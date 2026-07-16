"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useMergeStore } from "@/stores/merge-store";

import { CanvasBottomPill } from "./canvas-bottom-pill";
import { CanvasDocuments } from "./canvas-documents";
import { CanvasHeader } from "./canvas-header";
import { ErrorBanner } from "./error-banner";
import { ExportFlowModal } from "./export-flow-modal";
import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";
import { StatusStrip } from "./status-strip";
import { WorkspaceDropzone } from "./workspace-dropzone";

export function MergeWorkspace() {
  const uiPhase = useDocumentStore((s) => s.uiPhase);
  const thumbnailRenderCount = useDocumentStore((s) => s.thumbnailRenderCount);

  // Gate off merge-store's own page entries, not the shared document-store count
  // (a tool-agnostic store could hold stale docs from another workspace).
  const hasDocs = useMergeStore((s) => s.pageEntries.length > 0);

  const exportModalVisible =
    uiPhase === "merging" || uiPhase === "export_success";

  const showStatusStrip =
    !exportModalVisible &&
    (!hasDocs ||
      uiPhase === "loading" ||
      uiPhase === "parsing" ||
      uiPhase === "rendering" ||
      uiPhase === "error" ||
      thumbnailRenderCount > 0);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-ambient-glow"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        {hasDocs ? (
          <>
            <CanvasHeader />
            {showStatusStrip ? <StatusStrip /> : null}
            <ErrorBanner />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <CanvasDocuments />
            </main>
            <CanvasBottomPill />
            <ExportFlowModal />
          </>
        ) : (
          <>
            <LandingHeader />
            {showStatusStrip ? <StatusStrip /> : null}
            <ErrorBanner />
            <main className="flex min-h-0 flex-1 flex-col">
              <WorkspaceDropzone variant="hero" />
            </main>
            <LandingFooterCopy />
          </>
        )}
      </div>
    </div>
  );
}
