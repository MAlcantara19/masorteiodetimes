"use client";
// Aba "Mais": atalhos conforme o papel (master, admin ou jogador).
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";
import Icone, { type NomeIcone } from "@/components/Icone";
import Topo, { Carregando } from "@/components/Topo";
import InstalarApp from "@/components/InstalarApp";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import { montarMenu } from "@/lib/menu";

type Item = { href: string; titulo: string; sub: string; icone: NomeIcone };

function Grupo({ titulo, itens }: { titulo: string; itens: Item[] }) {
  if (!itens.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-apagado">{titulo}</h2>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-borda bg-white">
        {itens.map((i) => (
          <Link key={i.href} href={i.href} className="flex items-center gap-3 border-b border-borda px-4 py-3 last:border-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-roxo-suave text-roxo-escuro">
              <Icone nome={i.icone} tamanho={20} />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-semibold">{i.titulo}</span>
              <span className="text-[13px] text-apagado">{i.sub}</span>
            </span>
            <span className="text-apagado" aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function MaisPage() {
  const router = useRouter();
  const { carregando, usuario, perfil, peladas, ehMaster, ehAdmin, sair } = useSessao();
  const atualSlug = usePeladaAtual();

  useEffect(() => {
    if (!carregando && !usuario) router.replace("/entrar");
  }, [carregando, usuario, router]);

  if (carregando || !usuario) return <Carregando />;

  const atual = peladas.find((p) => p.slug === atualSlug) ?? peladas[0] ?? null;
  const admin = atual ? ehAdmin(atual.id) : false;

  const g = montarMenu(atual, admin, ehMaster);
  const masterItens: Item[] = g.master;
  const adminItens: Item[] = g.admin;
  const jogador: Item[] = [...g.jogador, ...g.geral.filter((x) => x.id !== "inicio")];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Topo titulo="Mais" sub={perfil ? `${perfil.apelido || perfil.nome}${ehMaster ? " · master" : admin ? " · admin" : ""}` : undefined} />

      {peladas.length > 1 && (
        <p className="px-1 text-sm text-apagado">
          Atalhos da <strong className="text-tinta">{atual?.nome}</strong>. Troque de pelada no Menu (botão embaixo, à direita).
        </p>
      )}

      <Grupo titulo="Painel master" itens={masterItens} />
      <Grupo titulo="Admin da pelada" itens={adminItens} />
      <Grupo titulo="Jogador" itens={jogador} />

      <AtivarNotificacoes />
      <InstalarApp />

      <div className="flex flex-col gap-2 pt-2 text-center text-sm">
        <Link href="/privacidade" className="text-apagado underline">
          Privacidade e excluir conta
        </Link>
        <button type="button" onClick={sair} className="font-semibold text-alerta">
          Sair da conta
        </button>
        <span className="pt-2 text-xs text-apagado">Desenvolvido por Matheus Alcântara</span>
      </div>
    </main>
  );
}
