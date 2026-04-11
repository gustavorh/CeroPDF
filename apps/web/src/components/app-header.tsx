import { BrandMark } from "./brand-mark";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/85 backdrop-blur-md">
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <BrandMark aria-hidden />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  LocalPDF
                </h1>
                <span className="inline-flex items-center rounded-full border border-trust-border bg-trust-muted px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-trust uppercase">
                  Gratis
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  En tu equipo
                </span>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                La forma simple de trabajar PDFs en el navegador: privado, rápido
                y sin registros.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
              <span
                className="h-1.5 w-1.5 rounded-full bg-trust shadow-[0_0_8px_rgb(52_211_153/0.6)]"
                aria-hidden
              />
              Sin subidas a servidores
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
