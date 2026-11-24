// Envolve todas as telas da pelada (/bola-fora/...) num Suspense:
// o endereço só é conhecido na hora, então o Next mostra "Carregando…" e depois a tela.
import { Suspense } from "react";
import { Carregando } from "@/components/Topo";

export default function PeladaLayout({ children }: LayoutProps<"/[pelada]">) {
  return <Suspense fallback={<Carregando />}>{children}</Suspense>;
}
