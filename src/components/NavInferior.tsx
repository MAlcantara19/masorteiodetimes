"use client";
// Barra de baixo do app (Início, Jogadores, Sorteio, Partida, Mais).
// As abas da pelada levam pra última pelada aberta.
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icone, { type NomeIcone } from "./Icone";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";

export default function NavInferior() {
  const caminho = usePathname();
  const { usuario, peladas, ehAdmin } = useSessao();
  const atualSlug = usePeladaAtual();
  if (!usuario) return null;
  if (caminho.startsWith("/entrar") || caminho.startsWith("/p/") || caminho.startsWith("/tour")) return null;

  const atual = peladas.find((p) => p.slug === atualSlug) ?? (peladas.length === 1 ? peladas[0] : null);
  const base = atual ? `/${atual.slug}` : null;
  const abas: { href: string; rotulo: string; icone: NomeIcone; ativo: boolean }[] = [
    { href: "/", rotulo: "Início", icone: "inicio", ativo: caminho === "/" },
  ];
  if (base && atual && ehAdmin(atual.id)) {
    abas.push(
      { href: `${base}/jogadores`, rotulo: "Jogadores", icone: "jogadores", ativo: caminho.endsWith("/jogadores") },
      { href: `${base}/sortear`, rotulo: "Sorteio", icone: "sorteio", ativo: /\/(sortear|times|lista)$/.test(caminho) },
    );
  }
  if (base) {
    abas.push({ href: `${base}/jogo`, rotulo: "Partida", icone: "partida", ativo: /\/(jogo|resultados|fim)$/.test(caminho) });
  }
  abas.push({ href: "/mais", rotulo: "Mais", icone: "mais", ativo: caminho === "/mais" });

  return (
    <>
      <div className="h-24" aria-hidden="true" />
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl justify-around pt-2.5 pb-3">
          {abas.map((a) => (
            <Link
              key={a.rotulo}
              href={a.href}
              aria-current={a.ativo ? "page" : undefined}
              className={`flex min-w-[60px] flex-col items-center gap-1 text-[11px] font-semibold ${a.ativo ? "text-roxo" : "text-apagado"}`}
            >
              <Icone nome={a.icone} />
              {a.rotulo}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
