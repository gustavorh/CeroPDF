import type { Metadata } from "next";

import { SplitWorkspace } from "@/components/split-workspace";

export const metadata: Metadata = {
  title: "Dividir PDF",
  description:
    "Separa un PDF en archivos por rangos o una página por archivo. 100 % en tu navegador, sin subidas.",
  alternates: { canonical: "/split" },
};

export default function SplitPage() {
  return <SplitWorkspace />;
}
