"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <span className="sr-only">{t("languageSwitcher")}</span>
      <select
        aria-label={t("languageSwitcher")}
        value={locale}
        onChange={(e) => {
          const next = e.target.value as AppLocale;
          router.replace(pathname, { locale: next });
        }}
        className="rounded-md border border-outline-variant/45 bg-surface-container-low px-2 py-1 text-xs text-foreground focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {l === "es" ? t("languageEs") : t("languageEn")}
          </option>
        ))}
      </select>
    </label>
  );
}
