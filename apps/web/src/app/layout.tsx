import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalPDF — PDFs en el navegador, gratis y privados",
  description:
    "Une, divide y optimiza PDFs en segundos. Gratis, sin cuenta y 100 % en tu dispositivo: tus archivos no se suben para procesarse.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
