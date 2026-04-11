"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";

import { CanvasBottomPill } from "./canvas-bottom-pill";
import { CanvasDocuments } from "./canvas-documents";
import { CanvasHeader } from "./canvas-header";
import { ErrorBanner } from "./error-banner";
import { ExportFlowModal } from "./export-flow-modal";
import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";
import { StatusStrip } from "./status-strip";
import { WorkspaceDropzone } from "./workspace-dropzone";

export function WorkspaceShell() {
  const documents = useWorkspaceStore((s) => s.documents);
  const uiPhase = useWorkspaceStore((s) => s.uiPhase);
  const thumbnailRenderCount = useWorkspaceStore((s) => s.thumbnailRenderCount);

  const hasDocs = documents.length > 0;

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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
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
