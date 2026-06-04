import type { ReactNode } from "react";

import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";

type LegalPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/** Layout neutral para páginas estáticas (privacy, security, etc.). */
export function LegalPageShell({
  title,
  subtitle,
  children,
}: LegalPageShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />
        <main className="flex min-h-0 flex-1 flex-col">
          <article className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
            <header className="mb-8 sm:mb-10">
              <h1 className="text-display-lg text-balance text-foreground">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {subtitle}
                </p>
              ) : null}
            </header>
            <div className="space-y-8 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base [&_h2]:text-headline-md [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:leading-relaxed [&_code]:font-mono [&_code]:text-foreground [&_code]:bg-surface-container [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_code]:text-xs [&_strong]:text-foreground [&_strong]:font-semibold">
              {children}
            </div>
          </article>
        </main>
        <LandingFooterCopy />
      </div>
    </div>
  );
}
