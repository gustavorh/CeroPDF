import { LandingFooterCopy } from "@/components/landing-footer-copy";
import { LandingHeader } from "@/components/landing-header";
import { LandingHero } from "@/components/landing-hero";
import { LandingToolsGrid } from "@/components/landing-tools-grid";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
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
