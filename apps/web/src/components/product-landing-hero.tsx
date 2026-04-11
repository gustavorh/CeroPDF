"use client";

import type { ReactNode } from "react";

type ProductLandingHeroProps = {
  children: ReactNode;
};

export function ProductLandingHero({ children }: ProductLandingHeroProps) {
  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/35 px-5 py-10 shadow-sm sm:px-8 sm:py-12"
      aria-labelledby="landing-hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgb(14_165_233/0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-tertiary uppercase">
          LocalPDF · herramienta en el navegador
        </p>
        <h2
          id="landing-hero-heading"
          className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          Tus PDFs, tu equipo.{" "}
          <span className="text-primary">Sin subidas a la nube.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Une, divide y optimiza documentos en segundos.{" "}
          <span className="text-foreground/90">
            Gratis, rápido y sin cuenta
          </span>
          : arrastra un archivo o elige uno para empezar al instante, sin
          compromiso.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-md border border-trust-border bg-trust-muted px-2.5 py-1 font-mono text-[10px] font-medium tracking-wide text-trust uppercase">
            Gratis
          </span>
          <span className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            100% local
          </span>
          <span className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Sin registro
          </span>
        </div>
        <div className="mt-8 w-full">{children}</div>
      </div>
    </section>
  );
}
