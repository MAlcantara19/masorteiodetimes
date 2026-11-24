"use client";
// Link público ao vivo: qualquer um vê; pra mexer no placar precisa do PIN do dia.
import { useState } from "react";
import Link from "next/link";
import { usePelada } from "@/lib/pelada";
import { Carregando } from "@/components/Topo";
import TelaPartida from "@/components/TelaPartida";

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
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-bold">
            {pelada.nome} <span className="text-roxo">ao vivo</span>
          </h1>
          <span className="text-[13px] text-apagado">qualquer um com o link pode ver</span>
        </div>
        <button type="button" onClick={compartilhar} className="h-10 rounded-full border border-borda bg-white px-3 text-sm font-semibold text-roxo">
          {copiado ? "Copiado!" : "Compartilhar"}
        </button>
      </header>
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
