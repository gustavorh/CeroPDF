import type { Metadata } from "next";

import { CropWorkspace } from "@/components/crop-workspace";

export const metadata: Metadata = {
  title: "Recortar PDF — CeroPDF",
  description:
    "Recorta los márgenes de un PDF: dibuja el área y aplícala a todas las páginas o a páginas concretas. 100 % en tu navegador.",
  alternates: { canonical: "/crop" },
};

export default function CropPage() {
  return <CropWorkspace />;
}
