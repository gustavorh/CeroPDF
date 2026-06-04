import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";

import { Analytics } from "@/components/analytics";
import { routing, type AppLocale } from "@/i18n/routing";

import "../globals.css";

const publicSans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-public-sans",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ceropdf.gustavorh.com";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const titleDefault = t("siteTitleDefault");
  const description = t("siteDescription");

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: titleDefault,
      template: t("siteTitleTemplate", { title: "%s" }),
    },
    description,
    applicationName: "CeroPDF",
    keywords: [
      "PDF",
      "unir PDF",
      "dividir PDF",
      "merge PDF",
      "split PDF",
      "editor PDF gratis",
      "editor PDF local",
      "PDF sin subir",
      "privacidad PDF",
    ],
    authors: [{ name: "Gustavo Reyes", url: "https://github.com/gustavorh" }],
    creator: "Gustavo Reyes",
    alternates: {
      canonical: "/",
      languages: {
        es: "/",
        en: "/en",
      },
    },
    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: "CeroPDF",
      title: titleDefault,
      description,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: titleDefault,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titleDefault,
      description,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#111316",
  colorScheme: "dark",
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  // Pass messages to the client provider so Client Components (header, footer,
  // language switcher) can translate — next-intl does not auto-forward them.
  const messages = await getMessages();

  return (
    <html lang={locale} className={`dark ${publicSans.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider locale={locale as AppLocale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
