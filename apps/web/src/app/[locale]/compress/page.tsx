import type { Metadata } from "next";

import { CompressWorkspace } from "@/components/compress-workspace";

export const metadata: Metadata = {
  title: "Comprimir PDF",
  description:
    "Reduce el peso de tus PDFs con Ghostscript. Procesamiento server-side opt-in: el archivo se sube, se procesa y se borra inmediatamente.",
  alternates: { canonical: "/compress" },
};

export default function CompressPage() {
  return <CompressWorkspace />;
}
