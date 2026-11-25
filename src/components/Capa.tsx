"use client";
// Capa roxa da marca (mesmo visual da arte de divulgação): fundo em degradê, faixas diagonais e o símbolo.
// Usada no Início e nas páginas públicas. Traz o botão de voltar quando precisa.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Icone from "./Icone";

export function BotaoVoltar({ para = "/", claro = false }: { para?: string; claro?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(para))}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${claro ? "bg-white/15 text-white" : "bg-white text-tinta shadow-sm"}`}
    >
      <Icone nome="voltar" />
    </button>
  );
}

type Props = {
  titulo: ReactNode;
  sub?: ReactNode;
  voltar?: string; // pra onde volta se não tiver histórico
  direita?: ReactNode;
  children?: ReactNode;
  logo?: string | null;
};

export default function Capa({ titulo, sub, voltar, direita, children, logo }: Props) {
  return (
    <header
      className="relative flex flex-col gap-3 overflow-hidden rounded-3xl p-5 text-white"
      style={{ background: "radial-gradient(circle at 20% 0%, var(--marca-luz) 0%, var(--marca) 40%, var(--marca-escuro) 75%, #1B1430 100%)" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(125deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 34px)" }} />
      <div className="relative flex items-center gap-3">
        {voltar !== undefined && <BotaoVoltar para={voltar} claro />}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white/15">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-contain" />
          ) : (
            <Icone nome="sorteio" tamanho={24} />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-2xl leading-tight font-bold tracking-tight">{titulo}</span>
          {sub && <span className="truncate text-sm text-[#E8DEFF]">{sub}</span>}
        </div>
        {direita}
      </div>
      {children && <div className="relative">{children}</div>}
    </header>
  );
}

export function LinkCapa({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white">
      {children}
    </Link>
  );
}
