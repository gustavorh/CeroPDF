import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ceropdf.gustavorh.com";

const TOOL_PATHS = [
  "/",
  "/merge",
  "/split",
  "/edit",
  "/rotate",
  "/organize",
  "/compress",
  "/office-to-pdf",
  "/media",
  "/remove-pages",
  "/extract-pages",
  "/crop",
] as const;
const STATIC_PATHS = ["/privacy", "/security"] as const;

function urlFor(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const normalized = path === "/" ? "" : path;
  return `${SITE_URL}${prefix}${normalized}` || `${SITE_URL}/`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const path of [...TOOL_PATHS, ...STATIC_PATHS]) {
    for (const locale of routing.locales) {
      entries.push({
        url: urlFor(locale, path),
        lastModified: now,
        changeFrequency: path === "/" ? "weekly" : "weekly",
        priority:
          path === "/"
            ? 1
            : STATIC_PATHS.includes(path as (typeof STATIC_PATHS)[number])
              ? 0.5
              : 0.9,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [l, urlFor(l, path)]),
          ),
        },
      });
    }
  }

  return entries;
}
