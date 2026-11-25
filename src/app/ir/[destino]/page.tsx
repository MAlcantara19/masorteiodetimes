"use client";
// Atalhos do ícone do app (/ir/jogo, /ir/lista, /ir/sortear): abre a tela na pelada que a pessoa usou por último.
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";
import { Carregando } from "@/components/Topo";

export default function IrPage() {
  const { destino } = useParams<{ destino: string }>();
  const router = useRouter();
  const { carregando, usuario, peladas } = useSessao();
  const atualSlug = usePeladaAtual();

  useEffect(() => {
    if (carregando) return;
    if (!usuario) return router.replace("/entrar");
    const atual = peladas.find((p) => p.slug === atualSlug) ?? peladas[0];
    if (!atual) return router.replace("/");
    const destinos: Record<string, string> = {
      jogo: `/${atual.slug}/jogo`,
      lista: atual.lista_app ? `/p/${atual.slug}/lista` : `/${atual.slug}/lista`,
      sortear: `/${atual.slug}/sortear`,
    };
    router.replace(destinos[destino] ?? "/");
  }, [carregando, usuario, peladas, atualSlug, destino, router]);

  return <Carregando />;
}
