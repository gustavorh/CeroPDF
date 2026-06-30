"use client";

import { ORGANIZE_CAPS, useOrganizeStore } from "@/stores/organize-store";

import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

export function OrganizeWorkspace() {
  return (
    <SingleDocGridWorkspace
      store={useOrganizeStore}
      capabilities={ORGANIZE_CAPS}
      title="Organizar PDF"
      description="Reordena con arrastrar, rota y elimina páginas, y exporta el documento reorganizado. 100 % en tu navegador."
      exportLabel="Exportar"
    />
  );
}
