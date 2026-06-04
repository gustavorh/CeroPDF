"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/** Pie visual compacto (Hook): cabe en viewport pequeño sin scroll con el dropzone masivo. */
export function LandingFooterCopy() {
  const t = useTranslations("footer");
  const tc = useTranslations("common");

  return (
    <footer className="relative z-10 shrink-0 px-4 pb-4 pt-2 text-center sm:px-6 sm:pb-5">
      <p className="text-pretty text-sm leading-snug text-muted-foreground sm:text-base">
        <span className="text-foreground">{t("tagline")}</span>{" "}
        {t("subtagline")}
      </p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-xs text-tertiary">
        <Link
          href="/privacy"
          className="rounded-sm transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("privacy")}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/security"
          className="rounded-sm transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("security")}
        </Link>
        <span aria-hidden>·</span>
        <a
          href="https://github.com/gustavorh"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {tc("github")}
        </a>
      </p>
    </footer>
  );
}
