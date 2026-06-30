import type { Metadata } from "next";

import { ExtractPagesWorkspace } from "@/components/extract-pages-workspace";

export const metadata: Metadata = {
  title: "Extraer páginas de un PDF — CeroPDF",
  description:
    "Selecciona páginas concretas y genera un PDF nuevo solo con esas. 100 % en tu navegador.",
  alternates: { canonical: "/extract-pages" },
};

export default function ExtractPagesPage() {
  return <ExtractPagesWorkspace />;
}
