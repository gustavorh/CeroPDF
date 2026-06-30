import type { Metadata } from "next";

import { RotateWorkspace } from "@/components/rotate-workspace";

export const metadata: Metadata = {
  title: "Rotar PDF — CeroPDF",
  description:
    "Rota páginas de un PDF, una a una o todas a la vez. Gratis y 100 % en tu navegador.",
  alternates: { canonical: "/rotate" },
};

export default function RotatePage() {
  return <RotateWorkspace />;
}
