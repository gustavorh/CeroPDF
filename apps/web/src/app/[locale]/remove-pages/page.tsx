import type { Metadata } from "next";

import { RemovePagesWorkspace } from "@/components/remove-pages-workspace";

export const metadata: Metadata = {
  title: "Quitar páginas de un PDF — CeroPDF",
  description:
    "Elimina páginas de un PDF por rango o selección visual y descarga el resto. 100 % en tu navegador.",
  alternates: { canonical: "/remove-pages" },
};

export default function RemovePagesPage() {
  return <RemovePagesWorkspace />;
}
