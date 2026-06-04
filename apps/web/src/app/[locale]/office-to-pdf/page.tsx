import type { Metadata } from "next";

import { OfficeWorkspace } from "@/components/office-workspace";

export const metadata: Metadata = {
  title: "Convertir Office a PDF",
  description:
    "Convierte Word, Excel, PowerPoint y OpenDocument a PDF con LibreOffice. Procesamiento server-side opt-in: el archivo se sube, se convierte y se borra inmediatamente.",
  alternates: { canonical: "/office-to-pdf" },
};

export default function OfficeToPdfPage() {
  return <OfficeWorkspace />;
}
