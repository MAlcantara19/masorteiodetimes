"use client";
// Início: as peladas da pessoa, atalho de colar a lista (admin) e o resumo da última pelada.
// Sem login, mostra a entrada e o sorteio rápido no aparelho.
import Link from "next/link";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";
import { dataExtenso } from "@/lib/datas";
import { Carregando } from "@/components/Topo";
import CartaoPelada from "@/components/CartaoPelada";
import UltimaPelada from "@/components/UltimaPelada";

export default function Inicio() {
  const { carregando, usuario, perfil, peladas, ehMaster, ehAdmin } = useSessao();
  const atualSlug = usePeladaAtual();

  if (carregando) return <Carregando />;

  const atual = peladas.find((p) => p.slug === atualSlug) ?? peladas[0] ?? null;
  const iniciais = (perfil?.apelido || perfil?.nome || "MA")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-apagado">{dataExtenso(new Date())}</span>
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            MA <span className="text-roxo">Sorteio</span>
          </h1>
        </div>
        {usuario && (
          <Link href="/perfil" aria-label="Meu perfil" className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-roxo text-[15px] font-bold text-white">
            {perfil?.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" />
            ) : (
              iniciais
            )}
          </Link>
        )}
      </header>

      {!usuario && (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-apagado">Times equilibrados, placar ao vivo e o campeonato da sua pelada. Sem anúncio.</span>
          <Link href="/entrar" className="flex h-[54px] items-center justify-center rounded-[14px] bg-roxo text-base font-semibold text-white">
            Entrar
          </Link>
          <Link href="/tour" className="flex h-12 items-center justify-center rounded-[14px] border-2 border-roxo bg-white font-semibold text-roxo">
            Conhecer o app (tour rápido)
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

      {usuario && atual && ehAdmin(atual.id) && (
        <Link href={`/${atual.slug}/lista`} className="flex items-center gap-3.5 rounded-[18px] bg-roxo p-[18px] text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="7" y="3" width="10" height="4" rx="1" />
              <path d="M7 5H5v16h14V5h-2M9 12h6M9 16h4" />
            </svg>
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-semibold">Colar lista do WhatsApp</span>
            <span className="text-[13px] opacity-85">
              {peladas.length > 1 ? `${atual.nome} · ` : ""}Cola a mensagem inteira e eu separo tudo
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      {usuario && peladas.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-apagado uppercase">Minhas peladas</h2>
          {peladas.map((p) => (
            <CartaoPelada key={p.id} pelada={p} />
          ))}
          {ehMaster && (
            <Link href="/master" className="flex h-12 items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[#B9B3C6] text-sm font-semibold text-apagado">
              + Nova pelada
            </Link>
          )}
        </div>
      )}

      {usuario && atual && <UltimaPelada pelada={atual} />}

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
            <span>Peça o link de convite pro admin da sua pelada, ou peça pra ele te adicionar pelo seu e-mail ({perfil?.email}).</span>
          )}
        </section>
      )}

      <footer className="pt-4 text-center text-xs text-apagado">Desenvolvido por Matheus Alcântara</footer>
    </main>
  );
}
