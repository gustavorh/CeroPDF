import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // Default locale stays at root (`/`, `/merge`); others get a prefix (`/en`, `/en/merge`).
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
