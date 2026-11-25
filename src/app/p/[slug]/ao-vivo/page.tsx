"use client";
// Link público ao vivo: qualquer um vê; pra mexer no placar precisa do PIN do dia.
import { useState } from "react";
import Link from "next/link";
import { usePelada } from "@/lib/pelada";
import { Carregando } from "@/components/Topo";
import TelaPartida from "@/components/TelaPartida";
import Capa from "@/components/Capa";

export default function AoVivoPage() {
  const { pelada, naoAchou } = usePelada();
  const [copiado, setCopiado] = useState(false);
  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada) return <Carregando />;

  async function compartilhar() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `${pelada!.nome} ao vivo`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopiado(true);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
      <Capa
        titulo={`${pelada.nome} ao vivo`}
        sub="qualquer um com o link pode ver"
        voltar={`/p/${pelada.slug}`}
        logo={pelada.logo_url}
        direita={
          <button type="button" onClick={compartilhar} className="h-9 shrink-0 rounded-full bg-white/15 px-3 text-sm font-semibold">
            {copiado ? "Copiado!" : "Compartilhar"}
          </button>
        }
      />
      <TelaPartida pelada={pelada} publico />
      <footer className="pt-4 text-center text-xs text-apagado">
        <Link href="/" className="font-semibold text-roxo">
          MA Sorteio de Times
        </Link>{" "}
        · Desenvolvido por Matheus Alcântara
      </footer>
    </main>
  );
}
