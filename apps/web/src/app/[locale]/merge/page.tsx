import type { Metadata } from "next";

import { MergeWorkspace } from "@/components/merge-workspace";

export const metadata: Metadata = {
  title: "Unir PDF — CeroPDF",
  description:
    "Une, ordena y rota varios PDFs en uno solo. Gratis y 100 % en tu navegador: tus archivos no salen del dispositivo.",
};

export default function MergeToolPage() {
  return <MergeWorkspace />;
}
