import { LandingFooterCopy } from "@/components/landing-footer-copy";
import { LandingHeader } from "@/components/landing-header";
import { LandingHero } from "@/components/landing-hero";
import { LandingToolsGrid } from "@/components/landing-tools-grid";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-ambient-glow"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />
        <main className="flex min-h-0 flex-1 flex-col">
          <LandingHero />
          <LandingToolsGrid />
        </main>
        <LandingFooterCopy />
      </div>
    </div>
  );
}
