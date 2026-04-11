import Link from "next/link";

import { BrandMark } from "./brand-mark";

const GITHUB_PROFILE_HREF = "https://github.com/gustavorh";

/** Cabecera mínima (estado vacío): marca a la izquierda; enlace al repositorio/autor a la derecha. */
export function LandingHeader() {
  return (
    <header className="relative z-20 shrink-0 border-b border-outline-variant/25 bg-background/80 backdrop-blur-[20px]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <BrandMark aria-hidden className="h-9 w-9" />
          <span className="truncate text-headline-md text-foreground">
            CeroPDF
          </span>
        </Link>
        <nav
          className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3"
          aria-label="Enlaces externos"
        >
          <a
            href={GITHUB_PROFILE_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-surface-container-low hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="GitHub — perfil gustavorh (se abre en una pestaña nueva)"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
