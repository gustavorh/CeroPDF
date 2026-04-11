import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";

import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CeroPDF — PDFs en el navegador, gratis y privados",
  description:
    "Une, divide y optimiza PDFs en segundos. Gratis, sin cuenta y 100 % en tu dispositivo: tus archivos no se suben para procesarse.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`dark ${publicSans.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
