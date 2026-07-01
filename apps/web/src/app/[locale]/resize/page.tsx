import type { Metadata } from "next";

import { ResizeWorkspace } from "@/components/resize-workspace";

export const metadata: Metadata = {
  title: "Redimensionar PDF — CeroPDF",
  description:
    "Cambia el tamaño de un PDF por porcentaje o a un tamaño de papel estándar (A4, Letter, Legal). 100 % en tu navegador.",
  alternates: { canonical: "/resize" },
};

export default function ResizePage() {
  return <ResizeWorkspace />;
}
