"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";

import { AppHeader } from "./app-header";
import { ErrorBanner } from "./error-banner";
import { ExportToolbar } from "./export-toolbar";
import { ProductLandingHero } from "./product-landing-hero";
import { StatusStrip } from "./status-strip";
import { WhyLocalPdfSection } from "./why-localpdf-section";
import { WorkspaceDropzone } from "./workspace-dropzone";

export function WorkspaceShell() {
  const documents = useWorkspaceStore((s) => s.documents);
  const hasDocs = documents.length > 0;

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(14_165_233/0.06),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.04),transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <AppHeader />
        <StatusStrip />
        <ErrorBanner />
        <main className="flex flex-1 flex-col px-0 pt-6 pb-0">
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
            {hasDocs ? (
              <WorkspaceDropzone variant="compact" />
            ) : (
              <>
                <ProductLandingHero>
                  <WorkspaceDropzone variant="hero" />
                </ProductLandingHero>
                <WhyLocalPdfSection />
              </>
            )}
          </div>
        </main>
        <ExportToolbar />
      </div>
    </div>
  );
}
