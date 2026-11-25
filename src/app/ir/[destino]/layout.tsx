// O Next 16 pede Suspense em páginas com endereço dinâmico.
import { Suspense } from "react";
import { Carregando } from "@/components/Topo";

export default function IrLayout({ children }: LayoutProps<"/ir/[destino]">) {
  return <Suspense fallback={<Carregando />}>{children}</Suspense>;
}
