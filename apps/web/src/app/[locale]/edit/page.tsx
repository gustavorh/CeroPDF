import type { Metadata } from "next";

import { EditWorkspace } from "@/components/edit-workspace";

export const metadata: Metadata = {
  title: "Editar PDF",
  description:
    "Añade texto, rectángulos y resaltados encima de tus PDFs. 100 % en tu navegador, sin subidas.",
  alternates: { canonical: "/edit" },
};

export default function EditPage() {
  return <EditWorkspace />;
}
