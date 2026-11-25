"use client";
// Início: o dia de jogo (ou a próxima pelada), as peladas da pessoa, atalho de colar a lista (admin)
// e o resumo da última pelada.
// Sem login, mostra a entrada e o sorteio rápido no aparelho.
import Link from "next/link";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";
import { dataExtenso } from "@/lib/datas";
import { Carregando } from "@/components/Topo";
import CartaoPelada from "@/components/CartaoPelada";
import UltimaPelada from "@/components/UltimaPelada";
import AoVivoAgora from "@/components/AoVivoAgora";
import HojeNaPelada from "@/components/HojeNaPelada";
import Capa from "@/components/Capa";

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
      <Capa
        titulo={
          <>
            MA <span className="text-roxo-claro">Sorteio</span>
          </>
        }
        sub={dataExtenso(new Date())}
        direita={
          usuario ? (
            <Link href="/perfil" aria-label="Meu perfil" className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-roxo text-[15px] font-bold text-white">
              {perfil?.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" />
              ) : (
                iniciais
              )}
            </Link>
          ) : undefined
        }
      >
        <span className="text-sm text-[#E8DEFF]">Sorteie, jogue e premie a sua pelada.</span>
      </Capa>

      <AoVivoAgora />

      {!usuario && (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-apagado">Times equilibrados, placar ao vivo e o campeonato da sua pelada. Sem anúncio.</span>
          <Link href="/entrar" className="flex h-[54px] items-center justify-center rounded-[14px] bg-roxo text-base font-semibold text-white">
            Entrar
          </Link>
          <Link href="/tour" className="flex h-12 items-center justify-center rounded-[14px] border-2 border-roxo bg-white font-semibold text-roxo">
            Conhecer o app (tour rápido)
          </Link>
          <Link href="/criar" className="flex h-12 items-center justify-center rounded-[14px] border-2 border-roxo bg-white font-semibold text-roxo">
            Organiza uma pelada? Crie a sua grátis
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

      {usuario && atual && <HojeNaPelada key={atual.id} pelada={atual} />}

      {usuario && atual && ehAdmin(atual.id) && !(atual as { modo_dia_jogo?: boolean }).modo_dia_jogo && (
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
            <span>Abra o link da lista que o admin mandou no grupo e toque no seu nome, ou peça o link de convite. Ele também pode te adicionar pelo seu e-mail ({perfil?.email}).</span>
          )}
          <Link href="/peladas" className="mt-1 flex h-11 items-center justify-center rounded-xl border-2 border-roxo font-semibold text-roxo">
            Achar uma pelada pra jogar
          </Link>
          <Link href="/criar" className="flex h-11 items-center justify-center rounded-xl bg-roxo font-semibold text-white">
            Criar a minha pelada (grátis)
          </Link>
        </section>
      )}

      <footer className="pt-4 text-center text-xs text-apagado">Desenvolvido por Matheus Alcântara</footer>
    </main>
  );
}
