"use client";
// Menu lateral (abre pelo lado): troca de pelada, todos os atalhos por papel
// e "Personalizar a barra de baixo" (a pessoa escolhe os 3 atalhos do meio).
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { definirPeladaAtual, usePeladaAtual } from "@/lib/pelada-atual";
import { atalhosPadrao, gravarAtalhos, MAX_ATALHOS, montarMenu, ouvirMenu, useAtalhos, type ItemMenu } from "@/lib/menu";
import Icone from "./Icone";

function Secao({ titulo, itens, fechar }: { titulo: string; itens: ItemMenu[]; fechar: () => void }) {
  if (!itens.length) return null;
  return (
    <div className="flex flex-col">
      <span className="px-3 pt-3 pb-1 text-[11px] font-bold tracking-wider text-apagado uppercase">{titulo}</span>
      {itens.map((i) => (
        <Link key={i.id} href={i.href} onClick={fechar} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-fundo">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-roxo-suave text-roxo-escuro">
            <Icone nome={i.icone} tamanho={18} />
          </span>
          <span className="text-[15px] font-semibold">{i.titulo}</span>
        </Link>
      ))}
    </div>
  );
}

export default function MenuLateral() {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const caminho = usePathname();
  const router = useRouter();
  const { usuario, perfil, peladas, ehMaster, ehAdmin, sair } = useSessao();
  const atualSlug = usePeladaAtual();
  const escolhidos = useAtalhos();

  useEffect(() => ouvirMenu(setAberto), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAberto(false);
  }, [caminho]);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  if (!usuario || !aberto) return null;

  const atual = peladas.find((p) => p.slug === atualSlug) ?? peladas[0] ?? null;
  const admin = atual ? ehAdmin(atual.id) : false;
  const g = montarMenu(atual, admin, ehMaster);
  const fechar = () => setAberto(false);
  const opcoes = [...g.admin, ...g.jogador, ...g.geral].filter((i) => i.id !== "inicio");
  const atalhos = escolhidos ?? atalhosPadrao(admin);

  // Troca de pelada e, se estiver numa tela da pelada, abre a mesma tela na outra.
  function trocar(novo: string) {
    const velho = atual?.slug;
    definirPeladaAtual(novo);
    setTrocando(false);
    const partes = caminho.split("/");
    if (velho && partes[1] === velho) router.push(["", novo, ...partes.slice(2)].join("/"));
    else if (velho && partes[1] === "p" && partes[2] === velho) router.push(["", "p", novo, ...partes.slice(3)].join("/"));
  }

  function alternar(id: string) {
    const n = atalhos.includes(id) ? atalhos.filter((x) => x !== id) : [...atalhos, id].slice(-MAX_ATALHOS);
    gravarAtalhos(n);
  }

  return (
    <div className="fixed inset-0 z-[55] flex" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="flex items-center gap-3 p-4" style={{ background: "radial-gradient(circle at 20% 0%, var(--marca-luz) 0%, var(--marca) 45%, var(--marca-escuro) 100%)" }}>
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-roxo font-bold text-white">
            {perfil?.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (perfil?.apelido || perfil?.nome || "?").slice(0, 2).toUpperCase()
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col text-white">
            <span className="truncate font-display text-lg font-bold">{perfil?.apelido || perfil?.nome}</span>
            <span className="text-xs text-[#E8DEFF]">{ehMaster ? "master" : admin ? "admin da pelada" : "jogador"}</span>
          </span>
          <button type="button" onClick={fechar} aria-label="Fechar menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </div>

        {peladas.length > 0 && (
          <div className="flex flex-col gap-1.5 border-b border-borda px-3 py-3">
            <span className="text-[11px] font-bold tracking-wider text-apagado uppercase">Pelada</span>
            <div className="flex flex-wrap gap-1.5">
              {peladas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => trocar(p.slug)}
                  className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${p.id === atual?.id ? "border-roxo bg-roxo text-white" : "border-borda"}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full border border-white/60" style={{ background: p.cor_banner || "#7444D6" }} />
                  {p.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col px-1 pb-2">
          <Secao titulo="Master" itens={g.master} fechar={fechar} />
          <Secao titulo={`Admin · ${atual?.nome ?? ""}`} itens={g.admin} fechar={fechar} />
          <Secao titulo={atual?.nome ?? "Pelada"} itens={g.jogador} fechar={fechar} />
          <Secao titulo="Geral" itens={g.geral} fechar={fechar} />
        </div>

        <div className="mx-3 mb-3 flex flex-col gap-2 rounded-2xl bg-fundo p-3">
          <button type="button" onClick={() => setEditando(!editando)} className="flex items-center justify-between text-sm font-semibold">
            Personalizar a barra de baixo
            <span className="text-roxo">{editando ? "Pronto" : "Editar"}</span>
          </button>
          {editando && (
            <>
              <span className="text-xs text-apagado">
                Escolha até {MAX_ATALHOS} atalhos pro meio da barra (Início e Menu ficam fixos). Toque de novo pra tirar.
              </span>
              <div className="flex flex-wrap gap-1.5">
                {opcoes.map((i) => {
                  const on = atalhos.includes(i.id);
                  return (
                    <button
                      key={i.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => alternar(i.id)}
                      className={`h-8 rounded-full border px-2.5 text-xs font-semibold ${on ? "border-roxo bg-roxo text-white" : "border-borda bg-white"}`}
                    >
                      {on ? `${atalhos.indexOf(i.id) + 1}. ` : ""}
                      {i.titulo}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => gravarAtalhos(null)} className="self-start text-xs font-semibold text-apagado underline">
                Voltar pro padrão
              </button>
            </>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-1 border-t border-borda p-3 text-sm">
          {peladas.length > 1 && (
            <>
              <button type="button" onClick={() => setTrocando(!trocando)} className="flex items-center justify-between py-1.5 text-left font-semibold">
                <span>
                  Trocar de pelada <span className="font-normal text-apagado">· agora: {atual?.nome}</span>
                </span>
                <span className="text-roxo">{trocando ? "Fechar" : "Trocar"}</span>
              </button>
              {trocando && (
                <div className="flex flex-col gap-1 pb-2">
                  {peladas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => trocar(p.slug)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left ${p.id === atual?.id ? "bg-roxo-suave font-semibold" : "hover:bg-fundo"}`}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ background: p.cor_banner || "#7444D6" }} />
                      <span className="flex-1">{p.nome}</span>
                      {ehAdmin(p.id) && <span className="text-xs text-apagado">admin</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <Link href="/mais" onClick={fechar} className="py-1.5 font-semibold text-roxo">
            Notificações, instalar o app e mais →
          </Link>
          <Link href="/privacidade" onClick={fechar} className="py-1.5 text-apagado">
            Privacidade e excluir conta
          </Link>
          <button type="button" onClick={sair} className="py-1.5 text-left font-semibold text-alerta">
            Sair da conta
          </button>
        </div>
      </div>
      <button type="button" aria-label="Fechar menu" onClick={fechar} className="flex-1 bg-noite/50" />
    </div>
  );
}
