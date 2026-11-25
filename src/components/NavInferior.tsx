"use client";
// Barra de baixo: Início + 3 atalhos (a pessoa escolhe no Menu → Personalizar) + Menu (abre o menu lateral).
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icone from "./Icone";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";
import { abrirMenu, atalhosPadrao, montarMenu, useAtalhos } from "@/lib/menu";

export default function NavInferior() {
  const caminho = usePathname();
  const { usuario, peladas, ehAdmin, ehMaster } = useSessao();
  const atualSlug = usePeladaAtual();
  const escolhidos = useAtalhos();
  if (!usuario) return null;
  if (caminho.startsWith("/entrar") || caminho.startsWith("/tour")) return null;

  const atual = peladas.find((p) => p.slug === atualSlug) ?? (peladas.length === 1 ? peladas[0] : peladas[0] ?? null);
  const admin = atual ? ehAdmin(atual.id) : false;
  const g = montarMenu(atual, admin, ehMaster);
  const todos = new Map([...g.admin, ...g.jogador, ...g.geral, ...g.master].map((i) => [i.id, i]));
  const ids = (escolhidos ?? atalhosPadrao(admin)).filter((id) => todos.has(id));
  const meio = ids.map((id) => todos.get(id)!);

  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(href + "/"));
  const curto = (t: string) => t.replace("Colar lista do Zap", "Lista").replace("Montar sorteio", "Sorteio").replace("Resultados do dia", "Resultados").replace("Mensalidade (Pix)", "Pix").replace(/Retrospectiva \d+/, "Retrô").replace("Cronômetro simples", "Cronômetro").replace("Link ao vivo", "Ao vivo").replace("Página da pelada", "Página").replace("Avaliar a pelada", "Avaliar").replace("Presença e mensalidade", "Gestão").replace("Configurar pelada", "Config").replace("Acompanhar outras peladas", "Acompanhar").replace("Tour do app", "Tour");

  return (
    <>
      <div className="h-24" aria-hidden="true" />
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl justify-around pt-2.5 pb-3">
          <Link href="/" aria-current={ativo("/") ? "page" : undefined} className={`flex min-w-[60px] flex-col items-center gap-1 text-[11px] font-semibold ${ativo("/") ? "text-roxo" : "text-apagado"}`}>
            <Icone nome="inicio" />
            Início
          </Link>
          {meio.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              aria-current={ativo(a.href) ? "page" : undefined}
              className={`flex min-w-[60px] flex-col items-center gap-1 text-[11px] font-semibold ${ativo(a.href) ? "text-roxo" : "text-apagado"}`}
            >
              <Icone nome={a.icone} />
              {curto(a.titulo)}
            </Link>
          ))}
          <button type="button" onClick={abrirMenu} className="flex min-w-[60px] flex-col items-center gap-1 text-[11px] font-semibold text-apagado">
            <Icone nome="lista" />
            Menu
          </button>
        </div>
      </nav>
    </>
  );
}
