import type { Metadata } from "next";

import { OrganizeWorkspace } from "@/components/organize-workspace";

export const metadata: Metadata = {
  title: "Organizar PDF — CeroPDF",
  description:
    "Reordena, rota y elimina páginas de un PDF y descárgalo reorganizado. 100 % en tu navegador.",
  alternates: { canonical: "/organize" },
};

export default function OrganizePage() {
  return <OrganizeWorkspace />;
}
