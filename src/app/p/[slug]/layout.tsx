// Páginas públicas da pelada (/p/bola-fora/...): abrem sem login.
// O Suspense é exigência do Next 16 pra páginas com endereço dinâmico.
import { Suspense } from "react";
import { Carregando } from "@/components/Topo";

export default function PublicoLayout({ children }: LayoutProps<"/p/[slug]">) {
  return <Suspense fallback={<Carregando />}>{children}</Suspense>;
}
