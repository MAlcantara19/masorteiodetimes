"use client";
// Partida (admin ou quem tem o PIN). A mesma tela do link público, com o atalho pro link.
import Link from "next/link";
import { usePelada } from "@/lib/pelada";
import { useSessao } from "@/lib/sessao";
import Topo, { Carregando } from "@/components/Topo";
import TelaPartida from "@/components/TelaPartida";
import Icone from "@/components/Icone";

export default function JogoPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando } = useSessao();
  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
      <Topo
        titulo="Partida"
        sub={pelada.nome}
        direita={
          <Link href={`/p/${slug}/ao-vivo`} className="flex items-center gap-1 text-sm font-semibold text-roxo">
            <Icone nome="link" tamanho={16} /> Link ao vivo
          </Link>
        }
      />
      <TelaPartida pelada={pelada} publico={false} />
    </main>
  );
}
