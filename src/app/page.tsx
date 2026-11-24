"use client";
// Início: as peladas da pessoa. Sem login, mostra a entrada e o sorteio rápido no aparelho.
import Link from "next/link";
import { useSessao } from "@/lib/sessao";
import { Carregando } from "@/components/Topo";
import CartaoPelada from "@/components/CartaoPelada";

export default function Inicio() {
  const { carregando, usuario, perfil, peladas, ehMaster } = useSessao();

  if (carregando) return <Carregando />;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <span className="font-display text-3xl font-bold tracking-tight">
          MA <span className="text-roxo">Sorteio de Times</span>
        </span>
        <span className="text-sm text-apagado">
          {perfil ? `E aí, ${perfil.apelido || perfil.nome.split(" ")[0]}!` : "Times equilibrados, sem anúncio e sem enrolação."}
        </span>
      </header>

      {!usuario && (
        <div className="flex flex-col gap-3">
          <Link href="/entrar" className="flex h-[54px] items-center justify-center rounded-[14px] bg-roxo text-base font-semibold text-white">
            Entrar
          </Link>
          <Link href="/acompanhar" className="flex h-12 items-center justify-center rounded-[14px] border border-borda bg-white font-semibold text-roxo">
            Só acompanhar o ao vivo
          </Link>
          <Link href="/sortear" className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">
            <strong className="text-tinta">Sorteio rápido neste aparelho</strong>
            <br />
            Sem login: o elenco fica salvo só neste celular.
          </Link>
        </div>
      )}

      {usuario && peladas.map((p) => <CartaoPelada key={p.id} pelada={p} />)}

      {usuario && !peladas.length && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">
          <strong className="text-tinta">Você ainda não está em nenhuma pelada.</strong>
          {ehMaster ? (
            <span>
              Crie a primeira no{" "}
              <Link href="/master" className="font-semibold text-roxo">
                Painel master
              </Link>
              .
            </span>
          ) : (
            <span>Peça pro admin da sua pelada te adicionar pelo seu e-mail ({perfil?.email}).</span>
          )}
        </section>
      )}

      <footer className="pt-4 text-center text-xs text-apagado">Desenvolvido por Matheus Alcântara</footer>
    </main>
  );
}
